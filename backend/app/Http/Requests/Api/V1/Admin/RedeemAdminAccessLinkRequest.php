<?php

namespace App\Http\Requests\Api\V1\Admin;

use App\Enums\AdminAccessLinkPurpose;
use App\Models\AdminAccessLink;
use App\Rules\MaxBytes;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class RedeemAdminAccessLinkRequest extends InspectAdminAccessLinkRequest
{
    /**
     * Get the validation rules that apply to the request. The name is asked only when the
     * link activates a new account.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            ...parent::rules(),
            'name' => [Rule::requiredIf(fn (): bool => $this->purpose() === AdminAccessLinkPurpose::Activation), 'nullable', 'string', 'max:120'],
            'password' => ['required', 'string', 'confirmed', Password::defaults(), new MaxBytes(72)],
        ];
    }

    /**
     * @return array{password: string, name?: string}
     */
    public function credentials(): array
    {
        return array_filter([
            'password' => (string) $this->validated('password'),
            'name' => $this->validated('name') === null ? null : trim((string) $this->validated('name')),
        ], fn (?string $value): bool => $value !== null);
    }

    private function purpose(): ?AdminAccessLinkPurpose
    {
        $token = $this->input('token');

        if (! is_string($token)) {
            return null;
        }

        $purpose = AdminAccessLink::query()->where('token_hash', AdminAccessLink::hashToken($token))->value('purpose');

        return $purpose instanceof AdminAccessLinkPurpose ? $purpose : null;
    }
}
