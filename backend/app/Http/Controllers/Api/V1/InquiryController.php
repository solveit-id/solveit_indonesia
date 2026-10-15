<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\SubmitInquiry;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\StoreInquiryRequest;
use App\Http\Resources\InquiryResource;
use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpFoundation\Response;

class InquiryController extends Controller
{
    /**
     * Response header marking a retry answered with the inquiry stored by an earlier request.
     */
    public const REPLAYED_HEADER = 'Idempotent-Replayed';

    /**
     * Store a new inquiry. Responds 201 only after the row is saved. A retry with the same
     * Idempotency-Key and content gets the same 201 body for the row already stored.
     */
    public function store(StoreInquiryRequest $request, SubmitInquiry $submitInquiry): JsonResponse
    {
        $inquiry = $submitInquiry->handle($request->inquiryAttributes(), $request->idempotencyKey());

        $response = (new InquiryResource($inquiry))->response()->setStatusCode(Response::HTTP_CREATED);

        if (! $inquiry->wasRecentlyCreated) {
            $response->headers->set(self::REPLAYED_HEADER, 'true');
        }

        return $response;
    }
}
