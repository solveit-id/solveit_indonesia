<?php

namespace App\Http\Requests\Api\V1\Admin;

use App\Models\InquiryNote;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class AddInquiryNoteRequest extends FormRequest
{
    /**
     * Get the validation rules that apply to the request. Surrounding whitespace is trimmed
     * first (TrimStrings), so a note of spaces only is empty.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'body' => ['required', 'string', 'max:'.InquiryNote::MAX_LENGTH],
        ];
    }

    public function body(): string
    {
        return (string) $this->validated('body');
    }
}
