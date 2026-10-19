<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Actions\Admin\ChangeInquiryStatus;
use App\Actions\Admin\RevealInquiryContact;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Admin\ChangeInquiryStatusRequest;
use App\Http\Requests\Api\V1\Admin\ListInquiriesRequest;
use App\Http\Requests\Api\V1\Admin\ListInquiryRecordsRequest;
use App\Http\Requests\Api\V1\Admin\RevealInquiryContactRequest;
use App\Http\Resources\Admin\AdminInquiryDetailResource;
use App\Http\Resources\Admin\AdminInquiryResource;
use App\Http\Resources\Admin\AdminInquiryStatusChangeResource;
use App\Models\Inquiry;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

/**
 * Inquiry management for the admin team (B4a). Every route carries its own `can:`
 * permission; the inquiry is looked up only after that check (no implicit model binding),
 * so a request without the permission cannot learn whether an ID exists. Contacts are
 * masked everywhere except in the recorded reveal. What the visitor sent is never changed.
 */
class InquiryController extends Controller
{
    /**
     * Columns of the list: everything the list shows, without the message.
     */
    private const LIST_COLUMNS = ['id', 'public_id', 'status', 'name', 'organization', 'contact', 'service', 'budget', 'timeline', 'created_at', 'updated_at'];

    /**
     * Newest first by `id`, which is unique and grows with every insert, so pages are
     * deterministic and a new inquiry never shifts the next page.
     */
    public function index(ListInquiriesRequest $request): AnonymousResourceCollection
    {
        $filters = $request->filters();
        $query = Inquiry::query()->select(self::LIST_COLUMNS);

        if ($filters['status'] !== null) {
            $query->where('status', $filters['status']);
        }

        if ($filters['service'] !== null) {
            $query->where('service', $filters['service']);
        }

        if ($filters['received_from'] !== null) {
            $query->where('created_at', '>=', $filters['received_from']);
        }

        if ($filters['received_to'] !== null) {
            $query->where('created_at', '<=', $filters['received_to']);
        }

        if ($filters['reference'] !== null) {
            $query->where('public_id', $filters['reference']);
        }

        return AdminInquiryResource::collection(
            $query->orderByDesc('id')->cursorPaginate($request->perPage())->withQueryString(),
        );
    }

    public function show(string $inquiry): AdminInquiryDetailResource
    {
        return new AdminInquiryDetailResource(self::findInquiry($inquiry)->loadCount(['notes', 'statusChanges']));
    }

    /**
     * The status history, newest first.
     */
    public function statusChanges(ListInquiryRecordsRequest $request, string $inquiry): AnonymousResourceCollection
    {
        return AdminInquiryStatusChangeResource::collection(
            self::findInquiry($inquiry)->statusChanges()
                ->with('changedBy:id,name')
                ->orderByDesc('id')
                ->cursorPaginate($request->perPage())
                ->withQueryString(),
        );
    }

    /**
     * Change the workflow status (compare and set against `expected_status`).
     */
    public function updateStatus(ChangeInquiryStatusRequest $request, ChangeInquiryStatus $changeStatus, string $inquiry): AdminInquiryDetailResource
    {
        $changed = $changeStatus->handle(self::actor($request), self::findInquiry($inquiry), $request->status(), $request->expectedStatus());

        return new AdminInquiryDetailResource($changed->loadCount(['notes', 'statusChanges']));
    }

    /**
     * The full contact, only after the reveal is recorded in the audit log.
     */
    public function revealContact(RevealInquiryContactRequest $request, RevealInquiryContact $revealContact, string $inquiry): JsonResponse
    {
        $found = self::findInquiry($inquiry);
        $event = $revealContact->handle(self::actor($request), $found);

        return response()->json(['data' => [
            'id' => $found->id,
            'reference' => $found->public_id,
            'contact' => [
                'type' => $found->contactType(),
                'value' => $found->contact,
            ],
            'revealed_at' => $event->occurred_at->format('Y-m-d\TH:i:s.uP'),
        ]]);
    }

    private static function actor(Request $request): User
    {
        /** @var User $actor */
        $actor = $request->user();

        return $actor;
    }

    /**
     * @throws NotFoundHttpException
     */
    public static function findInquiry(string $id): Inquiry
    {
        return Inquiry::query()->whereKey((int) $id)->first()
            ?? throw new NotFoundHttpException('Inquiry not found.');
    }
}
