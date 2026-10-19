<?php

namespace App\Http\Resources\Admin;

use App\Models\InquiryStatusChange;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * One step of an inquiry's status history (B4a). The account that made it is named by ID
 * and display name only, never by email address.
 *
 * @mixin InquiryStatusChange
 */
class AdminInquiryStatusChangeResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'from_status' => $this->from_status->value,
            'to_status' => $this->to_status->value,
            'changed_by' => [
                'user_id' => $this->changed_by_user_id,
                'name' => $this->changedBy?->name,
            ],
            'changed_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
