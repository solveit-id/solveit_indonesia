<?php

namespace Tests\Feature\Admin;

use App\Enums\AdminAuditAction;
use App\Enums\InquiryStatus;
use App\Models\AdminAuditEvent;
use App\Models\Inquiry;
use App\Models\InquiryNote;
use App\Models\InquiryStatusChange;
use App\Models\User;
use Illuminate\Contracts\Process\InvokedProcess;
use Illuminate\Foundation\Testing\DatabaseTruncation;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Process;
use Illuminate\Support\Facades\Schema;
use RuntimeException;
use Tests\TestCase;

/**
 * Inquiry management under real concurrency (B4a): every operation runs in its own PHP
 * process with its own MySQL connection (tests/Support/inquiry-workflow-worker.php),
 * released at the same instant, like independent PHP-FPM workers. Rows must be committed
 * to be visible across connections, so this class truncates its tables instead of wrapping
 * each test in a transaction, and empties them again afterwards.
 *
 * TRUNCATE is DDL and does not fire the append-only triggers; only this disposable test
 * database's user may run it (the production application user has no DDL privilege).
 */
class AdminInquiryConcurrencyTest extends TestCase
{
    use DatabaseTruncation;

    /**
     * Each scenario is repeated, so a lucky interleaving cannot hide a race.
     */
    private const ROUNDS = 3;

    /**
     * @var list<string>
     */
    protected array $tablesToTruncate = ['inquiry_notes', 'inquiry_status_changes', 'inquiries', 'admin_access_links', 'admin_audit_events', 'sessions', 'users'];

    protected function tearDown(): void
    {
        while (DB::transactionLevel() > 0) {
            DB::rollBack();
        }

        Schema::withoutForeignKeyConstraints(function (): void {
            foreach ($this->tablesToTruncate as $table) {
                DB::table($table)->truncate();
            }
        });

        parent::tearDown();
    }

    /**
     * Six people read `received` and decide at the same moment. Exactly one change lands;
     * the others learn that the status changed (or find it already where they wanted it),
     * and the history and audit log hold exactly one step.
     */
    public function test_simultaneous_status_changes_from_the_same_read_let_exactly_one_win(): void
    {
        $admins = User::factory()->activeAdmin()->count(3)->create();
        $targets = ['in-review', 'contacted', 'closed'];

        for ($round = 1; $round <= self::ROUNDS; $round++) {
            $inquiry = Inquiry::factory()->create();

            $results = $this->runAtOnce(array_map(
                fn (int $index): array => ['operation' => 'change-status', 'actor_id' => $admins[$index % 3]->id, 'inquiry_id' => $inquiry->id, 'status' => $targets[$index % 3], 'expected' => 'received'],
                range(0, 5),
            ));

            $winners = array_values(array_filter($results, fn (array $result): bool => $result['outcome'] === 'ok' && $result['changed']));
            $this->assertCount(1, $winners, "round {$round}: ".json_encode($results));
            $final = $winners[0]['status'];

            foreach ($results as $result) {
                $this->assertTrue(
                    ($result['outcome'] === 'ok' && $result['status'] === $final)
                    || ($result['outcome'] === 'conflict' && $result['code'] === 'status_changed'),
                    "round {$round}: ".json_encode($results),
                );
            }

            $this->assertSame($final, $inquiry->fresh()->status->value, "round {$round}");
            $change = InquiryStatusChange::query()->where('inquiry_id', $inquiry->id)->sole();
            $this->assertSame([InquiryStatus::Received->value, $final], [$change->from_status->value, $change->to_status->value]);
            $this->assertSame(1, AdminAuditEvent::query()->where('action', AdminAuditAction::InquiryStatusChanged)->where('subject_id', $inquiry->id)->count());
        }
    }

    /**
     * Notes are appended, never merged or lost: every concurrent note is stored once, each
     * with its own audit event.
     */
    public function test_simultaneous_notes_are_all_kept_with_one_audit_event_each(): void
    {
        $admins = User::factory()->activeAdmin()->count(2)->create();
        $inquiry = Inquiry::factory()->create();

        $results = $this->runAtOnce(array_map(
            fn (int $index): array => ['operation' => 'add-note', 'actor_id' => $admins[$index % 2]->id, 'inquiry_id' => $inquiry->id, 'body' => "Note {$index}."],
            range(0, 5),
        ));

        $this->assertSame(array_fill(0, 6, 'ok'), array_column($results, 'outcome'));
        $noteIds = array_column($results, 'id');
        $this->assertEqualsCanonicalizing($noteIds, InquiryNote::query()->where('inquiry_id', $inquiry->id)->pluck('id')->all());
        $this->assertEqualsCanonicalizing(
            array_map(fn (int $index): string => "Note {$index}.", range(0, 5)),
            InquiryNote::query()->pluck('body')->all(),
        );
        $this->assertEqualsCanonicalizing(
            $noteIds,
            AdminAuditEvent::query()->where('action', AdminAuditAction::InquiryNoteAdded)->get()->map(fn (AdminAuditEvent $event): int => (int) $event->metadata['note_id'])->all(),
        );
    }

    /**
     * An owner suspends an admin while that admin's status change, note, and contact reveal
     * are in flight. Whatever the interleaving, no write of the admin lands after the
     * suspension: each either committed before it (its audit event comes first) or was
     * refused with nothing written.
     */
    public function test_writes_racing_a_suspension_never_land_after_it(): void
    {
        $owner = User::factory()->owner()->create();

        for ($round = 1; $round <= self::ROUNDS; $round++) {
            $admin = User::factory()->activeAdmin()->create();
            $inquiry = Inquiry::factory()->create();

            $results = $this->runAtOnce([
                ['operation' => 'suspend', 'actor_id' => $owner->id, 'target_id' => $admin->id],
                ['operation' => 'change-status', 'actor_id' => $admin->id, 'inquiry_id' => $inquiry->id, 'status' => 'in-review', 'expected' => 'received'],
                ['operation' => 'add-note', 'actor_id' => $admin->id, 'inquiry_id' => $inquiry->id, 'body' => 'In flight.'],
                ['operation' => 'reveal', 'actor_id' => $admin->id, 'inquiry_id' => $inquiry->id],
            ]);

            $this->assertSame('ok', $results[0]['outcome'], "round {$round}");
            $suspension = AdminAuditEvent::query()->where('action', AdminAuditAction::AccountSuspended)->where('subject_id', $admin->id)->sole();
            $adminEvents = AdminAuditEvent::query()->where('actor_user_id', $admin->id)->where('subject_type', 'inquiry')->get();

            foreach ($adminEvents as $event) {
                $this->assertLessThan($suspension->id, $event->id, "round {$round}: {$event->action->value} landed after the suspension");
            }

            $landed = count(array_filter(array_slice($results, 1), fn (array $result): bool => $result['outcome'] === 'ok'));
            $refused = count(array_filter(array_slice($results, 1), fn (array $result): bool => $result['outcome'] === 'forbidden'));
            $this->assertSame(3, $landed + $refused, "round {$round}: ".json_encode($results));
            $this->assertSame($landed, $adminEvents->count(), "round {$round}: one audit event per landed write");
            $this->assertSame($results[1]['outcome'] === 'ok', InquiryStatusChange::query()->where('inquiry_id', $inquiry->id)->exists(), "round {$round}");
            $this->assertSame($results[2]['outcome'] === 'ok', InquiryNote::query()->where('inquiry_id', $inquiry->id)->exists(), "round {$round}");
        }
    }

    /**
     * Start one worker per operation, all released at the same instant.
     *
     * @param  list<array<string, mixed>>  $operations
     * @return list<array<string, mixed>>
     */
    private function runAtOnce(array $operations): array
    {
        $startAt = microtime(true) + 3;

        $workers = array_map(
            fn (array $operation): InvokedProcess => Process::path(base_path())
                ->timeout(120)
                ->input((string) json_encode($operation))
                ->start([PHP_BINARY, 'tests/Support/inquiry-workflow-worker.php', sprintf('%.6F', $startAt)]),
            $operations,
        );

        return array_map(function (InvokedProcess $worker): array {
            $result = $worker->wait();

            if (! $result->successful()) {
                throw new RuntimeException('Worker failed: '.$result->errorOutput().$result->output());
            }

            $outcome = json_decode($result->output(), true);

            if (! is_array($outcome)) {
                throw new RuntimeException('Worker printed no outcome: '.$result->output().$result->errorOutput());
            }

            return $outcome;
        }, $workers);
    }
}
