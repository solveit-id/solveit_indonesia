<?php

namespace App\Exceptions;

use Illuminate\Http\JsonResponse;
use RuntimeException;

/**
 * The Idempotency-Key header is present but is not exactly one UUID version 4 (any letter case).
 *
 * Rejected before validation and before anything is stored, so the client can fix the
 * header and retry. The header value is never echoed or logged.
 */
class InvalidIdempotencyKeyException extends RuntimeException
{
    public function __construct()
    {
        parent::__construct('The Idempotency-Key header must be a single UUID (version 4).');
    }

    /**
     * A client error, not an application fault: nothing to report.
     */
    public function report(): bool
    {
        return true;
    }

    public function render(): JsonResponse
    {
        return response()->json(['message' => $this->getMessage()], 400);
    }
}
