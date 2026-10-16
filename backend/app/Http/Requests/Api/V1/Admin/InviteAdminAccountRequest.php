<?php

namespace App\Http\Requests\Api\V1\Admin;

use App\Enums\AdminRole;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Who to invite and with which role. The name is set by the invitee when they accept.
 */
class InviteAdminAccountRequest extends FormRequest
{
    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            // RFC syntax only: the backend has no internet access for DNS checks.
            'email' => ['required', 'string', 'max:254', 'email:rfc'],
            'role' => ['required', 'string', Rule::enum(AdminRole::class)],
        ];
    }

    public function email(): string
    {
        return mb_strtolower(trim((string) $this->validated('email')));
    }

    public function role(): AdminRole
    {
        return AdminRole::from((string) $this->validated('role'));
    }
}
