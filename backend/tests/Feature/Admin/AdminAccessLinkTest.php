<?php

namespace Tests\Feature\Admin;

use App\Actions\Admin\BootstrapAdminOwner;
use App\Actions\Admin\ResetAdminCredentials;
use App\Enums\AdminActorType;
use App\Enums\AdminAuditAction;
use App\Enums\AdminRole;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Testing\TestResponse;
use Laravel\Fortify\Fortify;
use PragmaRX\Google2FA\Google2FA;
use Tests\Support\InteractsWithAdminApi;
use Tests\TestCase;

/**
 * Activation and credential reset through one-time access links.
 */
class AdminAccessLinkTest extends TestCase
{
    use InteractsWithAdminApi;
    use RefreshDatabase;

    private const NEW_PASSWORD = 'my own long passphrase';

    public function test_an_owner_is_activated_through_the_bootstrap_link(): void
    {
        $issued = app(BootstrapAdminOwner::class)->handle('Owner@Example.com');
        $this->adminRequest('GET', 'auth/csrf-cookie');

        $this->adminRequest('POST', 'access-links/inspect', ['token' => $issued->token])
            ->assertOk()
            ->assertJsonPath('data.purpose', 'activation')
            ->assertJsonPath('data.email', 'o***@example.com')
            ->assertJsonPath('data.requires_name', true);

        $redeemed = $this->adminRequest('POST', 'access-links/redeem', [
            'token' => $issued->token,
            'name' => 'Owner Name',
            'password' => self::NEW_PASSWORD,
            'password_confirmation' => self::NEW_PASSWORD,
        ])->assertOk();

        $this->assertStringStartsWith('<svg', $redeemed->json('data.two_factor.qr_code_svg'));
        $setupKey = $redeemed->json('data.two_factor.setup_key');
        $this->assertSame(32, strlen($setupKey), '160-bit secret');

        $confirmed = $this->adminRequest('POST', 'access-links/confirm', ['code' => (new Google2FA)->getCurrentOtp($setupKey)])->assertOk();

        $this->assertCount(8, $confirmed->json('data.recovery_codes'));
        $confirmed->assertJsonPath('data.account.role', 'owner')->assertJsonPath('data.account.name', 'Owner Name');

        $owner = User::query()->sole();
        $this->assertSame('owner@example.com', $owner->email);
        $this->assertTrue($owner->canSignInToAdmin());
        $this->assertTrue(Hash::check(self::NEW_PASSWORD, $owner->password));
        $this->adminRequest('GET', 'me')->assertOk()->assertJsonPath('data.permissions', self::OWNER_PERMISSIONS);
        $this->assertDatabaseHas('admin_audit_events', ['action' => AdminAuditAction::AccountActivated->value, 'subject_id' => $owner->id]);
    }

    public function test_the_token_is_stored_only_as_its_sha256(): void
    {
        $issued = app(BootstrapAdminOwner::class)->handle('owner@example.com');

        $row = DB::table('admin_access_links')->sole();

        $this->assertSame(hash('sha256', $issued->token), $row->token_hash);
        $this->assertSame(43, strlen($issued->token));
        $this->assertStringNotContainsString($issued->token, json_encode($row));
        $this->assertStringContainsString('/access#token='.$issued->token, $issued->url);
        $this->assertStringStartsWith('http://localhost/access#', $issued->url);
    }

    public function test_redeeming_without_confirming_grants_nothing(): void
    {
        $issued = app(BootstrapAdminOwner::class)->handle('owner@example.com');
        $this->adminRequest('GET', 'auth/csrf-cookie');
        $this->redeem($issued->token)->assertOk();

        $this->adminRequest('GET', 'me')->assertUnauthorized();
        $this->adminRequest('GET', 'me/sessions')->assertUnauthorized();
        $this->adminRequest('POST', 'auth/logout')->assertUnauthorized();

        // The new password does not sign in either: the authenticator is not confirmed.
        $this->usingAdminClient('other');
        $this->adminRequest('GET', 'auth/csrf-cookie');
        $this->adminRequest('POST', 'auth/login', ['email' => 'owner@example.com', 'password' => self::NEW_PASSWORD])->assertUnprocessable();
    }

    public function test_a_wrong_first_code_changes_nothing_and_is_audited(): void
    {
        $issued = app(BootstrapAdminOwner::class)->handle('owner@example.com');
        $this->adminRequest('GET', 'auth/csrf-cookie');
        $this->redeem($issued->token);

        $this->adminRequest('POST', 'access-links/confirm', ['code' => '000000'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['code' => 'The provided two factor authentication code was invalid.']);

        $this->assertNull(User::query()->sole()->activated_at);
        $this->adminRequest('GET', 'me')->assertUnauthorized();
        $this->assertDatabaseHas('admin_audit_events', ['action' => AdminAuditAction::TwoFactorEnrollmentFailed->value]);
    }

    public function test_a_link_cannot_be_redeemed_twice(): void
    {
        $issued = app(BootstrapAdminOwner::class)->handle('owner@example.com');
        $this->adminRequest('GET', 'auth/csrf-cookie');
        $this->redeem($issued->token)->assertOk();

        $this->usingAdminClient('attacker');
        $this->adminRequest('GET', 'auth/csrf-cookie');
        $this->redeem($issued->token, 'attacker chosen passphrase')
            ->assertNotFound()
            ->assertExactJson(['message' => 'This access link is invalid or has expired.']);
        $this->adminRequest('POST', 'access-links/inspect', ['token' => $issued->token])->assertNotFound();

        $this->assertFalse(Hash::check('attacker chosen passphrase', User::query()->sole()->password));
        $this->assertDatabaseHas('admin_audit_events', ['action' => AdminAuditAction::AccessLinkRejected->value]);
    }

    public function test_the_confirmation_belongs_to_the_browser_that_redeemed(): void
    {
        $issued = app(BootstrapAdminOwner::class)->handle('owner@example.com');
        $this->adminRequest('GET', 'auth/csrf-cookie');
        $setupKey = $this->redeem($issued->token)->json('data.two_factor.setup_key');

        $this->usingAdminClient('attacker');
        $this->adminRequest('GET', 'auth/csrf-cookie');
        $this->adminRequest('POST', 'access-links/confirm', ['code' => (new Google2FA)->getCurrentOtp($setupKey)])->assertNotFound();
        $this->adminRequest('GET', 'me')->assertUnauthorized();
    }

    public function test_an_expired_link_is_refused(): void
    {
        $issued = app(BootstrapAdminOwner::class)->handle('owner@example.com');
        $this->travel(31)->minutes();
        $this->adminRequest('GET', 'auth/csrf-cookie');

        $this->adminRequest('POST', 'access-links/inspect', ['token' => $issued->token])->assertNotFound();
        $this->redeem($issued->token)->assertNotFound();
    }

    public function test_the_enrollment_must_be_confirmed_within_15_minutes(): void
    {
        $issued = app(BootstrapAdminOwner::class)->handle('owner@example.com');
        $this->adminRequest('GET', 'auth/csrf-cookie');
        $setupKey = $this->redeem($issued->token)->json('data.two_factor.setup_key');

        $this->travel(16)->minutes();

        $this->adminRequest('POST', 'access-links/confirm', ['code' => (new Google2FA)->getCurrentOtp($setupKey)])->assertNotFound();
        $this->assertNull(User::query()->sole()->activated_at);
    }

    public function test_issuing_a_new_link_revokes_the_previous_one(): void
    {
        $first = app(BootstrapAdminOwner::class)->handle('owner@example.com');
        $second = app(BootstrapAdminOwner::class)->handle('owner@example.com');
        $this->adminRequest('GET', 'auth/csrf-cookie');

        $this->adminRequest('POST', 'access-links/inspect', ['token' => $first->token])->assertNotFound();
        $this->adminRequest('POST', 'access-links/inspect', ['token' => $second->token])->assertOk();
        $this->assertSame(1, User::query()->count());
    }

    public function test_a_revoked_pending_enrollment_cannot_be_completed(): void
    {
        $first = app(BootstrapAdminOwner::class)->handle('owner@example.com');
        $this->adminRequest('GET', 'auth/csrf-cookie');
        $setupKey = $this->redeem($first->token)->json('data.two_factor.setup_key');

        app(BootstrapAdminOwner::class)->handle('owner@example.com');

        $this->adminRequest('POST', 'access-links/confirm', ['code' => (new Google2FA)->getCurrentOtp($setupKey)])->assertNotFound();
    }

    public function test_redeeming_validates_the_password_and_the_name(): void
    {
        $issued = app(BootstrapAdminOwner::class)->handle('owner@example.com');
        $this->adminRequest('GET', 'auth/csrf-cookie');

        $this->adminRequest('POST', 'access-links/redeem', ['token' => $issued->token, 'password' => 'short', 'password_confirmation' => 'different'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name' => 'The name field is required.', 'password']);

        $this->adminRequest('POST', 'access-links/redeem', ['token' => 'not-a-token'])
            ->assertJsonValidationErrors(['token', 'password']);

        // Validation failures do not use up the link.
        $this->adminRequest('POST', 'access-links/inspect', ['token' => $issued->token])->assertOk();
    }

    public function test_access_link_routes_need_no_account_and_refuse_a_signed_in_one(): void
    {
        $issued = app(BootstrapAdminOwner::class)->handle('owner@example.com');
        $this->signIn($this->createActiveAdmin());

        $this->adminRequest('POST', 'access-links/inspect', ['token' => $issued->token])->assertConflict();
        $this->adminRequest('POST', 'access-links/redeem', ['token' => $issued->token])->assertConflict();
    }

    public function test_access_link_attempts_are_rate_limited(): void
    {
        $this->adminRequest('GET', 'auth/csrf-cookie');

        for ($attempt = 1; $attempt <= 10; $attempt++) {
            $this->adminRequest('POST', 'access-links/inspect', ['token' => str_repeat((string) ($attempt % 10), 43)])->assertNotFound();
        }

        $this->adminRequest('POST', 'access-links/inspect', ['token' => str_repeat('a', 43)])->assertTooManyRequests();
    }

    public function test_a_credential_reset_replaces_password_and_authenticator_and_ends_sessions(): void
    {
        $user = $this->createActiveAdmin(AdminRole::Owner);
        $oldSecret = $this->totpSecret($user);
        $this->usingAdminClient('stolen');
        $this->signIn($user);

        $this->assertSame(1, DB::table('sessions')->where('user_id', $user->id)->count());

        $issued = app(ResetAdminCredentials::class)->handle($user, AdminActorType::Cli, 30);

        // The session rows are deleted, not only refused by the account check.
        $this->assertSame(0, DB::table('sessions')->where('user_id', $user->id)->count());

        // The old session and the old credentials stop working at once.
        $this->adminRequest('GET', 'me')->assertUnauthorized();
        $this->usingAdminClient('old-credentials');
        $this->adminRequest('GET', 'auth/csrf-cookie');
        $this->adminRequest('POST', 'auth/login', ['email' => $user->email, 'password' => self::ADMIN_PASSWORD])->assertUnprocessable();

        $this->usingAdminClient('holder');
        $this->adminRequest('GET', 'auth/csrf-cookie');
        $this->adminRequest('POST', 'access-links/inspect', ['token' => $issued->token])
            ->assertJsonPath('data.purpose', 'credential-reset')
            ->assertJsonPath('data.requires_name', false);
        $setupKey = $this->redeem($issued->token)->json('data.two_factor.setup_key');
        $this->assertNotSame($oldSecret, $setupKey);
        // A session row of the account that appeared meanwhile (another server, a race)
        // does not survive the completion.
        DB::table('sessions')->insert(['id' => str_repeat('x', 40), 'user_id' => $user->id, 'payload' => '', 'last_activity' => now()->getTimestamp()]);
        $this->adminRequest('POST', 'access-links/confirm', ['code' => (new Google2FA)->getCurrentOtp($setupKey)])->assertOk();

        $this->adminRequest('GET', 'me')->assertOk();
        $this->assertDatabaseMissing('sessions', ['id' => str_repeat('x', 40)]);
        $this->assertTrue(Hash::check(self::NEW_PASSWORD, $user->fresh()->password));
        $this->assertDatabaseHas('admin_audit_events', ['action' => AdminAuditAction::CredentialResetIssued->value, 'subject_id' => $user->id]);
        $this->assertDatabaseHas('admin_audit_events', ['action' => AdminAuditAction::CredentialResetCompleted->value, 'subject_id' => $user->id]);
    }

    public function test_a_suspended_account_cannot_use_its_link(): void
    {
        $user = $this->createActiveAdmin();
        $issued = app(ResetAdminCredentials::class)->handle($user, AdminActorType::Cli, 30);
        $user->forceFill(['suspended_at' => now()])->save();
        $this->adminRequest('GET', 'auth/csrf-cookie');

        $this->redeem($issued->token)->assertNotFound();
    }

    public function test_enrollment_secrets_are_encrypted_at_rest(): void
    {
        $issued = app(BootstrapAdminOwner::class)->handle('owner@example.com');
        $this->adminRequest('GET', 'auth/csrf-cookie');
        $setupKey = $this->redeem($issued->token)->json('data.two_factor.setup_key');

        $stored = DB::table('users')->sole();

        $this->assertStringNotContainsString($setupKey, (string) $stored->two_factor_secret);
        $this->assertSame($setupKey, Fortify::currentEncrypter()->decrypt($stored->two_factor_secret));
        $this->assertStringNotContainsString(self::NEW_PASSWORD, json_encode($stored));
    }

    private function redeem(string $token, string $password = self::NEW_PASSWORD): TestResponse
    {
        return $this->adminRequest('POST', 'access-links/redeem', [
            'token' => $token,
            'name' => 'Owner Name',
            'password' => $password,
            'password_confirmation' => $password,
        ]);
    }
}
