<?php

namespace Tests\Feature\Admin;

use App\Enums\AdminAuditAction;
use App\Enums\AdminRole;
use App\Models\AdminAccessLink;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Testing\TestResponse;
use PHPUnit\Framework\Attributes\DataProvider;
use PragmaRX\Google2FA\Google2FA;
use Tests\Support\InteractsWithAdminApi;
use Tests\TestCase;

/**
 * Owner-issued credential reset (B3.1b): the target loses access at once, recovers only
 * with a new password AND a new authenticator, and a lost, expired, or abandoned link is
 * replaced by issuing again. There is no path back in with one factor.
 */
class AdminCredentialRecoveryTest extends TestCase
{
    use InteractsWithAdminApi;
    use RefreshDatabase;

    /**
     * Error bodies are asserted as production returns them (APP_DEBUG=false, required
     * outside local development); CI runs the suite with APP_DEBUG=true.
     */
    protected function setUp(): void
    {
        parent::setUp();

        config(['app.debug' => false]);
    }

    private const NEW_PASSWORD = 'a brand new passphrase';

    public function test_a_reset_locks_the_account_out_until_password_and_totp_are_replaced(): void
    {
        $admin = $this->createActiveAdmin();
        $oldSecret = $this->totpSecret($admin);
        $this->usingAdminClient('admin')->signIn($admin);
        $this->usingAdminClient('owner');
        $owner = $this->signInConfirmedOwner();

        $response = $this->issueReset($admin)->assertCreated()
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonPath('data.account.status', 'credential-reset-pending')
            ->assertJsonPath('data.account.two_factor_confirmed', false)
            ->assertJsonPath('data.account.active_sessions', 0)
            ->assertJsonPath('data.access_link.purpose', 'credential-reset');
        $token = $this->tokenFromAccessLink($response->json('data.access_link.url'));
        $this->assertSame(now()->addHours(24)->toIso8601String(), $response->json('data.access_link.expires_at'));

        // Sessions end at once; the old password alone is useless, so is the old authenticator.
        $this->usingAdminClient('admin')->adminRequest('GET', 'me')->assertUnauthorized();
        $this->usingAdminClient('password-only');
        $this->adminRequest('GET', 'auth/csrf-cookie');
        $this->adminRequest('POST', 'auth/login', ['email' => $admin->email, 'password' => self::ADMIN_PASSWORD])->assertUnprocessable();

        $this->usingAdminClient('recovering');
        $setupKey = $this->redeem($token)->json('data.two_factor.setup_key');
        $this->assertNotSame($oldSecret, $setupKey);
        $this->adminRequest('POST', 'access-links/confirm', ['code' => (new Google2FA)->getCurrentOtp($setupKey)])->assertOk();

        $this->usingAdminClient('later');
        $this->adminRequest('GET', 'auth/csrf-cookie');
        $this->adminRequest('POST', 'auth/login', ['email' => $admin->email, 'password' => self::ADMIN_PASSWORD])->assertUnprocessable();
        $this->signIn($admin->fresh(), self::NEW_PASSWORD);
        $this->adminRequest('GET', 'me')->assertOk();

        $this->assertDatabaseHas('admin_audit_events', ['action' => AdminAuditAction::CredentialResetIssued->value, 'actor_type' => 'user', 'actor_user_id' => $owner->id, 'subject_id' => $admin->id]);
        $this->assertDatabaseHas('admin_audit_events', ['action' => AdminAuditAction::CredentialResetCompleted->value, 'subject_id' => $admin->id]);
    }

    public function test_the_owner_must_acknowledge_the_loss_of_access(): void
    {
        $admin = $this->createActiveAdmin();
        $this->signInConfirmedOwner();

        foreach ([[], ['acknowledge_access_loss' => false], ['acknowledge_access_loss' => 'maybe']] as $body) {
            $this->adminRequest('POST', "users/{$admin->id}/credential-reset", $body)
                ->assertUnprocessable()
                ->assertJsonValidationErrors(['acknowledge_access_loss' => 'Confirm that the account loses access until the reset link is completed.']);
        }

        $this->assertTrue($admin->fresh()->canSignInToAdmin());
        $this->assertSame(0, AdminAccessLink::query()->count());
    }

    public function test_a_lost_or_expired_link_is_replaced_and_the_old_one_stops_working(): void
    {
        $admin = $this->createActiveAdmin();
        $this->usingAdminClient('owner')->signInConfirmedOwner();
        $lost = $this->tokenFromAccessLink($this->issueReset($admin)->json('data.access_link.url'));

        // Issuing again while the reset is pending is allowed and replaces the link.
        $replacement = $this->tokenFromAccessLink($this->issueReset($admin)->assertCreated()->json('data.access_link.url'));
        $this->assertSame(1, AdminAccessLink::query()->whereNull('revoked_at')->count());

        $this->usingAdminClient('recovering');
        $this->adminRequest('GET', 'auth/csrf-cookie');
        $this->adminRequest('POST', 'access-links/inspect', ['token' => $lost])->assertNotFound();

        // A day later the old session is long gone: a fresh browser, as in real life (a
        // stale session cookie can lose its row to the session garbage collector).
        $this->travel(24)->hours();
        $this->travel(1)->minutes();
        $this->usingAdminClient('recovering-next-day');
        $this->adminRequest('GET', 'auth/csrf-cookie');
        $this->adminRequest('POST', 'access-links/inspect', ['token' => $replacement])->assertNotFound();
        $this->assertFalse($admin->fresh()->canSignInToAdmin(), 'an expired reset never restores access');

        $this->usingAdminClient('owner-again');
        $this->signInConfirmedOwner();
        $fresh = $this->tokenFromAccessLink($this->issueReset($admin)->assertCreated()->json('data.access_link.url'));
        $this->usingAdminClient('recovering-next-day');
        $this->adminRequest('GET', 'auth/csrf-cookie');
        $this->adminRequest('POST', 'access-links/inspect', ['token' => $fresh])->assertOk()->assertJsonPath('data.purpose', 'credential-reset');
    }

    public function test_an_interrupted_recovery_keeps_the_account_locked_and_can_be_restarted(): void
    {
        $admin = $this->createActiveAdmin();
        $this->usingAdminClient('owner')->signInConfirmedOwner();
        $first = $this->tokenFromAccessLink($this->issueReset($admin)->json('data.access_link.url'));

        // The person sets a password and gets a secret, then never confirms a code.
        $this->usingAdminClient('recovering');
        $abandonedSetupKey = $this->redeem($first)->json('data.two_factor.setup_key');

        $this->usingAdminClient('password-only');
        $this->adminRequest('GET', 'auth/csrf-cookie');
        $this->adminRequest('POST', 'auth/login', ['email' => $admin->email, 'password' => self::NEW_PASSWORD])->assertUnprocessable();

        // The owner restarts the recovery; the half-finished enrollment is dead.
        $this->usingAdminClient('owner');
        $second = $this->tokenFromAccessLink($this->issueReset($admin)->assertCreated()->json('data.access_link.url'));
        $this->usingAdminClient('recovering');
        $this->adminRequest('POST', 'access-links/confirm', ['code' => (new Google2FA)->getCurrentOtp($abandonedSetupKey)])->assertNotFound();

        $this->usingAdminClient('recovering-again');
        $setupKey = $this->redeem($second)->json('data.two_factor.setup_key');
        $this->adminRequest('POST', 'access-links/confirm', ['code' => (new Google2FA)->getCurrentOtp($setupKey)])->assertOk();
        $this->assertTrue($admin->fresh()->canSignInToAdmin());
    }

    public function test_suspending_during_a_reset_revokes_the_link_for_good(): void
    {
        $admin = $this->createActiveAdmin();
        $this->usingAdminClient('owner')->signInConfirmedOwner();
        $token = $this->tokenFromAccessLink($this->issueReset($admin)->json('data.access_link.url'));

        $this->adminRequest('POST', "users/{$admin->id}/suspension")->assertOk();
        $this->adminRequest('DELETE', "users/{$admin->id}/suspension")->assertOk()->assertJsonPath('data.status', 'credential-reset-pending');

        $this->usingAdminClient('recovering');
        $this->adminRequest('GET', 'auth/csrf-cookie');
        $this->adminRequest('POST', 'access-links/inspect', ['token' => $token])->assertNotFound();
        $this->assertFalse($admin->fresh()->canSignInToAdmin());
    }

    /**
     * @return array<string, array{\Closure(): User, string}>
     */
    public static function accountsThatCannotBeReset(): array
    {
        return [
            'pending (use an invitation)' => [fn (): User => User::factory()->pendingActivation()->create(), 'not_activated'],
            'suspended' => [fn (): User => User::factory()->activeAdmin()->suspended()->create(), 'suspended'],
        ];
    }

    /**
     * @param  \Closure(): User  $makeAccount
     */
    #[DataProvider('accountsThatCannotBeReset')]
    public function test_only_activated_unsuspended_accounts_are_reset(\Closure $makeAccount, string $code): void
    {
        $account = $makeAccount();
        $before = $account->fresh()->getAttributes();
        $this->signInConfirmedOwner();

        $this->issueReset($account)->assertConflict()->assertJsonPath('code', $code);

        $this->assertSame($before, $account->fresh()->getAttributes());
        $this->assertSame(0, AdminAccessLink::query()->count());
    }

    public function test_an_owner_cannot_reset_their_own_credentials(): void
    {
        $owner = $this->signInConfirmedOwner();

        $this->issueReset($owner)->assertConflict()->assertJsonPath('code', 'own_account');

        $this->assertTrue($owner->fresh()->canSignInToAdmin());
        $this->adminRequest('GET', 'me')->assertOk();
    }

    public function test_an_owner_resets_another_owner_who_then_cannot_act_until_recovered(): void
    {
        $other = $this->createActiveAdmin(AdminRole::Owner);
        $this->usingAdminClient('other')->signIn($other);
        $this->usingAdminClient('owner');
        $owner = $this->signInConfirmedOwner();

        $this->issueReset($other)->assertCreated();

        // The reset owner is no longer an active owner: suspending them is not "the last one".
        $this->adminRequest('POST', "users/{$other->id}/suspension")->assertOk();
        $this->assertTrue($owner->fresh()->canSignInToAdmin());
        $this->assertSame(0, DB::table('sessions')->where('user_id', $other->id)->count());
    }

    public function test_a_failed_audit_write_resets_nothing(): void
    {
        $admin = $this->createActiveAdmin();
        $this->usingAdminClient('admin')->signIn($admin);
        $this->usingAdminClient('owner')->signInConfirmedOwner();
        $this->failAuditWritesFor(AdminAuditAction::CredentialResetIssued);

        $response = $this->issueReset($admin)->assertStatus(500)->assertExactJson(['message' => 'Server Error']);

        $this->assertStringNotContainsString('#token=', $response->getContent());
        $this->assertTrue($admin->fresh()->canSignInToAdmin());
        $this->assertSame(0, AdminAccessLink::query()->count());
        $this->usingAdminClient('admin')->adminRequest('GET', 'me')->assertOk();
    }

    private function issueReset(User $account): TestResponse
    {
        return $this->adminRequest('POST', "users/{$account->id}/credential-reset", ['acknowledge_access_loss' => true]);
    }

    private function redeem(string $token): TestResponse
    {
        $this->adminRequest('GET', 'auth/csrf-cookie');

        return $this->adminRequest('POST', 'access-links/redeem', [
            'token' => $token,
            'password' => self::NEW_PASSWORD,
            'password_confirmation' => self::NEW_PASSWORD,
        ])->assertOk();
    }
}
