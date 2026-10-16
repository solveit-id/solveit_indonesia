<?php

namespace App\Http\Requests\Api\V1\Admin;

use App\Models\AdminAccessLink;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

/**
 * The token of an access link, sent in the body (never in the URL path or query, so it
 * stays out of access logs).
 */
class InspectAdminAccessLinkRequest extends FormRequest
{
    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'token' => ['required', 'string', 'size:'.AdminAccessLink::TOKEN_LENGTH, 'regex:/^[A-Za-z0-9_-]+$/'],
        ];
    }

    public function token(): string
    {
        return (string) $this->validated('token');
    }
}
