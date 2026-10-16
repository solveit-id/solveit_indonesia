<?php

namespace App\Http\Resources\Admin;

use App\Actions\Admin\RecordAdminAuditEvent;
use App\Models\AdminAuditEvent;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Arr;

/**
 * One audit event for the owner audit reader. Metadata is filtered again against the
 * write-side allowlist, so a key that was never allowed can never be shown. IP address
 * and user agent are included because owners need them to investigate (owner-only
 * endpoint; their retention is still an owner decision).
 *
 * @mixin AdminAuditEvent
 */
class AdminAuditEventResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $metadata = Arr::only((array) ($this->metadata ?? []), RecordAdminAuditEvent::ALLOWED_METADATA_KEYS);

        return [
            'id' => $this->id,
            'occurred_at' => $this->occurred_at->format('Y-m-d\TH:i:s.uP'),
            'action' => $this->action->value,
            'actor' => [
                'type' => $this->actor_type->value,
                'user_id' => $this->actor_user_id,
            ],
            'subject' => $this->subject_type === null ? null : [
                'type' => $this->subject_type,
                'id' => $this->subject_id,
            ],
            'ip_address' => $this->ip_address,
            'user_agent' => $this->user_agent,
            'metadata' => $metadata === [] ? null : $metadata,
        ];
    }
}
