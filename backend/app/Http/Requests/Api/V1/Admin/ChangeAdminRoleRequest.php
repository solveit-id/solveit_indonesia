<?php

namespace App\Http\Requests\Api\V1\Admin;

use App\Enums\AdminRole;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ChangeAdminRoleRequest extends FormRequest
{
    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'role' => ['required', 'string', Rule::enum(AdminRole::class)],
        ];
    }

    public function role(): AdminRole
    {
        return AdminRole::from((string) $this->validated('role'));
    }
}
