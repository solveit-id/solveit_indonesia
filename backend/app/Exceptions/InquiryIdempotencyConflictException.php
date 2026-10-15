<?php

namespace App\Exceptions;

use Illuminate\Http\JsonResponse;
use RuntimeException;

/**
 * An Idempotency-Key that already belongs to a stored inquiry arrived with different content.
 *
 * Nothing is stored and the stored inquiry's reference is not revealed: the request is either
 * a client bug (a key reused for a new submission) or a guess at someone else's key.
 */
class InquiryIdempotencyConflictException extends RuntimeException
{
    public function __construct()
    {
        parent::__construct('This Idempotency-Key was already used for a different inquiry. Send a new submission with a new key.');
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
        return response()->json(['message' => $this->getMessage()], 409);
    }
}
