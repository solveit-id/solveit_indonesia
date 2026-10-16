<?php

namespace Tests\Feature\Admin;

use App\Enums\AdminAuditAction;
use App\Enums\AdminRole;
use App\Models\AdminAuditEvent;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Support\InteractsWithAdminApi;
use Tests\TestCase;

/**
 * Owner user administration over HTTP (B3.1b): who may call it, what it reveals, and the
 * role, suspension, and reactivation operations with their invariants.
 */
class AdminUserAdministrationTest extends TestCase
{
    use InteractsWithAdminApi;
    use RefreshDatabase;

    /**
     * Every owner-only route with a request an owner could send.
     *
     * @return array<string, array{string, string, array<string, mixed>}>
     */
    public static function ownerRoutes(): array
    {
        return [
            'list users' => ['GET', 'users', []],
            'show user' => ['GET', 'users/{target}', []],
            'list invitations' => ['GET', 'invitations', []],
            'show invitation' => ['GET', 'invitations/1', []],
            'invite' => ['POST', 'invitations', ['email' => 'new@example.com', 'role' => 'admin']],
            'revoke invitation' => ['DELETE', 'invitations/1', []],
            'change role' => ['PUT', 'users/{target}/role', ['role' => 'owner']],
            'suspend' => ['POST', 'users/{target}/suspension', []],
            'reactivate' => ['DELETE', 'users/{target}/suspension', []],
            'reset credentials' => ['POST', 'users/{target}/credential-reset', ['acknowledge_access_loss' => true]],
            'read audit log' => ['GET', 'audit-events', []],
        ];
    }

    /**
     * @param  array<string, mixed>  $data
     */
    #[DataProvider('ownerRoutes')]
    public function test_an_admin_is_refused_every_owner_route_even_with_a_fresh_password(string $method, string $path, array $data): void
    {
        $target = $this->createActiveAdmin();
        $admin = $this->createActiveAdmin();
        $this->signIn($admin);
        $this->confirmAdminPassword();
        $before = AdminAuditEvent::query()->count();

        $this->adminRequest($method, str_replace('{target}', (string) $target->id, $path), $data)
            ->assertForbidden()
            ->assertExactJson(['message' => 'This action is unauthorized.']);

        $this->assertSame(AdminRole::Admin, $target->fresh()->role);
        $this->assertNull($target->fresh()->suspended_at);
        $this->assertTrue($target->fresh()->canSignInToAdmin());
        $this->assertDatabaseMissing('users', ['email' => 'new@example.com']);
        $this->assertSame($before, AdminAuditEvent::query()->count());
    }

    /**
     * @param  array<string, mixed>  $data
     */
    #[DataProvider('ownerRoutes')]
    public function test_owner_routes_need_a_session(string $method, string $path, array $data): void
    {
        $target = $this->createActiveAdmin();
        $this->adminRequest('GET', 'auth/csrf-cookie');

        $this->adminRequest($method, str_replace('{target}', (string) $target->id, $path), $data)->assertUnauthorized();
    }

    public function test_an_admin_cannot_tell_existing_accounts_from_missing_ones(): void
    {
        $existing = $this->createActiveAdmin();
        $this->signIn($this->createActiveAdmin());

        $forExisting = $this->adminRequest('GET', "users/{$existing->id}")->assertForbidden();
        $forMissing = $this->adminRequest('GET', 'users/999999')->assertForbidden();

        $this->assertSame($forExisting->getContent(), $forMissing->getContent());
    }

    public function test_an_admin_sees_only_their_own_permission(): void
    {
        $this->signIn($this->createActiveAdmin());

        $this->adminRequest('GET', 'me')->assertOk()->assertJsonPath('data.permissions', ['account.manage-own']);
    }

    public function test_the_user_list_shows_admin_accounts_without_secrets(): void
    {
        $owner = $this->createActiveAdmin(AdminRole::Owner);
        $admin = $this->createActiveAdmin();
        $pending = User::factory()->pendingActivation()->create();
        $suspended = User::factory()->activeAdmin()->suspended()->create();
        $withoutRole = User::factory()->create();
        $this->signIn($owner);

        $response = $this->adminRequest('GET', 'users')->assertOk();

        $this->assertSame([$owner->id, $admin->id, $pending->id, $suspended->id], array_column($response->json('data'), 'id'));
        $response->assertJsonPath('data.0.is_current_user', true)
            ->assertJsonPath('data.0.status', 'active')
            ->assertJsonPath('data.1.is_current_user', false)
            ->assertJsonPath('data.2.status', 'pending')
            ->assertJsonPath('data.3.status', 'suspended')
            ->assertHeader('Cache-Control', 'no-store, private');
        $this->assertSame(
            ['id', 'name', 'email', 'role', 'status', 'is_current_user', 'two_factor_confirmed', 'activated_at', 'suspended_at', 'last_login_at', 'created_at'],
            array_keys($response->json('data.1')),
        );
        $this->assertNotContains($withoutRole->id, array_column($response->json('data'), 'id'));
        $this->assertNoAccountSecretsIn($response->getContent(), [$owner, $admin, $suspended]);
    }

    public function test_the_user_detail_counts_sessions_without_revealing_them(): void
    {
        $owner = $this->createActiveAdmin(AdminRole::Owner);
        $admin = $this->createActiveAdmin();
        $this->usingAdminClient('admin-laptop')->signIn($admin);
        $sessionId = (string) DB::table('sessions')->where('user_id', $admin->id)->value('id');
        $this->usingAdminClient('owner')->signIn($owner);

        $response = $this->adminRequest('GET', "users/{$admin->id}")->assertOk()
            ->assertJsonPath('data.active_sessions', 1)
            ->assertJsonPath('data.open_access_link', null);

        $this->assertStringNotContainsString($sessionId, $response->getContent());
        $this->assertNoAccountSecretsIn($response->getContent(), [$admin]);
        $this->adminRequest('GET', 'users/'.User::factory()->create()->id)->assertNotFound()->assertExactJson(['message' => 'Account not found.']);
        $this->adminRequest('GET', 'users/999999')->assertNotFound();
    }

    public function test_the_user_list_filters_and_pages_with_a_bounded_cursor(): void
    {
        $owner = $this->createActiveAdmin(AdminRole::Owner);
        $admins = User::factory()->activeAdmin()->count(4)->create();
        User::factory()->pendingActivation()->create();
        $this->signIn($owner);

        $first = $this->adminRequest('GET', 'users?role=admin&status=active&per_page=3')->assertOk();
        $this->assertSame($admins->take(3)->pluck('id')->all(), array_column($first->json('data'), 'id'));
        $this->assertStringContainsString('role=admin', (string) $first->json('links.next'));

        $cursor = $first->json('meta.next_cursor');
        $second = $this->adminRequest('GET', 'users?role=admin&status=active&per_page=3&cursor='.$cursor)->assertOk();
        $this->assertSame([$admins->last()->id], array_column($second->json('data'), 'id'));
        $this->assertNull($second->json('meta.next_cursor'));

        $this->adminRequest('GET', 'users?status=pending')->assertOk()->assertJsonCount(1, 'data');
    }

    /**
     * @return array<string, array{string, string}>
     */
    public static function invalidListQueries(): array
    {
        return [
            'page too large' => ['per_page=101', 'per_page'],
            'page too small' => ['per_page=0', 'per_page'],
            'unknown role' => ['role=editor', 'role'],
            'unknown status' => ['status=deleted', 'status'],
            'unsupported parameter' => ['sort=email', 'sort'],
            'garbage cursor' => ['cursor=not-a-cursor', 'cursor'],
            'cursor on another column' => ['cursor='.rtrim(strtr(base64_encode('{"email":"a@example.com","_pointsToNextItems":true}'), '+/', '-_'), '='), 'cursor'],
            'cursor with a string id' => ['cursor='.rtrim(strtr(base64_encode('{"id":"1 or 1=1","_pointsToNextItems":true}'), '+/', '-_'), '='), 'cursor'],
        ];
    }

    #[DataProvider('invalidListQueries')]
    public function test_list_parameters_are_validated(string $query, string $field): void
    {
        $this->signIn($this->createActiveAdmin(AdminRole::Owner));

        $this->adminRequest('GET', "users?{$query}")->assertUnprocessable()->assertJsonValidationErrors([$field]);
    }

    public function test_an_owner_changes_a_role_and_the_targets_sessions_end(): void
    {
        $admin = $this->createActiveAdmin();
        $this->usingAdminClient('admin')->signIn($admin);
        $this->usingAdminClient('owner');
        $owner = $this->signInConfirmedOwner();

        $this->adminRequest('PUT', "users/{$admin->id}/role", ['role' => 'owner'])->assertOk()
            ->assertJsonPath('data.role', 'owner')
            ->assertJsonPath('data.active_sessions', 0);

        $this->assertSame(0, DB::table('sessions')->where('user_id', $admin->id)->count());
        $this->usingAdminClient('admin')->adminRequest('GET', 'me')->assertUnauthorized();
        $this->assertDatabaseHas('admin_audit_events', ['action' => AdminAuditAction::RoleChanged->value, 'actor_user_id' => $owner->id, 'subject_id' => $admin->id]);

        $this->usingAdminClient('owner')->adminRequest('PUT', "users/{$admin->id}/role", ['role' => 'admin'])->assertOk()->assertJsonPath('data.role', 'admin');
        $this->adminRequest('PUT', "users/{$admin->id}/role", ['role' => 'editor'])->assertUnprocessable()->assertJsonValidationErrors(['role']);
        $this->adminRequest('PUT', "users/{$admin->id}/role", [])->assertUnprocessable()->assertJsonValidationErrors(['role']);
    }

    public function test_an_owner_cannot_change_their_own_role_or_suspend_themselves(): void
    {
        $owner = $this->signInConfirmedOwner();

        $this->adminRequest('PUT', "users/{$owner->id}/role", ['role' => 'admin'])->assertConflict()->assertJsonPath('code', 'own_account');
        $this->adminRequest('POST', "users/{$owner->id}/suspension")->assertConflict()->assertJsonPath('code', 'own_account');
        $this->adminRequest('DELETE', "users/{$owner->id}/suspension")->assertConflict()->assertJsonPath('code', 'own_account');

        $this->assertSame(AdminRole::Owner, $owner->fresh()->role);
        $this->assertNull($owner->fresh()->suspended_at);
        $this->adminRequest('GET', 'me')->assertOk();
    }

    public function test_owners_who_cannot_sign_in_do_not_count_as_active_owners(): void
    {
        $owner = $this->signInConfirmedOwner();
        // Another owner exists but is not active: suspended, or with a reset in progress.
        $suspendedOwner = User::factory()->owner()->suspended()->create();
        $resettingOwner = User::factory()->owner()->create(['two_factor_confirmed_at' => null]);

        // Demoting or suspending those is fine: they do not count as active owners.
        $this->adminRequest('PUT', "users/{$resettingOwner->id}/role", ['role' => 'admin'])->assertOk();
        $this->adminRequest('PUT', "users/{$suspendedOwner->id}/role", ['role' => 'admin'])->assertOk();

        $this->assertSame(1, User::query()->where('role', AdminRole::Owner)->count());
        $this->assertSame(AdminRole::Owner, $owner->fresh()->role);
    }

    public function test_one_owner_demotes_another_who_then_loses_owner_access(): void
    {
        $second = $this->createActiveAdmin(AdminRole::Owner);
        $this->usingAdminClient('second')->signIn($second);
        $this->usingAdminClient('first');
        $first = $this->signInConfirmedOwner();

        $this->adminRequest('PUT', "users/{$second->id}/role", ['role' => 'admin'])->assertOk();

        $this->usingAdminClient('second');
        $this->signIn($second->fresh());
        $this->confirmAdminPassword();
        $this->adminRequest('PUT', "users/{$first->id}/role", ['role' => 'admin'])->assertForbidden();
        $this->assertSame(AdminRole::Owner, $first->fresh()->role);
    }

    public function test_suspension_ends_sessions_and_reactivation_creates_none(): void
    {
        $admin = $this->createActiveAdmin();
        $this->usingAdminClient('admin')->signIn($admin);
        $this->usingAdminClient('owner');
        $owner = $this->signInConfirmedOwner();

        $this->adminRequest('POST', "users/{$admin->id}/suspension")->assertOk()->assertJsonPath('data.status', 'suspended');
        $this->assertSame(0, DB::table('sessions')->where('user_id', $admin->id)->count());
        $this->usingAdminClient('admin')->adminRequest('GET', 'me')->assertUnauthorized();

        // Suspending again changes nothing and records nothing.
        $events = AdminAuditEvent::query()->count();
        $this->usingAdminClient('owner')->adminRequest('POST', "users/{$admin->id}/suspension")->assertOk();
        $this->assertSame($events, AdminAuditEvent::query()->count());

        $this->adminRequest('DELETE', "users/{$admin->id}/suspension")->assertOk()
            ->assertJsonPath('data.status', 'active')
            ->assertJsonPath('data.active_sessions', 0);
        $this->assertSame(0, DB::table('sessions')->where('user_id', $admin->id)->count());
        $this->usingAdminClient('admin')->adminRequest('GET', 'me')->assertUnauthorized();

        // The person signs in again with password and TOTP.
        $this->usingAdminClient('admin-again')->signIn($admin->fresh());
        $this->adminRequest('GET', 'me')->assertOk();
        $this->assertDatabaseHas('admin_audit_events', ['action' => AdminAuditAction::AccountSuspended->value, 'actor_user_id' => $owner->id, 'subject_id' => $admin->id]);
        $this->assertDatabaseHas('admin_audit_events', ['action' => AdminAuditAction::AccountReactivated->value, 'actor_user_id' => $owner->id, 'subject_id' => $admin->id]);
    }

    public function test_writes_need_a_password_confirmation_from_the_last_15_minutes(): void
    {
        $admin = $this->createActiveAdmin();
        $owner = $this->createActiveAdmin(AdminRole::Owner);
        $this->signIn($owner);

        $this->adminRequest('POST', "users/{$admin->id}/suspension")->assertStatus(423)->assertJsonPath('message', 'Password confirmation required.');
        $this->adminRequest('GET', 'users')->assertOk();

        $this->confirmAdminPassword();
        $this->travel(14)->minutes();
        $this->adminRequest('PUT', "users/{$admin->id}/role", ['role' => 'admin'])->assertOk();

        $this->travel(2)->minutes();
        $this->adminRequest('POST', "users/{$admin->id}/suspension")->assertStatus(423);
        $this->assertNull($admin->fresh()->suspended_at);
    }

    public function test_writes_without_csrf_or_from_another_origin_change_nothing(): void
    {
        $admin = $this->createActiveAdmin();
        $this->signInConfirmedOwner();

        $this->adminRequest('POST', "users/{$admin->id}/suspension", sendXsrf: false)->assertStatus(419);
        $this->adminRequest('POST', "users/{$admin->id}/suspension", headers: ['Origin' => 'https://evil.example'])->assertForbidden();
        $this->adminRequest('POST', "users/{$admin->id}/suspension", headers: ['Origin' => null])->assertForbidden();
        $this->adminRequest('POST', "users/{$admin->id}/suspension", headers: ['Sec-Fetch-Site' => 'same-site'])->assertForbidden();
        $this->adminRequest('GET', 'users', headers: ['Sec-Fetch-Site' => 'cross-site'])->assertForbidden();

        $this->assertNull($admin->fresh()->suspended_at);
    }

    public function test_administration_writes_are_rate_limited_per_account(): void
    {
        $admin = $this->createActiveAdmin();
        $this->signInConfirmedOwner();

        for ($attempt = 1; $attempt <= 20; $attempt++) {
            $this->adminRequest('PUT', "users/{$admin->id}/role", ['role' => 'admin'])->assertOk();
        }

        $this->adminRequest('PUT', "users/{$admin->id}/role", ['role' => 'admin'])->assertTooManyRequests()->assertHeader('Retry-After');
        $this->adminRequest('GET', 'users')->assertOk();
    }

    /**
     * @return array<string, array{string, string, AdminAuditAction}>
     */
    public static function auditedWrites(): array
    {
        return [
            'role change' => ['PUT', 'role', AdminAuditAction::RoleChanged],
            'suspension' => ['POST', 'suspension', AdminAuditAction::AccountSuspended],
        ];
    }

    #[DataProvider('auditedWrites')]
    public function test_a_failed_audit_write_undoes_the_change(string $method, string $path, AdminAuditAction $action): void
    {
        $admin = $this->createActiveAdmin();
        $this->usingAdminClient('admin')->signIn($admin);
        $this->usingAdminClient('owner')->signInConfirmedOwner();
        $this->failAuditWritesFor($action);

        $this->adminRequest($method, "users/{$admin->id}/{$path}", ['role' => 'owner'])
            ->assertStatus(500)
            ->assertExactJson(['message' => 'Server Error']);

        $admin->refresh();
        $this->assertSame(AdminRole::Admin, $admin->role);
        $this->assertNull($admin->suspended_at);
        $this->assertSame(1, DB::table('sessions')->where('user_id', $admin->id)->count());
        $this->usingAdminClient('admin')->adminRequest('GET', 'me')->assertOk();
    }

    /**
     * @param  list<User>  $accounts
     */
    private function assertNoAccountSecretsIn(string $content, array $accounts): void
    {
        foreach (['password', 'two_factor_secret', 'two_factor_recovery_codes', 'remember_token', 'token_hash'] as $field) {
            $this->assertStringNotContainsString("\"{$field}\"", $content);
        }

        foreach ($accounts as $account) {
            $account = $account->fresh();
            $this->assertStringNotContainsString($account->password, $content);
            $this->assertStringNotContainsString($this->totpSecret($account), $content);

            foreach ($account->recoveryCodes() as $code) {
                $this->assertStringNotContainsString($code, $content);
            }
        }
    }
}
