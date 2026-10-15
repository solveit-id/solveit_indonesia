<?php

namespace App\Actions;

use App\Enums\InquiryStatus;
use App\Exceptions\InquiryIdempotencyConflictException;
use App\Exceptions\InquiryNotStoredException;
use App\Models\Inquiry;
use Illuminate\Contracts\Database\ConcurrencyErrorDetector;
use Illuminate\Database\QueryException;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\Log;

class SubmitInquiry
{
    /**
     * A public reference collision is astronomically unlikely (60 random bits), and so is
     * a deadlock between concurrent retries of one key; retrying a few times turns either
     * from an error into a non-event.
     */
    private const MAX_ATTEMPTS = 3;

    public function __construct(private readonly ConcurrencyErrorDetector $concurrencyErrors) {}

    /**
     * Store a validated inquiry with a fresh public reference and the `received` status.
     *
     * With an idempotency key the insert itself is the check: the UNIQUE index on the key's
     * hash lets exactly one request store a row, however many PHP workers race. A request
     * that loses the race (or arrives later) gets the stored inquiry back when its content
     * is the same, and a conflict when it is not. The returned model's `wasRecentlyCreated`
     * tells the two outcomes apart.
     *
     * @param  array<string, mixed>  $attributes
     *
     * @throws InquiryNotStoredException when the database does not store the row.
     * @throws InquiryIdempotencyConflictException when the key belongs to a different inquiry.
     */
    public function handle(array $attributes, ?string $idempotencyKey = null): Inquiry
    {
        $keyHash = $idempotencyKey === null ? null : Inquiry::hashIdempotencyKey($idempotencyKey);

        for ($attempt = 1; ; $attempt++) {
            $inquiry = new Inquiry($attributes);
            $inquiry->public_id = Inquiry::newPublicId();
            $inquiry->idempotency_key_hash = $keyHash;
            $inquiry->status = InquiryStatus::Received;

            try {
                $inquiry->save();
            } catch (UniqueConstraintViolationException $exception) {
                // Which index refused the row is read from the data, not the error message:
                // the message also holds the SQL bindings (personal data).
                $stored = $keyHash === null ? null : $this->findByKeyHash($keyHash, $exception);

                if ($stored !== null) {
                    return $this->replay($stored, $attributes);
                }

                if ($attempt < self::MAX_ATTEMPTS) {
                    continue;
                }

                throw InquiryNotStoredException::fromQueryException($exception);
            } catch (QueryException $exception) {
                if ($attempt < self::MAX_ATTEMPTS && $this->concurrencyErrors->causedByConcurrencyError($exception)) {
                    continue;
                }

                throw InquiryNotStoredException::fromQueryException($exception);
            }

            // Only the public reference: never log names, contacts, messages, or keys. The row
            // is already stored, so a failing log channel must not turn it into an error
            // response (the visitor would resubmit). Not reported: reporting writes to the same log.
            rescue(fn () => Log::info('Inquiry received.', ['inquiry' => $inquiry->public_id]), report: false);

            return $inquiry;
        }
    }

    /**
     * The inquiry that already holds this key. A locking read sees the latest committed row
     * even inside a transaction that started before it was committed.
     */
    private function findByKeyHash(string $keyHash, UniqueConstraintViolationException $cause): ?Inquiry
    {
        try {
            return Inquiry::query()->where('idempotency_key_hash', $keyHash)->sharedLock()->first();
        } catch (QueryException) {
            throw InquiryNotStoredException::fromQueryException($cause);
        }
    }

    /**
     * Same key and same content: the original result. Same key, other content: a conflict.
     *
     * @param  array<string, mixed>  $attributes
     *
     * @throws InquiryIdempotencyConflictException
     */
    private function replay(Inquiry $stored, array $attributes): Inquiry
    {
        if (! $stored->matchesSubmission($attributes)) {
            rescue(fn () => Log::notice('Inquiry idempotency key reused with different content.'), report: false);

            throw new InquiryIdempotencyConflictException;
        }

        rescue(fn () => Log::info('Inquiry retry answered with the stored reference.', ['inquiry' => $stored->public_id]), report: false);

        return $stored;
    }
}
