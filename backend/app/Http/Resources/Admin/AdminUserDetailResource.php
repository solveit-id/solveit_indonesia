<?php

namespace App\Http\Resources\Admin;

use App\Models\AdminAccessLink;
use App\Models\User;
use App\Services\AdminSessionStore;
use Illuminate\Http\Request;

/**
 * One admin account in detail: the list fields, the number of its live sessions (never
 * their IDs, addresses, or devices), and its open access link, described by metadata
 * only (never the token or the URL).
 *
 * @mixin User
 */
class AdminUserDetailResource extends AdminUserResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        /** @var AdminAccessLink|null $openLink */
        $openLink = $this->adminAccessLinks()
            ->whereNull('completed_at')
            ->whereNull('revoked_at')
            ->latest('id')
            ->first();

        return [
            ...parent::toArray($request),
            'active_sessions' => app(AdminSessionStore::class)->activeCountFor($this->resource),
            'open_access_link' => $openLink === null ? null : [
                'id' => $openLink->id,
                'purpose' => $openLink->purpose->value,
                'status' => $openLink->status()->value,
                'issued_by_user_id' => $openLink->created_by_user_id,
                'created_at' => $openLink->created_at?->toIso8601String(),
                'expires_at' => $openLink->expires_at->toIso8601String(),
                'redeemed_at' => $openLink->redeemed_at?->toIso8601String(),
            ],
        ];
    }
}
