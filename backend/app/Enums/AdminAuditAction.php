<?php

namespace App\Enums;

/**
 * Security events written to admin_audit_events. Values are stable identifiers; never
 * rename one that has been stored.
 */
enum AdminAuditAction: string
{
    case OwnerBootstrapIssued = 'owner.bootstrap-issued';
    case OwnerBootstrapRefused = 'owner.bootstrap-refused';
    case CredentialResetIssued = 'credentials.reset-issued';

    case AccessLinkRedeemed = 'access-link.redeemed';
    case AccessLinkRejected = 'access-link.rejected';
    case AccountActivated = 'account.activated';
    case CredentialResetCompleted = 'credentials.reset-completed';
    case TwoFactorEnrollmentFailed = 'mfa.enrollment-failed';

    case LoginSucceeded = 'login.succeeded';
    case LoginFailed = 'login.failed';
    case TwoFactorChallengeFailed = 'mfa.challenge-failed';
    case RecoveryCodeUsed = 'mfa.recovery-code-used';
    case RecoveryCodesRegenerated = 'mfa.recovery-codes-regenerated';
    case PasswordChanged = 'password.changed';
    case Logout = 'logout';

    case SessionRevoked = 'session.revoked';
    case OtherSessionsRevoked = 'session.others-revoked';
    case SessionExpired = 'session.expired';
    case SessionEndedInactiveAccount = 'session.ended-inactive-account';

    case RoleChanged = 'account.role-changed';
    case AccountSuspended = 'account.suspended';
    case AccountReactivated = 'account.reactivated';
}
