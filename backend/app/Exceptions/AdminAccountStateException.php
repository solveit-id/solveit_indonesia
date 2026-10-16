<?php

namespace App\Exceptions;

use Illuminate\Http\JsonResponse;
use RuntimeException;

/**
 * An account operation would break an invariant (the last active owner, a change to one's
 * own role or suspension) or does not fit the account's state.
 */
class AdminAccountStateException extends RuntimeException
{
    public static function lastActiveOwner(): self
    {
        return new self('At least one active owner must remain.');
    }

    public static function ownAccount(): self
    {
        return new self('You cannot change the role or suspension of your own account.');
    }

    public static function notActivated(): self
    {
        return new self('The account has not been activated.');
    }

    public static function suspended(): self
    {
        return new self('The account is suspended.');
    }

    public static function withoutRole(): self
    {
        return new self('The account has no admin role.');
    }

    public function render(): JsonResponse
    {
        return response()->json(['message' => $this->getMessage()], 409);
    }
}
