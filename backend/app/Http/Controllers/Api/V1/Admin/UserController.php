<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Actions\Admin\ChangeAdminRole;
use App\Actions\Admin\ResetAdminCredentials;
use App\Actions\Admin\SuspendAdminAccount;
use App\Enums\AdminActorType;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Admin\ChangeAdminRoleRequest;
use App\Http\Requests\Api\V1\Admin\IssueCredentialResetRequest;
use App\Http\Requests\Api\V1\Admin\ListAdminUsersRequest;
use App\Http\Resources\Admin\AdminUserDetailResource;
use App\Http\Resources\Admin\AdminUserResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

/**
 * Owner user administration (B3.1b). Every route carries its own `can:` permission;
 * the account is looked up only after that check (no implicit model binding), so a
 * request without the permission cannot learn whether an ID exists. Accounts without a
 * role are not admin accounts and are never listed or found here.
 */
class UserController extends Controller
{
    public function index(ListAdminUsersRequest $request): AnonymousResourceCollection
    {
        $query = User::query()->whereNotNull('role');

        if ($role = $request->role()) {
            $query->where('role', $role);
        }

        $request->status()?->constrain($query);

        return AdminUserResource::collection(
            $query->orderBy('id')->cursorPaginate($request->perPage())->withQueryString(),
        );
    }

    public function show(string $user): AdminUserDetailResource
    {
        return new AdminUserDetailResource(self::findAccount($user));
    }

    /**
     * Change the role. The account's sessions end, so the new role applies at once.
     */
    public function updateRole(ChangeAdminRoleRequest $request, ChangeAdminRole $changeRole, string $user): AdminUserDetailResource
    {
        return new AdminUserDetailResource($changeRole->handle(self::actor($request), self::findAccount($user), $request->role()));
    }

    /**
     * Suspend: sessions end and open access links are revoked.
     */
    public function suspend(Request $request, SuspendAdminAccount $suspendAccount, string $user): AdminUserDetailResource
    {
        return new AdminUserDetailResource($suspendAccount->suspend(self::actor($request), self::findAccount($user)));
    }

    /**
     * Lift a suspension. No session is created; the person signs in again.
     */
    public function reactivate(Request $request, SuspendAdminAccount $suspendAccount, string $user): AdminUserDetailResource
    {
        return new AdminUserDetailResource($suspendAccount->reactivate(self::actor($request), self::findAccount($user)));
    }

    /**
     * Remove the authenticator, end every session, and return a credential-reset link
     * once. The account cannot sign in until the person completes the link; a lost or
     * expired link is replaced by issuing again.
     */
    public function resetCredentials(IssueCredentialResetRequest $request, ResetAdminCredentials $resetCredentials, string $user): JsonResponse
    {
        $issued = $resetCredentials->handle(
            self::findAccount($user),
            AdminActorType::User,
            (int) config('admin.access_links.owner_reset_ttl_minutes'),
            self::actor($request),
        );

        /** @var User $account */
        $account = $issued->link->user()->firstOrFail();

        return response()->json(['data' => [
            'account' => (new AdminUserDetailResource($account))->resolve($request),
            'access_link' => [
                'id' => $issued->link->getKey(),
                'purpose' => $issued->link->purpose->value,
                'url' => $issued->url,
                'expires_at' => $issued->link->expires_at->toIso8601String(),
            ],
        ]], 201);
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
    private static function findAccount(string $id): User
    {
        return User::query()->whereNotNull('role')->whereKey((int) $id)->first()
            ?? throw new NotFoundHttpException('Account not found.');
    }
}
