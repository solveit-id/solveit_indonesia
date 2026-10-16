<?php

namespace App\Exceptions;

use Illuminate\Http\JsonResponse;
use RuntimeException;

/**
 * An access link (or the enrollment started with it) cannot be used: unknown, expired,
 * already used, revoked, or for an account in the wrong state. One answer for all cases.
 */
class InvalidAdminAccessLinkException extends RuntimeException
{
    public function __construct()
    {
        parent::__construct('This access link is invalid or has expired.');
    }

    public function render(): JsonResponse
    {
        return response()->json(['message' => $this->getMessage()], 404);
    }
}
