<?php

namespace App\Http\Requests\Api\V1\Admin;

use App\Rules\MaxBytes;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Password;

class UpdateAdminPasswordRequest extends FormRequest
{
    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'current_password' => ['required', 'string', 'current_password:web'],
            'password' => ['required', 'string', 'confirmed', 'different:current_password', Password::defaults(), new MaxBytes(72)],
        ];
    }

    public function newPassword(): string
    {
        return (string) $this->validated('password');
    }
}
