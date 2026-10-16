<?php

namespace App\Http\Resources\Admin;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Another admin account as an owner sees it in the user list. Never includes the password
 * hash, the TOTP secret, recovery codes, remember token, or session IDs: only whether an
 * authenticator is confirmed.
 *
 * @mixin User
 */
class AdminUserResource extends JsonResource
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
            'name' => $this->name,
            'email' => $this->email,
            'role' => $this->role?->value,
            'status' => $this->adminStatus()->value,
            'is_current_user' => $request->user()?->is($this->resource) === true,
            'two_factor_confirmed' => $this->two_factor_confirmed_at !== null,
            'activated_at' => $this->activated_at?->toIso8601String(),
            'suspended_at' => $this->suspended_at?->toIso8601String(),
            'last_login_at' => $this->last_login_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
