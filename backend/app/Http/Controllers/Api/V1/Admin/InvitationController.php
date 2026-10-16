<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Actions\Admin\InviteAdminAccount;
use App\Actions\Admin\RevokeAdminInvitation;
use App\Enums\AdminAccessLinkPurpose;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Admin\InviteAdminAccountRequest;
use App\Http\Requests\Api\V1\Admin\ListAdminInvitationsRequest;
use App\Http\Resources\Admin\AdminInvitationResource;
use App\Models\AdminAccessLink;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

/**
 * Owner invitations (B3.1b): activation links issued to a new or pending account. No
 * email is sent (owner decision): the issuing owner receives the link once, in the
 * response to POST, and delivers it by hand over a trusted channel. Lists and details
 * carry metadata only.
 */
class InvitationController extends Controller
{
    public function index(ListAdminInvitationsRequest $request): AnonymousResourceCollection
    {
        $query = self::invitations()->with('user');

        $request->status()?->constrain($query);

        return AdminInvitationResource::collection(
            $query->orderByDesc('id')->cursorPaginate($request->perPage())->withQueryString(),
        );
    }

    public function show(string $invitation): AdminInvitationResource
    {
        return new AdminInvitationResource(
            self::invitations()->with('user')->whereKey((int) $invitation)->first()
                ?? throw new NotFoundHttpException('Invitation not found.'),
        );
    }

    /**
     * Issue an invitation and return its link, the only time it is ever shown.
     */
    public function store(InviteAdminAccountRequest $request, InviteAdminAccount $inviteAccount): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();

        $issued = $inviteAccount->handle($actor, $request->email(), $request->role());
        $issued->link->load('user');

        return response()->json(['data' => [
            'invitation' => (new AdminInvitationResource($issued->link))->resolve($request),
            'access_link' => [
                'url' => $issued->url,
                'expires_at' => $issued->link->expires_at->toIso8601String(),
            ],
        ]], 201);
    }

    /**
     * Revoke an invitation that is not accepted yet.
     */
    public function destroy(Request $request, RevokeAdminInvitation $revokeInvitation, string $invitation): AdminInvitationResource
    {
        /** @var User $actor */
        $actor = $request->user();

        try {
            $link = $revokeInvitation->handle($actor, (int) $invitation);
        } catch (ModelNotFoundException) {
            throw new NotFoundHttpException('Invitation not found.');
        }

        return new AdminInvitationResource($link->load('user'));
    }

    /**
     * @return Builder<AdminAccessLink>
     */
    private static function invitations(): Builder
    {
        return AdminAccessLink::query()->where('purpose', AdminAccessLinkPurpose::Activation);
    }
}
