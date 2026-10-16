<?php

namespace Tests\Feature\Admin;

use App\Enums\AdminPermission;
use App\Enums\AdminRole;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Gate;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * The permission matrix at the Gate level. Endpoint tests show that routes ask the Gate.
 */
class AdminAuthorizationTest extends TestCase
{
    use RefreshDatabase;

    public function test_owner_and_admin_may_manage_their_own_account(): void
    {
        foreach ([AdminRole::Owner, AdminRole::Admin] as $role) {
            $user = User::factory()->activeAdmin($role)->create();

            $this->assertTrue(Gate::forUser($user)->allows(AdminPermission::ManageOwnAccount->value), $role->value);
        }
    }

    /**
     * The complete matrix (B3.1b): owners hold every permission, admins only their own
     * account. A permission added later must be added here, or this test fails.
     *
     * @return array<string, array{AdminPermission, bool, bool}>
     */
    public static function permissionMatrix(): array
    {
        return [
            'account.manage-own' => [AdminPermission::ManageOwnAccount, true, true],
            'users.view' => [AdminPermission::ViewUsers, true, false],
            'users.invite' => [AdminPermission::InviteUsers, true, false],
            'users.change-role' => [AdminPermission::ChangeUserRoles, true, false],
            'users.suspend' => [AdminPermission::SuspendUsers, true, false],
            'users.reset-credentials' => [AdminPermission::ResetUserCredentials, true, false],
            'audit.view-all' => [AdminPermission::ViewAllAuditEvents, true, false],
        ];
    }

    #[DataProvider('permissionMatrix')]
    public function test_the_permission_matrix(AdminPermission $permission, bool $owner, bool $admin): void
    {
        $this->assertSame($owner, Gate::forUser(User::factory()->owner()->create())->allows($permission->value));
        $this->assertSame($admin, Gate::forUser(User::factory()->activeAdmin()->create())->allows($permission->value));
    }

    public function test_the_matrix_covers_every_permission(): void
    {
        $this->assertEqualsCanonicalizing(
            array_map(fn (AdminPermission $permission): string => $permission->value, AdminPermission::cases()),
            array_keys(self::permissionMatrix()),
        );
    }

    /**
     * @return array<string, array{\Closure(): User}>
     */
    public static function accountsWithoutAccess(): array
    {
        return [
            'no role' => [fn (): User => User::factory()->create()],
            'not activated' => [fn (): User => User::factory()->pendingActivation(AdminRole::Owner)->create()],
            'suspended' => [fn (): User => User::factory()->owner()->suspended()->create()],
            'authenticator not confirmed' => [fn (): User => User::factory()->owner()->create(['two_factor_confirmed_at' => null])],
        ];
    }

    /**
     * @param  \Closure(): User  $makeUser
     */
    #[DataProvider('accountsWithoutAccess')]
    public function test_accounts_that_cannot_sign_in_hold_no_permission(\Closure $makeUser): void
    {
        $user = $makeUser();

        foreach (AdminPermission::cases() as $permission) {
            $this->assertFalse(Gate::forUser($user)->allows($permission->value));
        }

        $this->assertSame([], $user->adminPermissions());
    }

    public function test_undefined_abilities_are_denied(): void
    {
        $owner = User::factory()->owner()->create();

        $this->assertFalse(Gate::forUser($owner)->allows('users.manage'));
        $this->assertFalse(Gate::forUser($owner)->allows('inquiries.view'));
    }

    public function test_only_owner_and_admin_roles_exist(): void
    {
        $this->assertSame(['owner', 'admin'], array_map(fn (AdminRole $role): string => $role->value, AdminRole::cases()));
    }
}
