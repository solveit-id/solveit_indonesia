<?php

namespace Tests\Feature\Actions;

use App\Models\Inquiry;
use Illuminate\Contracts\Process\InvokedProcess;
use Illuminate\Foundation\Testing\DatabaseTruncation;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Process;
use Illuminate\Support\Str;
use RuntimeException;
use Tests\TestCase;

/**
 * Idempotency under real concurrency: every request runs in its own PHP process with its
 * own MySQL connection (tests/Support/submit-inquiry-worker.php), like independent PHP-FPM
 * workers. Rows must be committed to be visible across connections, so this class truncates
 * the inquiries table instead of wrapping each test in a transaction, and empties it again
 * afterwards for the transactional tests.
 */
class SubmitInquiryConcurrencyTest extends TestCase
{
    use DatabaseTruncation;

    /**
     * @var list<string>
     */
    protected array $tablesToTruncate = ['inquiries'];

    /**
     * A failed assertion can leave this test's transaction open; its locks would block the
     * next test's truncation, so roll it back before cleaning up.
     */
    protected function tearDown(): void
    {
        while (DB::transactionLevel() > 0) {
            DB::rollBack();
        }

        Inquiry::query()->delete();

        parent::tearDown();
    }

    /**
     * @param  array<string, mixed>  $overrides
     * @return array<string, mixed>
     */
    private function payload(array $overrides = []): array
    {
        return [
            'name' => 'Rina Pratiwi',
            'organization' => 'Toko Sinar Jaya',
            'contact' => 'rina@example.com',
            'service' => 'sistem-informasi',
            'budget' => '10-50jt',
            'timeline' => '1-3-bulan',
            'message' => 'Kami butuh sistem stok untuk tiga cabang toko.',
            ...$overrides,
        ];
    }

    /**
     * Start a worker that posts the payload once `$startAt` (Unix time) is reached.
     *
     * @param  array<string, mixed>  $payload
     */
    private function startWorker(array $payload, string $key, float $startAt): InvokedProcess
    {
        return Process::path(base_path())
            ->timeout(120)
            ->input((string) json_encode($payload))
            ->start([PHP_BINARY, 'tests/Support/submit-inquiry-worker.php', $key, sprintf('%.6F', $startAt)]);
    }

    /**
     * @return array{status: int, body: array<string, mixed>|null, replayed: bool}
     */
    private function resultOf(InvokedProcess $worker): array
    {
        $result = $worker->wait();

        if (! $result->successful()) {
            throw new RuntimeException('Worker failed: '.$result->errorOutput());
        }

        return json_decode($result->output(), true, flags: JSON_THROW_ON_ERROR);
    }

    /**
     * Wait until another connection of the test user is executing an inquiry insert, which
     * means it is blocked on the row lock held by this test's open transaction.
     */
    private function waitForABlockedInsert(): void
    {
        $deadline = microtime(true) + 20;

        $ownConnection = (int) DB::selectOne('select connection_id() as id')->id;

        while (microtime(true) < $deadline) {
            $blocked = collect(DB::select('show processlist'))->contains(
                fn (object $thread): bool => (int) $thread->Id !== $ownConnection
                    && str_starts_with(strtolower((string) $thread->Info), 'insert into `inquiries`'),
            );

            if ($blocked) {
                return;
            }

            usleep(50_000);
        }

        $this->fail('The worker never reached the insert.');
    }

    public function test_simultaneous_retries_with_one_key_store_exactly_one_inquiry(): void
    {
        $key = Str::uuid()->toString();
        $startAt = microtime(true) + 3;

        $workers = array_map(fn (): InvokedProcess => $this->startWorker($this->payload(), $key, $startAt), range(1, 6));
        $results = array_map($this->resultOf(...), $workers);

        $this->assertSame(array_fill(0, 6, 201), array_column($results, 'status'));
        $this->assertCount(1, array_unique(array_map(fn (array $result): string => $result['body']['id'], $results)));
        $this->assertSame(1, count(array_filter(array_column($results, 'replayed'), fn (bool $replayed): bool => ! $replayed)));
        $this->assertSame(Inquiry::sole()->public_id, $results[0]['body']['id']);
        $this->assertSame(Inquiry::hashIdempotencyKey($key), Inquiry::sole()->idempotency_key_hash);
    }

    public function test_simultaneous_requests_with_one_key_and_different_content_store_one_and_conflict_the_rest(): void
    {
        $key = Str::uuid()->toString();
        $startAt = microtime(true) + 3;
        $other = $this->payload(['message' => 'Isi berbeda: kami butuh website katering.']);

        $workers = [
            ...array_map(fn (): InvokedProcess => $this->startWorker($this->payload(), $key, $startAt), range(1, 3)),
            ...array_map(fn (): InvokedProcess => $this->startWorker($other, $key, $startAt), range(1, 3)),
        ];
        $results = array_map($this->resultOf(...), $workers);

        $stored = Inquiry::sole();
        $winners = $stored->message === $other['message'] ? array_slice($results, 3) : array_slice($results, 0, 3);
        $losers = $stored->message === $other['message'] ? array_slice($results, 0, 3) : array_slice($results, 3);
        $this->assertSame([201, 201, 201], array_column($winners, 'status'));
        $this->assertSame([$stored->public_id], array_values(array_unique(array_map(fn (array $result): string => $result['body']['id'], $winners))));
        $this->assertSame([409, 409, 409], array_column($losers, 'status'));
        $this->assertStringNotContainsString($stored->public_id, (string) json_encode($losers));
    }

    public function test_a_request_blocked_by_an_uncommitted_insert_returns_that_inquiry_once_it_commits(): void
    {
        $key = Str::uuid()->toString();
        DB::beginTransaction();
        $first = Inquiry::factory()->create([...$this->payload(), 'idempotency_key_hash' => Inquiry::hashIdempotencyKey($key)]);

        $worker = $this->startWorker($this->payload(), $key, 0);
        $this->waitForABlockedInsert();
        $this->assertTrue($worker->running());
        DB::commit();

        $result = $this->resultOf($worker);
        $this->assertSame(201, $result['status']);
        $this->assertSame(['id' => $first->public_id, 'status' => 'received'], $result['body']);
        $this->assertTrue($result['replayed']);
        $this->assertSame(1, Inquiry::query()->count());
    }

    public function test_a_request_blocked_by_an_insert_that_rolls_back_stores_its_own_inquiry(): void
    {
        $key = Str::uuid()->toString();
        DB::beginTransaction();
        $abandoned = Inquiry::factory()->create([...$this->payload(), 'idempotency_key_hash' => Inquiry::hashIdempotencyKey($key)]);

        $worker = $this->startWorker($this->payload(), $key, 0);
        $this->waitForABlockedInsert();
        DB::rollBack();

        $result = $this->resultOf($worker);
        $this->assertSame(201, $result['status']);
        $this->assertFalse($result['replayed']);
        $this->assertNotSame($abandoned->public_id, $result['body']['id']);
        $this->assertSame($result['body']['id'], Inquiry::sole()->public_id);
        $this->assertSame(Inquiry::hashIdempotencyKey($key), Inquiry::sole()->idempotency_key_hash);
    }

    public function test_a_request_blocked_by_an_insert_with_other_content_gets_a_conflict(): void
    {
        $key = Str::uuid()->toString();
        DB::beginTransaction();
        Inquiry::factory()->create([...$this->payload(['name' => 'Budi Santoso']), 'idempotency_key_hash' => Inquiry::hashIdempotencyKey($key)]);

        $worker = $this->startWorker($this->payload(), $key, 0);
        $this->waitForABlockedInsert();
        DB::commit();

        $this->assertSame(409, $this->resultOf($worker)['status']);
        $this->assertSame('Budi Santoso', Inquiry::sole()->name);
    }
}
