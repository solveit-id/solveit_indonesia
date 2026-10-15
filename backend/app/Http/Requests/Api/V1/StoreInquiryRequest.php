<?php

namespace App\Http\Requests\Api\V1;

use App\Enums\InquiryBudget;
use App\Enums\InquiryService;
use App\Enums\InquiryTimeline;
use App\Exceptions\InvalidIdempotencyKeyException;
use App\Rules\EmailOrPhone;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Contract: docs/api/inquiries.md. Strings arrive trimmed and empty strings
 * as null (Laravel's global TrimStrings and ConvertEmptyStringsToNull middleware).
 */
class StoreInquiryRequest extends FormRequest
{
    /**
     * Hidden form field that people never fill in. Any value rejects the request.
     */
    public const HONEYPOT_FIELD = 'homepage';

    /**
     * Optional request header that makes a retried submission safe (docs/api/inquiries.md).
     */
    public const IDEMPOTENCY_HEADER = 'Idempotency-Key';

    /**
     * A version 4 UUID in its canonical 8-4-4-4-12 form: 122 random bits from the client.
     */
    private const IDEMPOTENCY_KEY_PATTERN = '/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/D';

    /**
     * The endpoint is public: visitors submit without an account.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Reject a malformed Idempotency-Key before the body is validated, so a client bug in the
     * header never looks like a field error.
     *
     * @throws InvalidIdempotencyKeyException
     */
    protected function prepareForValidation(): void
    {
        $this->idempotencyKey();
    }

    /**
     * The normalized (lowercase) Idempotency-Key, or null when the client sent none.
     *
     * @throws InvalidIdempotencyKeyException when the header is repeated, empty, or not a UUID v4.
     */
    public function idempotencyKey(): ?string
    {
        $values = $this->headers->all(self::IDEMPOTENCY_HEADER);

        if ($values === []) {
            return null;
        }

        $key = strtolower((string) $values[0]);

        if (count($values) !== 1 || preg_match(self::IDEMPOTENCY_KEY_PATTERN, $key) !== 1) {
            throw new InvalidIdempotencyKeyException;
        }

        return $key;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'min:2', 'max:120'],
            'organization' => ['nullable', 'string', 'max:160'],
            'contact' => ['required', 'string', 'max:254', new EmailOrPhone],
            'service' => ['required', Rule::enum(InquiryService::class)],
            'budget' => ['required', Rule::enum(InquiryBudget::class)],
            'timeline' => ['required', Rule::enum(InquiryTimeline::class)],
            'message' => ['required', 'string', 'min:20', 'max:5000'],
            self::HONEYPOT_FIELD => ['prohibited'],
        ];
    }

    /**
     * Get custom messages for validator errors.
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            self::HONEYPOT_FIELD.'.prohibited' => 'The submission could not be accepted.',
        ];
    }

    /**
     * The validated inquiry fields, without the honeypot.
     *
     * @return array<string, mixed>
     */
    public function inquiryAttributes(): array
    {
        return $this->safe()->except(self::HONEYPOT_FIELD);
    }
}
