<?php

namespace App\Http\Resources\Admin;

use App\Enums\InquiryStatus;
use App\Models\Inquiry;
use Illuminate\Http\Request;

/**
 * One inquiry in full for the admin (B4a): the list fields, the message, the statuses it
 * may move to, and how many notes and status changes it has (read them page by page; the
 * controller loads both counts). The contact stays masked.
 *
 * @mixin Inquiry
 */
class AdminInquiryDetailResource extends AdminInquiryResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            ...parent::toArray($request),
            'message' => $this->message,
            'allowed_transitions' => array_map(
                fn (InquiryStatus $status): string => $status->value,
                $this->status->allowedTransitions(),
            ),
            'notes_count' => (int) $this->notes_count,
            'status_changes_count' => (int) $this->status_changes_count,
        ];
    }
}
