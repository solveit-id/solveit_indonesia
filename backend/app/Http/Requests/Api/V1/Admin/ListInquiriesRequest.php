<?php

namespace App\Http\Requests\Api\V1\Admin;

use App\Enums\InquiryService;
use App\Enums\InquiryStatus;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;

/**
 * Filters of the inquiry list (B4a). Each maps to an indexed column of `inquiries`
 * (`status`, `service`, `created_at`, `public_id`); nothing searches names, contacts, or
 * messages, so a filter value never becomes a full scan over personal data.
 */
class ListInquiriesRequest extends AdminListRequest
{
    /**
     * Same pattern as Inquiry::newPublicId(): Crockford base32 in three groups of four.
     */
    private const REFERENCE = '/^INQ-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/';

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    protected function filterRules(): array
    {
        return [
            'status' => ['sometimes', Rule::enum(InquiryStatus::class)],
            'service' => ['sometimes', Rule::enum(InquiryService::class)],
            'received_from' => ['sometimes', 'date'],
            'received_to' => ['sometimes', 'date', ...($this->has('received_from') ? ['after_or_equal:received_from'] : [])],
            'reference' => ['sometimes', 'string', 'regex:'.self::REFERENCE],
        ];
    }

    /**
     * @return array{status: ?InquiryStatus, service: ?InquiryService, received_from: ?Carbon, received_to: ?Carbon, reference: ?string}
     */
    public function filters(): array
    {
        $validated = $this->validated();

        return [
            'status' => InquiryStatus::tryFrom((string) ($validated['status'] ?? '')),
            'service' => InquiryService::tryFrom((string) ($validated['service'] ?? '')),
            'received_from' => isset($validated['received_from']) ? Carbon::parse($validated['received_from'])->utc() : null,
            'received_to' => isset($validated['received_to']) ? Carbon::parse($validated['received_to'])->utc() : null,
            'reference' => isset($validated['reference']) ? (string) $validated['reference'] : null,
        ];
    }
}
