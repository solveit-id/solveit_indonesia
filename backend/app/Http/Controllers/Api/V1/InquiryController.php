<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\SubmitInquiry;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\StoreInquiryRequest;
use App\Http\Resources\InquiryResource;

class InquiryController extends Controller
{
    /**
     * Store a new inquiry. Responds 201 only after the row is saved.
     */
    public function store(StoreInquiryRequest $request, SubmitInquiry $submitInquiry): InquiryResource
    {
        return new InquiryResource($submitInquiry->handle($request->inquiryAttributes()));
    }
}
