<?php

namespace App\Http\Requests\Api\V1\Admin;

use Illuminate\Contracts\Validation\ValidationRule;

/**
 * A page of one inquiry's notes or status history (B4a): no filters, only the page size
 * and the cursor.
 */
class ListInquiryRecordsRequest extends AdminListRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    protected function filterRules(): array
    {
        return [];
    }
}
