<?php

namespace Tests\Feature\Admin;

use App\Enums\AdminAccessLinkPurpose;
use App\Enums\AdminAuditAction;
use App\Enums\AdminRole;
use App\Models\AdminAccessLink;
use App\Models\AdminAuditEvent;
use App\Models\User;
use Illuminate\Contracts\Process\InvokedProcess;
use Illuminate\Foundation\Testing\DatabaseTruncation;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Process;
use Illuminate\Support\Facades\Schema;
use RuntimeException;
use Tests\TestCase;

/**
 * Owner administration under real concurrency (B3.1b): every operation runs in its own
 * PHP process with its own MySQL connection (tests/Support/admin-administration-worker.php),
 * released at the same instant, like independent PHP-FPM workers. Rows must be committed
 * to be visible across connections, so this class truncates its tables instead of
 * wrapping each test in a transaction, and empties them again afterwards.
 *
 * TRUNCATE is DDL and does not fire the append-only triggers of admin_audit_events; only
 * this disposable test database's user may run it (the production application user has
 * no DDL privilege).
 */
class AdminAdministrationConcurrencyTest extends TestCase
{
    use DatabaseTruncation;

    /**
     * Each scenario is repeated, so a lucky interleaving cannot hide a race.
     */
    private const ROUNDS = 3;

    /**
     * @var list<string>
     */
    protected array $tablesToTruncate = ['admin_access_links', 'admin_audit_events', 'sessions', 'users'];

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

    public function test_simultaneous_invitations_for_one_new_address_create_one_account_and_one_link(): void
    {
        for ($round = 1; $round <= self::ROUNDS; $round++) {
            $owners = User::factory()->owner()->count(2)->create();
            $email = "invitee-{$round}@example.com";

            $results = $this->runAtOnce(array_map(
                fn (int $index): array => ['operation' => 'invite', 'actor_id' => $owners[$index % 2]->id, 'email' => $email, 'role' => $index % 2 === 0 ? 'admin' : 'owner'],
                range(0, 5),
            ));

            $this->assertSame(1, $this->countOutcome($results, 'ok'), "round {$round}");
            $this->assertSame(5, $this->countOutcome($results, 'conflict', 'invitation_pending'), "round {$round}");
            $account = User::query()->where('email', $email)->sole();
            $this->assertSame(1, AdminAccessLink::query()->where('user_id', $account->id)->count());
            $this->assertSame(1, AdminAccessLink::query()->where('user_id', $account->id)->whereNull('revoked_at')->count());
            $this->assertSame(1, AdminAuditEvent::query()->where('action', AdminAuditAction::InvitationIssued)->where('subject_id', $account->id)->count());
        }
    }

    public function test_simultaneous_reinvitations_of_a_pending_account_leave_one_open_link(): void
    {
        $owner = User::factory()->owner()->create();
        $pending = User::factory()->pendingActivation()->create();

        for ($round = 1; $round <= self::ROUNDS; $round++) {
            AdminAccessLink::query()->where('user_id', $pending->id)->whereNull('revoked_at')->update(['revoked_at' => now()]);

            $results = $this->runAtOnce(array_fill(0, 4, ['operation' => 'invite', 'actor_id' => $owner->id, 'email' => $pending->email, 'role' => 'admin']));

            $this->assertSame(1, $this->countOutcome($results, 'ok'), "round {$round}");
            $this->assertSame(3, $this->countOutcome($results, 'conflict', 'invitation_pending'), "round {$round}");
            $this->assertSame(1, AdminAccessLink::query()->where('user_id', $pending->id)->whereNull('revoked_at')->whereNull('completed_at')->count());
        }

        $this->assertSame(1, User::query()->where('email', $pending->email)->count());
    }

    public function test_two_owners_demoting_each_other_at_once_leave_one_owner(): void
    {
        $this->assertOneOwnerSurvives(fn (User $first, User $second): array => [
            ['operation' => 'change-role', 'actor_id' => $first->id, 'target_id' => $second->id, 'role' => 'admin'],
            ['operation' => 'change-role', 'actor_id' => $second->id, 'target_id' => $first->id, 'role' => 'admin'],
        ]);
    }

    public function test_two_owners_suspending_each_other_at_once_leave_one_owner(): void
    {
        $this->assertOneOwnerSurvives(fn (User $first, User $second): array => [
            ['operation' => 'suspend', 'actor_id' => $first->id, 'target_id' => $second->id],
            ['operation' => 'suspend', 'actor_id' => $second->id, 'target_id' => $first->id],
        ]);
    }

    public function test_two_owners_resetting_each_other_at_once_leave_one_owner_able_to_sign_in(): void
    {
        $this->assertOneOwnerSurvives(fn (User $first, User $second): array => [
            ['operation' => 'reset', 'actor_id' => $first->id, 'target_id' => $second->id],
            ['operation' => 'reset', 'actor_id' => $second->id, 'target_id' => $first->id],
        ]);

        $this->assertSame(self::ROUNDS, AdminAccessLink::query()->where('purpose', AdminAccessLinkPurpose::CredentialReset)->count(), 'one reset per round');
    }

    public function test_a_suspension_racing_a_reset_leaves_one_owner(): void
    {
        $this->assertOneOwnerSurvives(fn (User $first, User $second): array => [
            ['operation' => 'suspend', 'actor_id' => $first->id, 'target_id' => $second->id],
            ['operation' => 'reset', 'actor_id' => $second->id, 'target_id' => $first->id],
        ]);
    }

    /**
     * Run the operations of two fresh owners at once, ROUNDS times. Exactly one operation
     * may win; every other one finds its actor no longer an active owner (403); exactly
     * one active owner remains, and the winner is that owner.
     *
     * @param  \Closure(User, User): list<array<string, mixed>>  $operations
     */
    private function assertOneOwnerSurvives(\Closure $operations): void
    {
        for ($round = 1; $round <= self::ROUNDS; $round++) {
            [$first, $second] = User::factory()->owner()->count(2)->create()->all();

            $planned = $operations($first, $second);
            $results = $this->runAtOnce($planned);

            $this->assertSame(1, $this->countOutcome($results, 'ok'), "round {$round}: ".json_encode($results));
            $this->assertSame(count($planned) - 1, $this->countOutcome($results, 'forbidden'), "round {$round}: ".json_encode($results));

            $survivors = User::query()->whereKey([$first->id, $second->id])->get()->filter(
                fn (User $owner): bool => $owner->role === AdminRole::Owner && $owner->canSignInToAdmin(),
            );
            $this->assertCount(1, $survivors, "round {$round}");

            $winner = $planned[array_search('ok', array_column($results, 'outcome'), true)];
            $this->assertSame($winner['actor_id'], $survivors->first()->id, "round {$round}: the winner is the remaining owner");
        }
    }

    /**
     * Start one worker per operation, all released at the same instant.
     *
     * @param  list<array<string, mixed>>  $operations
     * @return list<array{outcome: string, code?: string, id?: int}>
     */
    private function runAtOnce(array $operations): array
    {
        $startAt = microtime(true) + 3;

        $workers = array_map(
            fn (array $operation): InvokedProcess => Process::path(base_path())
                ->timeout(120)
                ->input((string) json_encode($operation))
                ->start([PHP_BINARY, 'tests/Support/admin-administration-worker.php', sprintf('%.6F', $startAt)]),
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

    /**
     * @param  list<array{outcome: string, code?: string}>  $results
     */
    private function countOutcome(array $results, string $outcome, ?string $code = null): int
    {
        return count(array_filter(
            $results,
            fn (array $result): bool => $result['outcome'] === $outcome && ($code === null || ($result['code'] ?? null) === $code),
        ));
    }
}
