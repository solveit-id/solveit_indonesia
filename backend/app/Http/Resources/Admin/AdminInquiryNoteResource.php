<?php

namespace App\Http\Resources\Admin;

use App\Models\InquiryNote;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * One internal note of an inquiry (B4a). The author is named by account ID and display
 * name only, never by email address.
 *
 * @mixin InquiryNote
 */
class AdminInquiryNoteResource extends JsonResource
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
            'body' => $this->body,
            'author' => [
                'user_id' => $this->author_user_id,
                'name' => $this->author?->name,
            ],
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
