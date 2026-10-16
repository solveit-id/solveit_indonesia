<?php

namespace Tests\Feature\Admin;

use App\Enums\AdminAuditAction;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\Support\InteractsWithAdminApi;
use Tests\TestCase;

class AdminSessionSecurityTest extends TestCase
{
    use InteractsWithAdminApi;
    use RefreshDatabase;

    public function test_the_session_id_changes_at_sign_in_and_the_old_one_is_worthless(): void
    {
        $user = $this->createActiveAdmin();

        $this->adminRequest('GET', 'auth/csrf-cookie');
        $anonymousCookie = $this->adminCookies()['solveit-admin-session'];
        $this->adminRequest('POST', 'auth/login', ['email' => $user->email, 'password' => self::ADMIN_PASSWORD]);
        $this->adminRequest('POST', 'auth/two-factor-challenge', ['code' => $this->freshTotpCode($user)])->assertNoContent();

        $this->assertNotSame($anonymousCookie, $this->adminCookies()['solveit-admin-session']);
        $this->adminRequest('GET', 'me')->assertOk();

        // An attacker who planted or saw the pre-sign-in cookie gains nothing.
        $this->usingAdminClient('attacker');
        $this->setAdminCookie('solveit-admin-session', $anonymousCookie);
        $this->adminRequest('GET', 'me')->assertUnauthorized();
    }

    public function test_an_idle_session_expires_after_30_minutes(): void
    {
        $this->signIn($this->createActiveAdmin());

        $this->travel(29)->minutes();
        $this->adminRequest('GET', 'me')->assertOk();

        $this->travel(29)->minutes();
        $this->adminRequest('GET', 'me')->assertOk();

        $this->travel(31)->minutes();
        $this->adminRequest('GET', 'me')->assertUnauthorized()->assertExactJson(['message' => 'Unauthenticated.']);
    }

    public function test_an_active_session_still_ends_12_hours_after_sign_in(): void
    {
        $user = $this->createActiveAdmin();
        $this->signIn($user);

        // 28 steps of 25 minutes: 700 minutes, never idle for 30.
        for ($step = 1; $step <= 28; $step++) {
            $this->travel(25)->minutes();
            $this->adminRequest('GET', 'me')->assertOk();
        }

        $this->travel(21)->minutes();
        $this->adminRequest('GET', 'me')->assertUnauthorized();

        $this->assertDatabaseHas('admin_audit_events', ['action' => AdminAuditAction::SessionExpired->value, 'actor_user_id' => $user->id]);
        $this->assertDatabaseMissing('admin_audit_events', ['action' => AdminAuditAction::Logout->value]);
    }

    public function test_requests_without_a_session_get_401(): void
    {
        $this->adminRequest('GET', 'me')->assertUnauthorized()->assertExactJson(['message' => 'Unauthenticated.']);
        $this->adminRequest('GET', 'me/sessions')->assertUnauthorized();
    }

    public function test_suspension_ends_an_existing_session_even_without_revocation(): void
    {
        $user = $this->createActiveAdmin();
        $this->signIn($user);

        $user->forceFill(['suspended_at' => now()])->save();

        $this->adminRequest('GET', 'me')->assertUnauthorized();
        $this->assertDatabaseHas('admin_audit_events', ['action' => AdminAuditAction::SessionEndedInactiveAccount->value, 'actor_user_id' => $user->id]);

        $user->forceFill(['suspended_at' => null])->save();
        $this->adminRequest('GET', 'me')->assertUnauthorized('the ended session does not come back');
    }

    public function test_a_lost_role_ends_the_session(): void
    {
        $user = $this->createActiveAdmin();
        $this->signIn($user);

        $user->forceFill(['role' => null])->save();

        $this->adminRequest('GET', 'me')->assertUnauthorized();
    }

    public function test_sessions_are_listed_without_their_ids_and_others_can_be_ended(): void
    {
        $user = $this->createActiveAdmin();

        $this->usingAdminClient('laptop');
        $this->signIn($user);
        $this->usingAdminClient('phone');
        $this->signIn($user);

        $sessions = $this->adminRequest('GET', 'me/sessions')->assertOk()->json('data');
        $this->assertCount(2, $sessions);
        $this->assertSame([false, true], collect($sessions)->sortBy('current')->pluck('current')->values()->all());

        $storedIds = DB::table('sessions')->where('user_id', $user->id)->pluck('id')->all();
        foreach ($sessions as $session) {
            $this->assertMatchesRegularExpression('/^[0-9a-f]{32}$/', $session['id']);
            $this->assertNotContains($session['id'], $storedIds);
        }

        $laptop = collect($sessions)->firstWhere('current', false)['id'];
        $this->adminRequest('DELETE', 'me/sessions/'.$laptop)->assertNoContent();
        $this->assertDatabaseHas('admin_audit_events', ['action' => AdminAuditAction::SessionRevoked->value, 'actor_user_id' => $user->id]);

        $this->usingAdminClient('laptop');
        $this->adminRequest('GET', 'me')->assertUnauthorized();
        $this->usingAdminClient('phone');
        $this->adminRequest('GET', 'me')->assertOk();
    }

    public function test_the_current_session_and_unknown_handles_cannot_be_ended_by_handle(): void
    {
        $this->signIn($this->createActiveAdmin());
        $current = collect($this->adminRequest('GET', 'me/sessions')->json('data'))->firstWhere('current', true)['id'];

        $this->adminRequest('DELETE', 'me/sessions/'.$current)->assertUnprocessable();
        $this->adminRequest('DELETE', 'me/sessions/'.str_repeat('0', 32))->assertNotFound();
        $this->adminRequest('GET', 'me')->assertOk();
    }

    public function test_another_accounts_session_cannot_be_ended(): void
    {
        $victim = $this->createActiveAdmin();
        $this->usingAdminClient('victim');
        $this->signIn($victim);
        $victimHandle = $this->adminRequest('GET', 'me/sessions')->json('data.0.id');

        $this->usingAdminClient('other');
        $this->signIn($this->createActiveAdmin());
        $this->adminRequest('DELETE', 'me/sessions/'.$victimHandle)->assertNotFound();

        $this->usingAdminClient('victim');
        $this->adminRequest('GET', 'me')->assertOk();
    }

    public function test_signing_out_everywhere_else_keeps_only_this_session(): void
    {
        $user = $this->createActiveAdmin();
        $this->usingAdminClient('laptop');
        $this->signIn($user);
        $this->usingAdminClient('phone');
        $this->signIn($user);

        $this->adminRequest('DELETE', 'me/sessions')->assertOk()->assertExactJson(['data' => ['other_sessions_ended' => 1]]);

        $this->adminRequest('GET', 'me')->assertOk();
        $this->usingAdminClient('laptop');
        $this->adminRequest('GET', 'me')->assertUnauthorized();
    }

    public function test_changing_the_password_ends_other_sessions_and_keeps_this_one(): void
    {
        $user = $this->createActiveAdmin();
        $this->usingAdminClient('laptop');
        $this->signIn($user);
        $this->usingAdminClient('phone');
        $this->signIn($user);
        $cookieBefore = $this->adminCookies()['solveit-admin-session'];

        $this->adminRequest('PUT', 'me/password', [
            'current_password' => self::ADMIN_PASSWORD,
            'password' => 'a brand new passphrase',
            'password_confirmation' => 'a brand new passphrase',
        ])->assertOk()->assertExactJson(['data' => ['other_sessions_ended' => 1]]);

        $this->assertTrue(Hash::check('a brand new passphrase', $user->fresh()->password));
        $this->assertNotSame($cookieBefore, $this->adminCookies()['solveit-admin-session']);
        $this->adminRequest('GET', 'me')->assertOk();
        $this->usingAdminClient('laptop');
        $this->adminRequest('GET', 'me')->assertUnauthorized();
        $this->assertDatabaseHas('admin_audit_events', ['action' => AdminAuditAction::PasswordChanged->value, 'actor_user_id' => $user->id]);
    }

    public function test_the_password_change_needs_the_current_password_and_a_strong_new_one(): void
    {
        $this->signIn($this->createActiveAdmin());

        $this->adminRequest('PUT', 'me/password', ['current_password' => 'wrong', 'password' => 'short', 'password_confirmation' => 'short'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors([
                'current_password' => 'The password is incorrect.',
                'password' => 'The password field must be at least 12 characters.',
            ]);

        $tooLong = str_repeat('é', 37);
        $this->adminRequest('PUT', 'me/password', ['current_password' => self::ADMIN_PASSWORD, 'password' => $tooLong, 'password_confirmation' => $tooLong])
            ->assertJsonValidationErrors(['password' => 'The password may not be longer than 72 bytes.']);

        $this->adminRequest('PUT', 'me/password', ['current_password' => self::ADMIN_PASSWORD, 'password' => self::ADMIN_PASSWORD, 'password_confirmation' => self::ADMIN_PASSWORD])
            ->assertJsonValidationErrors('password');
    }

    public function test_new_recovery_codes_need_a_recent_password_confirmation(): void
    {
        $user = $this->createActiveAdmin();
        $this->signIn($user);
        $oldCodes = $user->recoveryCodes();

        $this->adminRequest('POST', 'me/two-factor-recovery-codes')
            ->assertStatus(423)
            ->assertExactJson(['message' => 'Password confirmation required.']);

        $this->adminRequest('POST', 'auth/confirm-password', ['password' => 'wrong'])->assertUnprocessable();
        $this->adminRequest('POST', 'auth/confirm-password', ['password' => self::ADMIN_PASSWORD])->assertCreated();

        $codes = $this->adminRequest('POST', 'me/two-factor-recovery-codes')->assertOk()->json('data.recovery_codes');
        $this->assertCount(8, $codes);
        $this->assertEmpty(array_intersect($codes, $oldCodes));
        $this->assertSame($codes, $user->fresh()->recoveryCodes());
        $this->assertDatabaseHas('admin_audit_events', ['action' => AdminAuditAction::RecoveryCodesRegenerated->value, 'actor_user_id' => $user->id]);

        $this->travel(16)->minutes();
        $this->adminRequest('POST', 'me/two-factor-recovery-codes')->assertStatus(423);
    }

    public function test_password_confirmation_attempts_are_rate_limited(): void
    {
        $this->signIn($this->createActiveAdmin());

        for ($attempt = 1; $attempt <= 5; $attempt++) {
            $this->adminRequest('POST', 'auth/confirm-password', ['password' => 'wrong '.$attempt])->assertUnprocessable();
        }

        $this->adminRequest('POST', 'auth/confirm-password', ['password' => self::ADMIN_PASSWORD])->assertTooManyRequests();
    }
}
