<?php

namespace App\Http\Resources\Admin;

use App\Models\Inquiry;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * One inquiry in the admin list (B4a). The contact is masked; the full value is returned
 * only by the recorded reveal. The message is left out of the list (detail only), and the
 * idempotency key hash is never shown.
 *
 * @mixin Inquiry
 */
class AdminInquiryResource extends JsonResource
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
            'reference' => $this->public_id,
            'status' => $this->status->value,
            'name' => $this->name,
            'organization' => $this->organization,
            'contact' => [
                'type' => $this->contactType(),
                'masked' => $this->maskedContact(),
            ],
            'service' => $this->service->value,
            'budget' => $this->budget->value,
            'timeline' => $this->timeline->value,
            'received_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
