<?php

namespace App\Http\Requests\Api\V1\Admin;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Opening a full contact is personal data access and is recorded every time. The caller
 * must acknowledge that explicitly, so a client cannot reveal a contact by accident (a
 * prefetch, a generic retry, a list render).
 */
class RevealInquiryContactRequest extends FormRequest
{
    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'acknowledge_personal_data' => ['required', 'accepted'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'acknowledge_personal_data.required' => 'Confirm that opening the full contact is recorded in the audit log.',
            'acknowledge_personal_data.accepted' => 'Confirm that opening the full contact is recorded in the audit log.',
        ];
    }
}
