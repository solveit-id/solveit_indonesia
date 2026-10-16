<?php

namespace App\Exceptions;

use Illuminate\Http\JsonResponse;
use RuntimeException;

/**
 * An account operation would break an invariant (the last active owner, a change to one's
 * own account) or does not fit the state of the account or invitation. Rendered as 409
 * with a stable machine-readable `code` next to the message.
 */
class AdminAccountStateException extends RuntimeException
{
    public function __construct(string $message, public readonly string $reason)
    {
        parent::__construct($message);
    }

    public static function lastActiveOwner(): self
    {
        return new self('At least one active owner must remain.', 'last_active_owner');
    }

    public static function ownAccount(): self
    {
        return new self('You cannot change the role or suspension of your own account.', 'own_account');
    }

    public static function ownCredentials(): self
    {
        return new self('You cannot reset the credentials of your own account. Change your password or recovery codes in your account settings.', 'own_account');
    }

    public static function notActivated(): self
    {
        return new self('The account has not been activated.', 'not_activated');
    }

    public static function suspended(): self
    {
        return new self('The account is suspended.', 'suspended');
    }

    public static function withoutRole(): self
    {
        return new self('The account has no admin role.', 'not_admin_account');
    }

    public static function accountExists(): self
    {
        return new self('An activated account already uses this address.', 'account_exists');
    }

    public static function invitationPending(): self
    {
        return new self('This account already has an open invitation. Revoke it before issuing a new one.', 'invitation_pending');
    }

    public static function invitationCompleted(): self
    {
        return new self('The invitation has already been accepted.', 'invitation_completed');
    }

    public function render(): JsonResponse
    {
        return response()->json(['message' => $this->getMessage(), 'code' => $this->reason], 409);
    }
}
