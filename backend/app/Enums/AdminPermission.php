<?php

namespace App\Enums;

/**
 * Narrow admin abilities, each registered as a Gate with the same name
 * (App\Providers\AppServiceProvider). Add a case only together with the endpoint that
 * needs it.
 */
enum AdminPermission: string
{
    /** Read and manage one's own account: profile, password, recovery codes, sessions. */
    case ManageOwnAccount = 'account.manage-own';

    /** List and read admin accounts and invitations (B3.1b). */
    case ViewUsers = 'users.view';

    /** Invite a new account and revoke an invitation that is not used yet (B3.1b). */
    case InviteUsers = 'users.invite';

    /** Change another account's role (B3.1b). */
    case ChangeUserRoles = 'users.change-role';

    /** Suspend and reactivate another account (B3.1b). */
    case SuspendUsers = 'users.suspend';

    /** Issue a credential-reset link for another account (B3.1b). */
    case ResetUserCredentials = 'users.reset-credentials';

    /** Read the whole admin audit log (B3.1b, owner decision: owners only). */
    case ViewAllAuditEvents = 'audit.view-all';
}
