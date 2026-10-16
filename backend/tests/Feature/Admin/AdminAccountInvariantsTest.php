<?php

namespace Tests\Feature\Admin;

use App\Actions\Admin\ActiveOwners;
use App\Actions\Admin\ChangeAdminRole;
use App\Actions\Admin\SuspendAdminAccount;
use App\Enums\AdminAuditAction;
use App\Enums\AdminRole;
use App\Exceptions\AdminAccountStateException;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\Support\InteractsWithAdminApi;
use Tests\TestCase;

/**
 * Role changes and suspension (exposed over HTTP in B3.1b): who may act, the
 * last-active-owner invariant, no self-change, and immediate session revocation.
 */
class AdminAccountInvariantsTest extends TestCase
{
    use InteractsWithAdminApi;
    use RefreshDatabase;

    public function test_an_owner_changes_another_accounts_role_and_its_sessions_end(): void
    {
        $owner = User::factory()->owner()->create();
        $admin = $this->createActiveAdmin();
        $this->signIn($admin);

        app(ChangeAdminRole::class)->handle($owner, $admin, AdminRole::Owner);

        $this->assertSame(0, DB::table('sessions')->where('user_id', $admin->id)->count());

        $this->assertSame(AdminRole::Owner, $admin->fresh()->role);
        $this->adminRequest('GET', 'me')->assertUnauthorized();
        $this->assertDatabaseHas('admin_audit_events', ['action' => AdminAuditAction::RoleChanged->value, 'actor_user_id' => $owner->id, 'subject_id' => $admin->id]);
    }

    public function test_nobody_changes_their_own_role(): void
    {
        $owner = User::factory()->owner()->create();

        $this->expectExceptionObject(AdminAccountStateException::ownAccount());

        app(ChangeAdminRole::class)->handle($owner, $owner, AdminRole::Admin);
    }

    public function test_an_admin_cannot_change_roles(): void
    {
        $admin = User::factory()->activeAdmin()->create();
        $other = User::factory()->activeAdmin()->create();

        $this->expectException(AuthorizationException::class);

        app(ChangeAdminRole::class)->handle($admin, $other, AdminRole::Owner);
    }

    public function test_a_suspended_owner_cannot_act(): void
    {
        $owner = User::factory()->owner()->suspended()->create();
        $other = User::factory()->activeAdmin()->create();

        $this->expectException(AuthorizationException::class);

        app(SuspendAdminAccount::class)->suspend($owner, $other);
    }

    public function test_the_last_active_owner_cannot_be_removed(): void
    {
        $only = User::factory()->owner()->create();
        $second = User::factory()->owner()->create();

        $this->assertFalse(ActiveOwners::wouldRemoveLast(ActiveOwners::lock(), $only));

        $second->forceFill(['suspended_at' => now()])->save();

        $this->assertTrue(ActiveOwners::wouldRemoveLast(ActiveOwners::lock(), $only));
        $this->assertFalse(ActiveOwners::wouldRemoveLast(ActiveOwners::lock(), $second));
    }

    public function test_one_owner_may_demote_another_and_then_no_longer_acts(): void
    {
        $first = User::factory()->owner()->create();
        $second = User::factory()->owner()->create();

        app(ChangeAdminRole::class)->handle($first, $second, AdminRole::Admin);

        $this->assertSame(AdminRole::Admin, $second->fresh()->role);
        $this->expectException(AuthorizationException::class);
        app(ChangeAdminRole::class)->handle($second->fresh(), $first, AdminRole::Admin);
    }

    public function test_suspension_ends_sessions_and_blocks_sign_in_until_reactivated(): void
    {
        $owner = User::factory()->owner()->create();
        $admin = $this->createActiveAdmin();
        $this->signIn($admin);

        app(SuspendAdminAccount::class)->suspend($owner, $admin);

        $this->assertSame(0, DB::table('sessions')->where('user_id', $admin->id)->count());
        $this->adminRequest('GET', 'me')->assertUnauthorized();
        $this->usingAdminClient('again');
        $this->adminRequest('GET', 'auth/csrf-cookie');
        $this->adminRequest('POST', 'auth/login', ['email' => $admin->email, 'password' => self::ADMIN_PASSWORD])->assertUnprocessable();

        app(SuspendAdminAccount::class)->reactivate($owner, $admin);

        $this->signIn($admin->fresh());
        $this->adminRequest('GET', 'me')->assertOk();
        $this->assertDatabaseHas('admin_audit_events', ['action' => AdminAuditAction::AccountSuspended->value, 'subject_id' => $admin->id]);
        $this->assertDatabaseHas('admin_audit_events', ['action' => AdminAuditAction::AccountReactivated->value, 'subject_id' => $admin->id]);
    }

    public function test_nobody_suspends_themselves(): void
    {
        $owner = User::factory()->owner()->create();

        $this->expectExceptionObject(AdminAccountStateException::ownAccount());

        app(SuspendAdminAccount::class)->suspend($owner, $owner);
    }
}
