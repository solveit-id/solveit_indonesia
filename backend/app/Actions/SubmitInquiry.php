<?php

namespace App\Actions;

use App\Enums\InquiryStatus;
use App\Exceptions\InquiryNotStoredException;
use App\Models\Inquiry;
use Illuminate\Database\QueryException;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\Log;

class SubmitInquiry
{
    /**
     * A public reference collision is astronomically unlikely (60 random bits);
     * retrying a few times turns it from an error into a non-event.
     */
    private const MAX_ATTEMPTS = 3;

    /**
     * Store a validated inquiry with a fresh public reference and the `received` status.
     *
     * @param  array<string, mixed>  $attributes
     *
     * @throws InquiryNotStoredException when the database does not store the row.
     */
    public function handle(array $attributes): Inquiry
    {
        for ($attempt = 1; ; $attempt++) {
            $inquiry = new Inquiry($attributes);
            $inquiry->public_id = Inquiry::newPublicId();
            $inquiry->status = InquiryStatus::Received;

            try {
                $inquiry->save();
            } catch (UniqueConstraintViolationException $exception) {
                if ($attempt < self::MAX_ATTEMPTS) {
                    continue;
                }

                throw InquiryNotStoredException::fromQueryException($exception);
            } catch (QueryException $exception) {
                throw InquiryNotStoredException::fromQueryException($exception);
            }

            // Only the public reference: never log names, contacts, or messages.
            Log::info('Inquiry received.', ['inquiry' => $inquiry->public_id]);

            return $inquiry;
        }
    }
}
