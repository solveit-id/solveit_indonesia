<?php

namespace App\Http\Requests\Api\V1\Admin;

use App\Enums\AdminAccessLinkStatus;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Rule;

class ListAdminInvitationsRequest extends AdminListRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    protected function filterRules(): array
    {
        return [
            'status' => ['sometimes', Rule::enum(AdminAccessLinkStatus::class)],
        ];
    }

    public function status(): ?AdminAccessLinkStatus
    {
        return AdminAccessLinkStatus::tryFrom((string) $this->validated('status'));
    }
}
