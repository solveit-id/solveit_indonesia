<?php

namespace App\Enums;

/**
 * Role of an admin account. One role per user; a user without a role has no access.
 * Only owner and admin exist until the modules for other roles are built (B3.0 decision).
 */
enum AdminRole: string
{
    case Owner = 'owner';
    case Admin = 'admin';

    /**
     * Permissions granted by this role. Anything not listed is denied.
     *
     * @return list<AdminPermission>
     */
    public function permissions(): array
    {
        return match ($this) {
            // Listed one by one: a permission added later is granted to nobody until a
            // role names it here.
            self::Owner => [
                AdminPermission::ManageOwnAccount,
                AdminPermission::ViewUsers,
                AdminPermission::InviteUsers,
                AdminPermission::ChangeUserRoles,
                AdminPermission::SuspendUsers,
                AdminPermission::ResetUserCredentials,
                AdminPermission::ViewAllAuditEvents,
            ],
            self::Admin => [AdminPermission::ManageOwnAccount],
        };
    }

    public function grants(AdminPermission $permission): bool
    {
        return in_array($permission, $this->permissions(), true);
    }
}
