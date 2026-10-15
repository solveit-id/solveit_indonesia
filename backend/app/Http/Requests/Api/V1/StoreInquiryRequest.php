<?php

namespace App\Http\Requests\Api\V1;

use App\Enums\InquiryBudget;
use App\Enums\InquiryService;
use App\Enums\InquiryTimeline;
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
     * The endpoint is public: visitors submit without an account.
     */
    public function authorize(): bool
    {
        return true;
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
