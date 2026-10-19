<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Actions\Admin\AddInquiryNote;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Admin\AddInquiryNoteRequest;
use App\Http\Requests\Api\V1\Admin\ListInquiryRecordsRequest;
use App\Http\Resources\Admin\AdminInquiryNoteResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * Internal notes of an inquiry (B4a). Append-only: there is no endpoint that edits or
 * deletes a note.
 */
class InquiryNoteController extends Controller
{
    /**
     * Notes, newest first.
     */
    public function index(ListInquiryRecordsRequest $request, string $inquiry): AnonymousResourceCollection
    {
        return AdminInquiryNoteResource::collection(
            InquiryController::findInquiry($inquiry)->notes()
                ->with('author:id,name')
                ->orderByDesc('id')
                ->cursorPaginate($request->perPage())
                ->withQueryString(),
        );
    }

    public function store(AddInquiryNoteRequest $request, AddInquiryNote $addNote, string $inquiry): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();

        $note = $addNote->handle($actor, InquiryController::findInquiry($inquiry), $request->body());

        return (new AdminInquiryNoteResource($note))->response()->setStatusCode(201);
    }
}
