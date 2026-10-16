<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Actions\Admin\RecordAdminAuditEvent;
use App\Enums\AdminActorType;
use App\Enums\AdminAuditAction;
use App\Http\Controllers\Controller;
use App\Http\Resources\Admin\AdminSessionResource;
use App\Models\User;
use App\Services\AdminSessionStore;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

/**
 * The signed-in account's own sessions (devices).
 */
class SessionController extends Controller
{
    public function __construct(
        private readonly AdminSessionStore $sessions,
        private readonly RecordAdminAuditEvent $recordAuditEvent,
    ) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        /** @var User $user */
        $user = $request->user();

        return AdminSessionResource::collection($this->sessions->forUser($user));
    }

    /**
     * End one other session. The current one ends through sign-out instead.
     */
    public function destroy(Request $request, string $session): JsonResponse|Response
    {
        /** @var User $user */
        $user = $request->user();

        if (hash_equals($this->sessions->handleFor($request->session()->getId()), $session)) {
            return response()->json(['message' => 'Sign out to end the current session.'], 422);
        }

        if (! $this->sessions->revokeByHandle($user, $session)) {
            return response()->json(['message' => 'Session not found.'], 404);
        }

        $this->recordAuditEvent->handle(AdminAuditAction::SessionRevoked, AdminActorType::User, actor: $user, subject: $user, metadata: ['sessions_ended' => 1]);

        return response()->noContent();
    }

    /**
     * End every session of the account except this one.
     */
    public function destroyOthers(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $sessionsEnded = $this->sessions->revokeAll($user, $request->session()->getId());

        $this->recordAuditEvent->handle(AdminAuditAction::OtherSessionsRevoked, AdminActorType::User, actor: $user, subject: $user, metadata: ['sessions_ended' => $sessionsEnded]);

        return response()->json(['data' => ['other_sessions_ended' => $sessionsEnded]]);
    }
}
