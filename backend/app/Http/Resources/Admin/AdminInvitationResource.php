<?php

namespace App\Http\Resources\Admin;

use App\Models\AdminAccessLink;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * An invitation (activation link) by its metadata. The token, its hash, and the URL are
 * never part of it: the URL exists once, in the response that issued it.
 *
 * @mixin AdminAccessLink
 */
class AdminInvitationResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $account = $this->user;

        return [
            'id' => $this->id,
            'status' => $this->status()->value,
            'account' => $account === null ? null : [
                'id' => $account->id,
                'email' => $account->email,
                'role' => $account->role?->value,
                'status' => $account->adminStatus()->value,
            ],
            // NULL when issued on the server shell (owner bootstrap).
            'issued_by_user_id' => $this->created_by_user_id,
            'created_at' => $this->created_at?->toIso8601String(),
            'expires_at' => $this->expires_at->toIso8601String(),
            'redeemed_at' => $this->redeemed_at?->toIso8601String(),
            'completed_at' => $this->completed_at?->toIso8601String(),
            'revoked_at' => $this->revoked_at?->toIso8601String(),
        ];
    }
}
