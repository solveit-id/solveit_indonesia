<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Admin\ListAdminAuditEventsRequest;
use App\Http\Resources\Admin\AdminAuditEventResource;
use App\Models\AdminAuditEvent;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * Owner-only, read-only audit reader (B3.1b; owner decision: only owners read the whole
 * log). Newest first by `id`, which is unique and grows with every insert, so pages are
 * deterministic and a cursor never skips or repeats an event. There is no endpoint that
 * changes, deletes, prunes, or exports events.
 */
class AuditEventController extends Controller
{
    public function index(ListAdminAuditEventsRequest $request): AnonymousResourceCollection
    {
        $filters = $request->filters();
        $query = AdminAuditEvent::query();

        if ($filters['action'] !== null) {
            $query->where('action', $filters['action']);
        }

        if ($filters['actor_type'] !== null) {
            $query->where('actor_type', $filters['actor_type']);
        }

        if ($filters['actor_user_id'] !== null) {
            $query->where('actor_user_id', $filters['actor_user_id']);
        }

        if ($filters['subject_user_id'] !== null) {
            $query->where('subject_type', 'user')->where('subject_id', $filters['subject_user_id']);
        }

        if ($filters['occurred_from'] !== null) {
            $query->where('occurred_at', '>=', $filters['occurred_from']);
        }

        if ($filters['occurred_to'] !== null) {
            $query->where('occurred_at', '<=', $filters['occurred_to']);
        }

        return AdminAuditEventResource::collection(
            $query->orderByDesc('id')->cursorPaginate($request->perPage())->withQueryString(),
        );
    }
}
