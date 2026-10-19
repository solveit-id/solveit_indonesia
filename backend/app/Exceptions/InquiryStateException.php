<?php

namespace App\Exceptions;

use Illuminate\Http\JsonResponse;
use RuntimeException;

/**
 * A status change does not fit the inquiry as it is stored now. Rendered as 409 with a
 * stable machine-readable `code`, like App\Exceptions\AdminAccountStateException.
 */
class InquiryStateException extends RuntimeException
{
    public function __construct(string $message, public readonly string $reason)
    {
        parent::__construct($message);
    }

    /**
     * Someone else changed the status after the caller read it.
     */
    public static function statusChanged(): self
    {
        return new self('The inquiry status has changed since it was read. Read it again before changing it.', 'status_changed');
    }

    public static function transitionNotAllowed(): self
    {
        return new self('The inquiry cannot move from its current status to the requested one.', 'transition_not_allowed');
    }

    public function render(): JsonResponse
    {
        return response()->json(['message' => $this->getMessage(), 'code' => $this->reason], 409);
    }
}
