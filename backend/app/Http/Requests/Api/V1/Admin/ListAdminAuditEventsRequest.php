<?php

namespace App\Http\Requests\Api\V1\Admin;

use App\Enums\AdminActorType;
use App\Enums\AdminAuditAction;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;

/**
 * Filters of the owner audit reader. Each maps to an indexed column of
 * admin_audit_events; nothing searches metadata, IP addresses, or user agents.
 */
class ListAdminAuditEventsRequest extends AdminListRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    protected function filterRules(): array
    {
        return [
            'action' => ['sometimes', Rule::enum(AdminAuditAction::class)],
            'actor_type' => ['sometimes', Rule::enum(AdminActorType::class)],
            'actor_user_id' => ['sometimes', 'integer', 'min:1'],
            'subject_user_id' => ['sometimes', 'integer', 'min:1'],
            'subject_inquiry_id' => ['sometimes', 'integer', 'min:1', 'prohibits:subject_user_id'],
            'occurred_from' => ['sometimes', 'date'],
            'occurred_to' => ['sometimes', 'date', ...($this->has('occurred_from') ? ['after_or_equal:occurred_from'] : [])],
        ];
    }

    /**
     * @return array{action: ?AdminAuditAction, actor_type: ?AdminActorType, actor_user_id: ?int, subject_user_id: ?int, subject_inquiry_id: ?int, occurred_from: ?Carbon, occurred_to: ?Carbon}
     */
    public function filters(): array
    {
        $validated = $this->validated();

        return [
            'action' => AdminAuditAction::tryFrom((string) ($validated['action'] ?? '')),
            'actor_type' => AdminActorType::tryFrom((string) ($validated['actor_type'] ?? '')),
            'actor_user_id' => isset($validated['actor_user_id']) ? (int) $validated['actor_user_id'] : null,
            'subject_user_id' => isset($validated['subject_user_id']) ? (int) $validated['subject_user_id'] : null,
            'subject_inquiry_id' => isset($validated['subject_inquiry_id']) ? (int) $validated['subject_inquiry_id'] : null,
            'occurred_from' => isset($validated['occurred_from']) ? Carbon::parse($validated['occurred_from'])->utc() : null,
            'occurred_to' => isset($validated['occurred_to']) ? Carbon::parse($validated['occurred_to'])->utc() : null,
        ];
    }
}
