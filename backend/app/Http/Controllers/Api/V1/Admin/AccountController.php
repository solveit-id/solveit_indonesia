<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Actions\Admin\RecordAdminAuditEvent;
use App\Actions\Admin\UpdateAdminPassword;
use App\Enums\AdminActorType;
use App\Enums\AdminAuditAction;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Admin\UpdateAdminPasswordRequest;
use App\Http\Resources\Admin\AdminAccountResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Laravel\Fortify\Actions\GenerateNewRecoveryCodes;

/**
 * The signed-in account: profile, password, recovery codes.
 */
class AccountController extends Controller
{
    public function show(Request $request): AdminAccountResource
    {
        return new AdminAccountResource($request->user());
    }

    /**
     * Change the password (the current one is required). Other sessions end; this one
     * continues with a new session ID.
     */
    public function updatePassword(UpdateAdminPasswordRequest $request, UpdateAdminPassword $updatePassword): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $sessionsEnded = $updatePassword->handle($user, $request->newPassword(), $request->session()->getId());
        $request->session()->regenerate();

        return response()->json(['data' => ['other_sessions_ended' => $sessionsEnded]]);
    }

    /**
     * Replace all recovery codes (after a recent password confirmation). The new codes are
     * shown only in this response; the old ones stop working.
     */
    public function regenerateRecoveryCodes(Request $request, GenerateNewRecoveryCodes $generateRecoveryCodes, RecordAdminAuditEvent $recordAuditEvent): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $generateRecoveryCodes($user);

        $recordAuditEvent->handle(
            AdminAuditAction::RecoveryCodesRegenerated,
            AdminActorType::User,
            actor: $user,
            subject: $user,
            metadata: ['recovery_codes_remaining' => $user->recoveryCodesRemaining()],
        );

        return response()->json(['data' => ['recovery_codes' => $user->recoveryCodes()]]);
    }
}
