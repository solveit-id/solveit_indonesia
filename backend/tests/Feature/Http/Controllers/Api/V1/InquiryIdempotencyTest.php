<?php

namespace Tests\Feature\Http\Controllers\Api\V1;

use App\Models\Inquiry;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Exceptions;
use Illuminate\Support\Facades\Log;
use Illuminate\Testing\TestResponse;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * Idempotency-Key on POST /api/v1/inquiries (B2.1). Contract: docs/api/inquiries.md.
 * Behaviour under concurrent processes: tests/Feature/Actions/SubmitInquiryConcurrencyTest.php.
 */
class InquiryIdempotencyTest extends TestCase
{
    use RefreshDatabase;

    private const ENDPOINT = '/api/v1/inquiries';

    private const KEY = '3f2b8c1e-9d4a-4b7e-8c21-5a6f0e9d1b42';

    private const OTHER_KEY = 'a1c9e4f7-2b3d-4e8a-9f60-7d1c2b3a4e5f';

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
     * @param  array<string, mixed>  $payload
     */
    private function submit(array $payload, ?string $key = self::KEY): TestResponse
    {
        return $this->postJson(self::ENDPOINT, $payload, $key === null ? [] : ['Idempotency-Key' => $key]);
    }

    public function test_first_submission_with_a_key_stores_one_inquiry_with_only_the_key_hash(): void
    {
        $response = $this->submit($this->payload());

        $response->assertCreated()
            ->assertExactJson(['id' => Inquiry::sole()->public_id, 'status' => 'received'])
            ->assertHeaderMissing('Idempotent-Replayed');
        $this->assertSame(hash('sha256', self::KEY), Inquiry::sole()->idempotency_key_hash);
        $this->assertStringNotContainsString(self::KEY, (string) json_encode(Inquiry::sole()->getAttributes()));
    }

    /**
     * The visitor's connection dropped after the server committed: the retry recovers the
     * stored reference instead of creating a duplicate.
     */
    public function test_retry_after_a_lost_response_returns_the_original_reference_without_a_new_row(): void
    {
        $original = $this->submit($this->payload())->assertCreated()->json('id');

        $retry = $this->submit($this->payload());

        $retry->assertCreated()
            ->assertExactJson(['id' => $original, 'status' => 'received'])
            ->assertHeader('Idempotent-Replayed', 'true');
        $this->assertDatabaseCount('inquiries', 1);
    }

    /**
     * Equivalence is decided on the validated, canonical values: whitespace that the server
     * trims, an empty or omitted organization, field order, ignored extra fields, an empty
     * honeypot, and the key's letter case make no difference.
     *
     * @param  array<string, mixed>  $retryPayload
     */
    #[DataProvider('equivalentRetries')]
    public function test_retry_with_an_equivalent_payload_is_answered_with_the_stored_inquiry(array $firstPayload, array $retryPayload, string $retryKey): void
    {
        $original = $this->submit($firstPayload)->assertCreated()->json('id');

        $this->submit($retryPayload, $retryKey)
            ->assertCreated()
            ->assertJsonPath('id', $original)
            ->assertHeader('Idempotent-Replayed', 'true');
        $this->assertDatabaseCount('inquiries', 1);
    }

    /**
     * @return array<string, array{array<string, mixed>, array<string, mixed>, string}>
     */
    public static function equivalentRetries(): array
    {
        $payload = [
            'name' => 'Rina Pratiwi',
            'organization' => 'Toko Sinar Jaya',
            'contact' => 'rina@example.com',
            'service' => 'sistem-informasi',
            'budget' => '10-50jt',
            'timeline' => '1-3-bulan',
            'message' => 'Kami butuh sistem stok untuk tiga cabang toko.',
        ];
        $withoutOrganization = array_diff_key($payload, ['organization' => true]);

        return [
            'surrounding whitespace' => [$payload, [...$payload, 'name' => '  Rina Pratiwi ', 'message' => ' Kami butuh sistem stok untuk tiga cabang toko.  '], self::KEY],
            'omitted then empty organization' => [$withoutOrganization, [...$withoutOrganization, 'organization' => ''], self::KEY],
            'empty then blank organization' => [[...$payload, 'organization' => ''], [...$payload, 'organization' => '   '], self::KEY],
            'different field order' => [$payload, array_reverse($payload, true), self::KEY],
            'ignored extra fields and empty honeypot' => [$payload, [...$payload, 'status' => 'approved', 'locale' => 'en', 'homepage' => ''], self::KEY],
            'uppercase key' => [$payload, $payload, strtoupper(self::KEY)],
        ];
    }

    /**
     * @param  array<string, mixed>  $changes
     */
    #[DataProvider('changedContent')]
    public function test_same_key_with_different_content_returns_409_and_stores_nothing(array $changes): void
    {
        $original = $this->submit($this->payload())->assertCreated()->json('id');

        $response = $this->submit($this->payload($changes));

        $response->assertConflict()
            ->assertExactJson(['message' => 'This Idempotency-Key was already used for a different inquiry. Send a new submission with a new key.'])
            ->assertHeaderMissing('Idempotent-Replayed');
        $this->assertStringNotContainsString($original, (string) $response->getContent());
        $this->assertDatabaseCount('inquiries', 1);
        $this->assertSame('Kami butuh sistem stok untuk tiga cabang toko.', Inquiry::sole()->message);
    }

    /**
     * @return array<string, array{array<string, mixed>}>
     */
    public static function changedContent(): array
    {
        return [
            'message' => [['message' => 'Kami butuh sistem stok untuk empat cabang toko.']],
            'name case' => [['name' => 'rina pratiwi']],
            'organization removed' => [['organization' => null]],
            'contact' => [['contact' => 'rina@example.org']],
            'service' => [['service' => 'website']],
            'budget' => [['budget' => 'belum-tahu']],
            'timeline' => [['timeline' => 'segera']],
        ];
    }

    public function test_different_keys_with_identical_content_are_independent_inquiries(): void
    {
        $first = $this->submit($this->payload())->assertCreated()->json('id');
        $second = $this->submit($this->payload(), self::OTHER_KEY)->assertCreated()->assertHeaderMissing('Idempotent-Replayed')->json('id');

        $this->assertNotSame($first, $second);
        $this->assertDatabaseCount('inquiries', 2);
    }

    /**
     * Without the header nothing changes from B1, and nothing protects against duplicates.
     */
    public function test_requests_without_a_key_keep_the_unprotected_behaviour(): void
    {
        $this->submit($this->payload(), null)->assertCreated()->assertHeaderMissing('Idempotent-Replayed');
        $this->submit($this->payload(), null)->assertCreated()->assertHeaderMissing('Idempotent-Replayed');

        $this->assertDatabaseCount('inquiries', 2);
        $this->assertSame([null, null], Inquiry::query()->pluck('idempotency_key_hash')->all());
    }

    #[DataProvider('malformedKeys')]
    public function test_malformed_key_returns_400_before_validation_and_stores_nothing(string $key): void
    {
        $response = $this->submit([], $key);

        $response->assertBadRequest()
            ->assertExactJson(['message' => 'The Idempotency-Key header must be a single UUID (version 4).']);
        $this->assertDatabaseEmpty('inquiries');
    }

    /**
     * @return array<string, array{string}>
     */
    public static function malformedKeys(): array
    {
        return [
            'empty' => [''],
            'free text' => ['retry-1'],
            'version 1 UUID' => ['3f2b8c1e-9d4a-1b7e-8c21-5a6f0e9d1b42'],
            'wrong variant' => ['3f2b8c1e-9d4a-4b7e-cc21-5a6f0e9d1b42'],
            'without hyphens' => ['3f2b8c1e9d4a4b7e8c215a6f0e9d1b42'],
            'braces' => ['{3f2b8c1e-9d4a-4b7e-8c21-5a6f0e9d1b42}'],
            'two keys in one header' => ['3f2b8c1e-9d4a-4b7e-8c21-5a6f0e9d1b42, a1c9e4f7-2b3d-4e8a-9f60-7d1c2b3a4e5f'],
            'too long' => [str_repeat('3f2b8c1e-9d4a-4b7e-8c21-5a6f0e9d1b42', 30)],
        ];
    }

    /**
     * A failed insert leaves no completed result behind: the same key can be used again.
     */
    public function test_storage_failure_does_not_consume_the_key(): void
    {
        Exceptions::fake();
        $rejectNextInsert = true;
        Inquiry::creating(function (Inquiry $inquiry) use (&$rejectNextInsert): void {
            if ($rejectNextInsert) {
                $rejectNextInsert = false;
                $inquiry->name = str_repeat('x', 121);
            }
        });

        $this->submit($this->payload())->assertServiceUnavailable();
        $this->assertDatabaseEmpty('inquiries');

        $this->submit($this->payload())->assertCreated()->assertHeaderMissing('Idempotent-Replayed');
        $this->assertSame(hash('sha256', self::KEY), Inquiry::sole()->idempotency_key_hash);
    }

    public function test_rejected_submissions_do_not_consume_the_key(): void
    {
        $this->submit($this->payload(['homepage' => 'https://spam.example']))->assertUnprocessable();
        $this->submit($this->payload(['message' => 'terlalu pendek']))->assertUnprocessable();
        $this->assertDatabaseEmpty('inquiries');

        $this->submit($this->payload())->assertCreated()->assertHeaderMissing('Idempotent-Replayed');
    }

    public function test_retries_still_count_toward_the_rate_limit(): void
    {
        config(['inquiries.rate_limit.per_minute' => 2]);

        $this->submit($this->payload())->assertCreated();
        $this->submit($this->payload())->assertCreated()->assertHeader('Idempotent-Replayed', 'true');

        $this->submit($this->payload())->assertTooManyRequests();
        $this->assertDatabaseCount('inquiries', 1);
    }

    /**
     * Rows stored before B2.1 (or without the header) have no key hash and never match one.
     */
    public function test_inquiries_without_a_key_never_answer_a_keyed_request(): void
    {
        Inquiry::factory()->count(2)->create([...$this->payload(), 'idempotency_key_hash' => null]);

        $this->submit($this->payload())->assertCreated()->assertHeaderMissing('Idempotent-Replayed');

        $this->assertDatabaseCount('inquiries', 3);
    }

    public function test_logs_hold_only_the_reference_and_never_the_key_or_personal_data(): void
    {
        Log::spy();

        $id = $this->submit($this->payload())->json('id');
        $this->submit($this->payload());
        $this->submit($this->payload(['message' => 'Kami butuh sistem stok untuk empat cabang toko.']))->assertConflict();

        Log::shouldHaveReceived('info')->with('Inquiry received.', ['inquiry' => $id])->once();
        Log::shouldHaveReceived('info')->with('Inquiry retry answered with the stored reference.', ['inquiry' => $id])->once();
        Log::shouldHaveReceived('notice')->with('Inquiry idempotency key reused with different content.')->once();
    }

    public function test_preflight_from_an_allowed_origin_allows_the_idempotency_key_header(): void
    {
        config(['cors.allowed_origins' => ['http://localhost:5173']]);

        $response = $this->options(self::ENDPOINT, [], [
            'Origin' => 'http://localhost:5173',
            'Access-Control-Request-Method' => 'POST',
            'Access-Control-Request-Headers' => 'content-type, idempotency-key',
        ]);

        $response->assertNoContent()->assertHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
        $this->assertStringContainsStringIgnoringCase('idempotency-key', (string) $response->headers->get('Access-Control-Allow-Headers'));
    }

    public function test_preflight_from_an_unlisted_origin_gets_no_grant_for_the_header(): void
    {
        config(['cors.allowed_origins' => ['http://localhost:5173', 'http://localhost:4173']]);

        $this->options(self::ENDPOINT, [], [
            'Origin' => 'https://evil.example',
            'Access-Control-Request-Method' => 'POST',
            'Access-Control-Request-Headers' => 'content-type, idempotency-key',
        ])->assertHeaderMissing('Access-Control-Allow-Origin');
    }

    public function test_allowed_origin_can_read_the_replay_header(): void
    {
        config(['cors.allowed_origins' => ['http://localhost:5173']]);
        $this->submit($this->payload());

        $response = $this->postJson(self::ENDPOINT, $this->payload(), ['Idempotency-Key' => self::KEY, 'Origin' => 'http://localhost:5173']);

        $response->assertHeader('Idempotent-Replayed', 'true');
        $this->assertStringContainsString('Idempotent-Replayed', (string) $response->headers->get('Access-Control-Expose-Headers'));
    }
}
