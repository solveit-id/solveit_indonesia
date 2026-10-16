<?php

namespace App\Http\Requests\Api\V1\Admin;

use App\Enums\AdminAccountStatus;
use App\Enums\AdminRole;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Rule;

class ListAdminUsersRequest extends AdminListRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    protected function filterRules(): array
    {
        return [
            'role' => ['sometimes', Rule::enum(AdminRole::class)],
            'status' => ['sometimes', Rule::enum(AdminAccountStatus::class)],
        ];
    }

    public function role(): ?AdminRole
    {
        return AdminRole::tryFrom((string) $this->validated('role'));
    }

    public function status(): ?AdminAccountStatus
    {
        return AdminAccountStatus::tryFrom((string) $this->validated('status'));
    }
}
