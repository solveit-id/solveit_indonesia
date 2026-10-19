<?php

namespace App\Http\Requests\Api\V1\Admin;

use App\Enums\InquiryStatus;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * The new status and the status the caller read before deciding (`expected_status`), so a
 * change made by someone else in between is refused instead of overwritten.
 */
class ChangeInquiryStatusRequest extends FormRequest
{
    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'status' => ['required', 'string', Rule::enum(InquiryStatus::class)],
            'expected_status' => ['required', 'string', Rule::enum(InquiryStatus::class)],
        ];
    }

    public function status(): InquiryStatus
    {
        return InquiryStatus::from((string) $this->validated('status'));
    }

    public function expectedStatus(): InquiryStatus
    {
        return InquiryStatus::from((string) $this->validated('expected_status'));
    }
}
