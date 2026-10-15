<?php

namespace App\Exceptions;

use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use RuntimeException;

/**
 * The database refused or could not store an inquiry.
 *
 * The original QueryException is deliberately not chained: its message holds
 * the SQL bindings, which are the visitor's personal data, and would end up in
 * the log. Only the SQLSTATE code is kept for diagnosis.
 */
class InquiryNotStoredException extends RuntimeException
{
    public function __construct(private readonly ?string $sqlState = null)
    {
        parent::__construct('The inquiry could not be stored.');
    }

    public static function fromQueryException(QueryException $exception): self
    {
        $sqlState = $exception->errorInfo[0] ?? $exception->getCode();

        return new self($sqlState === null ? null : (string) $sqlState);
    }

    /**
     * Get the exception's context information.
     *
     * @return array{sqlstate: ?string}
     */
    public function context(): array
    {
        return ['sqlstate' => $this->sqlState];
    }

    /**
     * Never report success when nothing was stored.
     */
    public function render(): JsonResponse
    {
        return response()->json([
            'message' => 'The inquiry could not be saved. Please try again later or contact us by WhatsApp or email.',
        ], 503);
    }
}
