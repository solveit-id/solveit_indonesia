<?php

namespace App\Http\Resources\Admin;

use App\Enums\AdminPermission;
use App\Listeners\RecordAdminAuthenticationEvents;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Carbon;

/**
 * The signed-in account as the admin application sees it. Never includes the password
 * hash, the TOTP secret, or recovery codes.
 *
 * @mixin User
 */
class AdminAccountResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $signedInAt = $request->hasSession() ? $request->session()->get(RecordAdminAuthenticationEvents::SIGNED_IN_AT) : null;

        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'role' => $this->role?->value,
            'permissions' => array_map(fn (AdminPermission $permission): string => $permission->value, $this->adminPermissions()),
            'two_factor' => [
                'confirmed_at' => $this->two_factor_confirmed_at?->toIso8601String(),
                'recovery_codes_remaining' => $this->recoveryCodesRemaining(),
            ],
            'session' => [
                'signed_in_at' => is_int($signedInAt) ? Carbon::createFromTimestamp($signedInAt)->toIso8601String() : null,
                'absolute_expires_at' => is_int($signedInAt)
                    ? Carbon::createFromTimestamp($signedInAt)->addMinutes((int) config('admin.session.absolute_lifetime_minutes'))->toIso8601String()
                    : null,
                'idle_timeout_minutes' => (int) config('session.lifetime'),
            ],
        ];
    }
}
