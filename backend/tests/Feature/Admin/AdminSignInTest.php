<?php

namespace Tests\Feature\Admin;

use App\Enums\AdminAuditAction;
use App\Enums\AdminRole;
use App\Models\AdminAuditEvent;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use PragmaRX\Google2FA\Google2FA;
use Tests\Support\InteractsWithAdminApi;
use Tests\TestCase;

class AdminSignInTest extends TestCase
{
    use InteractsWithAdminApi;
    use RefreshDatabase;

    private const FAILED_MESSAGE = 'These credentials do not match our records.';

    public function test_password_then_totp_signs_in_and_opens_the_account(): void
    {
        $user = $this->createActiveAdmin(AdminRole::Owner);

        $this->signIn($user);

        $this->adminRequest('GET', 'me')
            ->assertOk()
            ->assertJsonPath('data.email', $user->email)
            ->assertJsonPath('data.role', 'owner')
            ->assertJsonPath('data.permissions', self::OWNER_PERMISSIONS)
            ->assertJsonPath('data.two_factor.recovery_codes_remaining', 8)
            ->assertJsonPath('data.session.idle_timeout_minutes', 30)
            ->assertJsonMissingPath('data.password')
            ->assertJsonMissingPath('data.two_factor_secret');

        $this->assertNotNull($user->fresh()->last_login_at);
        $this->assertDatabaseHas('admin_audit_events', ['action' => AdminAuditAction::LoginSucceeded->value, 'actor_user_id' => $user->id]);
    }

    public function test_a_correct_password_alone_does_not_sign_in(): void
    {
        $user = $this->createActiveAdmin();

        $this->adminRequest('GET', 'auth/csrf-cookie');
        $this->adminRequest('POST', 'auth/login', ['email' => $user->email, 'password' => self::ADMIN_PASSWORD])
            ->assertOk()
            ->assertExactJson(['two_factor' => true]);

        $this->adminRequest('GET', 'me')->assertUnauthorized();
    }

    public function test_wrong_password_unknown_address_and_inactive_accounts_get_the_same_answer(): void
    {
        $active = $this->createActiveAdmin();
        $pending = User::factory()->withPassword(self::ADMIN_PASSWORD)->pendingActivation()->create();
        $suspended = User::factory()->withPassword(self::ADMIN_PASSWORD)->activeAdmin()->suspended()->create();
        $withoutRole = User::factory()->withPassword(self::ADMIN_PASSWORD)->create();
        $unconfirmed = User::factory()->withPassword(self::ADMIN_PASSWORD)->activeAdmin()->create(['two_factor_confirmed_at' => null]);

        $this->adminRequest('GET', 'auth/csrf-cookie');

        $attempts = [
            [$active->email, 'not the password'],
            ['nobody@example.com', self::ADMIN_PASSWORD],
            [$pending->email, self::ADMIN_PASSWORD],
            [$suspended->email, self::ADMIN_PASSWORD],
            [$withoutRole->email, self::ADMIN_PASSWORD],
            [$unconfirmed->email, self::ADMIN_PASSWORD],
        ];

        foreach ($attempts as [$email, $password]) {
            $this->adminRequest('POST', 'auth/login', ['email' => $email, 'password' => $password])
                ->assertUnprocessable()
                ->assertExactJson(['message' => self::FAILED_MESSAGE, 'errors' => ['email' => [self::FAILED_MESSAGE]]]);
        }

        $this->adminRequest('GET', 'me')->assertUnauthorized();
    }

    public function test_failed_sign_in_is_audited_with_a_fingerprint_and_never_the_password_or_address(): void
    {
        $this->adminRequest('GET', 'auth/csrf-cookie');
        $this->adminRequest('POST', 'auth/login', ['email' => 'Someone@Example.com', 'password' => 'typed-secret-password'])->assertUnprocessable();

        $event = AdminAuditEvent::query()->where('action', AdminAuditAction::LoginFailed->value)->sole();
        $row = json_encode(AdminAuditEvent::query()->toBase()->find($event->id));

        $this->assertSame(64, strlen($event->metadata['email_fingerprint']));
        $this->assertStringNotContainsStringIgnoringCase('someone@example.com', $row);
        $this->assertStringNotContainsString('typed-secret-password', $row);
    }

    public function test_remember_me_is_never_honoured(): void
    {
        $user = $this->createActiveAdmin();

        $this->adminRequest('GET', 'auth/csrf-cookie');
        $this->adminRequest('POST', 'auth/login', ['email' => $user->email, 'password' => self::ADMIN_PASSWORD, 'remember' => true])->assertOk();
        $response = $this->adminRequest('POST', 'auth/two-factor-challenge', ['code' => $this->freshTotpCode($user)])->assertNoContent();

        foreach ($response->headers->getCookies() as $cookie) {
            $this->assertStringStartsNotWith('remember_', $cookie->getName());
        }

        $this->assertNull($user->fresh()->remember_token);
    }

    public function test_wrong_totp_code_is_refused_and_audited(): void
    {
        $user = $this->createActiveAdmin();

        $this->adminRequest('GET', 'auth/csrf-cookie');
        $this->adminRequest('POST', 'auth/login', ['email' => $user->email, 'password' => self::ADMIN_PASSWORD]);

        $this->adminRequest('POST', 'auth/two-factor-challenge', ['code' => '000000'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['code' => 'The provided two factor authentication code was invalid.']);

        $this->adminRequest('GET', 'me')->assertUnauthorized();
        $this->assertDatabaseHas('admin_audit_events', ['action' => AdminAuditAction::TwoFactorChallengeFailed->value, 'subject_id' => $user->id]);
    }

    public function test_a_totp_code_cannot_be_replayed(): void
    {
        $user = $this->createActiveAdmin();
        $this->adminRequest('GET', 'auth/csrf-cookie');
        $this->adminRequest('POST', 'auth/login', ['email' => $user->email, 'password' => self::ADMIN_PASSWORD]);
        $code = $this->freshTotpCode($user);
        $this->adminRequest('POST', 'auth/two-factor-challenge', ['code' => $code])->assertNoContent();

        $this->usingAdminClient('attacker');
        $this->adminRequest('GET', 'auth/csrf-cookie');
        $this->adminRequest('POST', 'auth/login', ['email' => $user->email, 'password' => self::ADMIN_PASSWORD]);

        $this->adminRequest('POST', 'auth/two-factor-challenge', ['code' => $code])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('code');
        $this->adminRequest('GET', 'me')->assertUnauthorized();
    }

    /**
     * Fortify accepts the next 30-second step (window 1, clock drift). Its replay cache must
     * remember that step, not the current one, or the same code works once more elsewhere.
     * Found by the real-browser tests (B3.2b).
     */
    public function test_a_totp_code_from_the_next_step_cannot_be_replayed(): void
    {
        $user = $this->createActiveAdmin();
        $google2fa = new Google2FA;
        $code = $google2fa->oathTotp($this->totpSecret($user), $google2fa->getTimestamp() + 1);

        $this->adminRequest('GET', 'auth/csrf-cookie');
        $this->adminRequest('POST', 'auth/login', ['email' => $user->email, 'password' => self::ADMIN_PASSWORD]);
        $this->adminRequest('POST', 'auth/two-factor-challenge', ['code' => $code])->assertNoContent();

        $this->usingAdminClient('attacker');
        $this->adminRequest('GET', 'auth/csrf-cookie');
        $this->adminRequest('POST', 'auth/login', ['email' => $user->email, 'password' => self::ADMIN_PASSWORD]);

        $this->adminRequest('POST', 'auth/two-factor-challenge', ['code' => $code])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('code');
        $this->adminRequest('GET', 'me')->assertUnauthorized();
    }

    public function test_a_recovery_code_signs_in_once_and_is_consumed(): void
    {
        $user = $this->createActiveAdmin();
        $code = $user->recoveryCodes()[0];

        $this->adminRequest('GET', 'auth/csrf-cookie');
        $this->adminRequest('POST', 'auth/login', ['email' => $user->email, 'password' => self::ADMIN_PASSWORD]);
        $this->adminRequest('POST', 'auth/two-factor-challenge', ['recovery_code' => $code])->assertNoContent();

        $this->assertNotContains($code, $user->fresh()->recoveryCodes());
        $this->adminRequest('GET', 'me')->assertJsonPath('data.two_factor.recovery_codes_remaining', 7);
        $this->assertDatabaseHas('admin_audit_events', ['action' => AdminAuditAction::RecoveryCodeUsed->value, 'subject_id' => $user->id]);

        $this->usingAdminClient('second');
        $this->adminRequest('GET', 'auth/csrf-cookie');
        $this->adminRequest('POST', 'auth/login', ['email' => $user->email, 'password' => self::ADMIN_PASSWORD]);
        $this->adminRequest('POST', 'auth/two-factor-challenge', ['recovery_code' => $code])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['recovery_code' => 'The provided two factor recovery code was invalid.']);
    }

    public function test_the_totp_step_expires_after_five_minutes(): void
    {
        $user = $this->createActiveAdmin();

        $this->adminRequest('GET', 'auth/csrf-cookie');
        $this->adminRequest('POST', 'auth/login', ['email' => $user->email, 'password' => self::ADMIN_PASSWORD]);
        $this->travel(5)->minutes();

        $this->adminRequest('POST', 'auth/two-factor-challenge', ['code' => $this->freshTotpCode($user)])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['code' => 'The sign-in attempt has expired. Sign in again.']);
        $this->adminRequest('GET', 'me')->assertUnauthorized();
    }

    public function test_an_account_suspended_between_password_and_totp_cannot_finish(): void
    {
        $user = $this->createActiveAdmin();

        $this->adminRequest('GET', 'auth/csrf-cookie');
        $this->adminRequest('POST', 'auth/login', ['email' => $user->email, 'password' => self::ADMIN_PASSWORD]);
        $user->forceFill(['suspended_at' => now()])->save();

        $this->adminRequest('POST', 'auth/two-factor-challenge', ['code' => $this->freshTotpCode($user)])->assertUnprocessable();
        $this->adminRequest('GET', 'me')->assertUnauthorized();
    }

    public function test_the_challenge_without_a_password_step_is_refused(): void
    {
        $user = $this->createActiveAdmin();

        $this->adminRequest('GET', 'auth/csrf-cookie');

        $this->adminRequest('POST', 'auth/two-factor-challenge', ['code' => $this->freshTotpCode($user)])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('code');
    }

    public function test_signing_in_again_while_signed_in_is_refused(): void
    {
        $user = $this->createActiveAdmin();
        $this->signIn($user);

        $this->adminRequest('POST', 'auth/login', ['email' => $user->email, 'password' => self::ADMIN_PASSWORD])
            ->assertConflict()
            ->assertExactJson(['message' => 'You are already signed in. Sign out first.']);
    }

    public function test_sign_in_attempts_are_rate_limited_per_address_and_client(): void
    {
        $user = $this->createActiveAdmin();
        $this->adminRequest('GET', 'auth/csrf-cookie');

        for ($attempt = 1; $attempt <= 5; $attempt++) {
            $this->adminRequest('POST', 'auth/login', ['email' => $user->email, 'password' => 'wrong password '.$attempt])->assertUnprocessable();
        }

        $this->adminRequest('POST', 'auth/login', ['email' => $user->email, 'password' => self::ADMIN_PASSWORD])
            ->assertTooManyRequests()
            ->assertHeader('Retry-After');
    }

    public function test_totp_attempts_are_rate_limited(): void
    {
        $user = $this->createActiveAdmin();
        $this->adminRequest('GET', 'auth/csrf-cookie');
        $this->adminRequest('POST', 'auth/login', ['email' => $user->email, 'password' => self::ADMIN_PASSWORD]);

        for ($attempt = 1; $attempt <= 5; $attempt++) {
            $this->adminRequest('POST', 'auth/two-factor-challenge', ['code' => '00000'.$attempt])->assertUnprocessable();
        }

        $this->adminRequest('POST', 'auth/two-factor-challenge', ['code' => $this->freshTotpCode($user)])->assertTooManyRequests();
    }

    /**
     * @return array<string, array{array<string, string>}>
     */
    public static function incompleteSignIns(): array
    {
        return [
            'nothing' => [[]],
            'no password' => [['email' => 'owner@example.com']],
        ];
    }

    /**
     * @param  array<string, string>  $payload
     */
    #[DataProvider('incompleteSignIns')]
    public function test_incomplete_sign_in_is_a_validation_error(array $payload): void
    {
        $this->adminRequest('GET', 'auth/csrf-cookie');

        $this->adminRequest('POST', 'auth/login', $payload)->assertUnprocessable()->assertJsonValidationErrors('password');
    }

    public function test_sign_out_ends_the_session(): void
    {
        $user = $this->createActiveAdmin();
        $this->signIn($user);

        $this->adminRequest('POST', 'auth/logout')->assertNoContent();

        $this->adminRequest('GET', 'me')->assertUnauthorized();
        $this->assertDatabaseHas('admin_audit_events', ['action' => AdminAuditAction::Logout->value, 'actor_user_id' => $user->id]);
    }
}
