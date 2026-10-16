<?php

namespace App\Http\Requests\Api\V1\Admin;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

/**
 * A credential reset locks the account out at once (its authenticator is removed and its
 * sessions end) until the person completes the new link. The owner must acknowledge that
 * explicitly, so a client cannot issue one without asking.
 */
class IssueCredentialResetRequest extends FormRequest
{
    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'acknowledge_access_loss' => ['required', 'accepted'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'acknowledge_access_loss.required' => 'Confirm that the account loses access until the reset link is completed.',
            'acknowledge_access_loss.accepted' => 'Confirm that the account loses access until the reset link is completed.',
        ];
    }
}
