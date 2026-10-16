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
            self::Owner, self::Admin => [AdminPermission::ManageOwnAccount],
        };
    }

    public function grants(AdminPermission $permission): bool
    {
        return in_array($permission, $this->permissions(), true);
    }
}
