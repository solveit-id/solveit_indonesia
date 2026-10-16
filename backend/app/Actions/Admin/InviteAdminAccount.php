<?php

namespace App\Actions\Admin;

use App\Enums\AdminAccessLinkPurpose;
use App\Enums\AdminActorType;
use App\Enums\AdminAuditAction;
use App\Enums\AdminRole;
use App\Exceptions\AdminAccountStateException;
use App\Models\AdminAccessLink;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * An owner invites a person to an admin account (POST /api/v1/admin/invitations, B3.1b).
 */
class InviteAdminAccount
{
    public function __construct(
        private readonly IssueAdminAccessLink $issueAccessLink,
        private readonly RecordAdminAuditEvent $recordAuditEvent,
    ) {}

    /**
     * Create the account (not usable yet, unknown random password) or reuse the pending
     * one with this address, and issue an activation link. The person sets their password
     * and enrols TOTP through the link; nothing is sent by email (owner decision: the
     * owner delivers the link by hand).
     *
     * Refused when the address belongs to an activated or suspended account, or when the
     * pending account still has a live invitation (revoke it first): a link the invitee
     * may be using is never replaced silently. Everything runs under the owner lock and
     * the account's row lock; a concurrent invitation that creates the same account first
     * makes the unique email index reject this insert, and the retry then answers from
     * the account it finds.
     *
     * @throws AuthorizationException
     * @throws AdminAccountStateException
     */
    public function handle(User $actor, string $email, AdminRole $role): IssuedAdminAccessLink
    {
        $email = mb_strtolower(trim($email));

        try {
            return $this->invite($actor, $email, $role);
        } catch (UniqueConstraintViolationException) {
            return $this->invite($actor, $email, $role);
        }
    }

    private function invite(User $actor, string $email, AdminRole $role): IssuedAdminAccessLink
    {
        return DB::transaction(function () use ($actor, $email, $role): IssuedAdminAccessLink {
            ActiveOwners::lockForActor($actor);

            $user = User::query()->where('email', $email)->lockForUpdate()->first();
            $created = $user === null;
            $previousRole = $user?->role;

            if ($user === null) {
                $user = new User;
                $user->forceFill([
                    'name' => '',
                    'email' => $email,
                    'password' => Str::random(64),
                    'role' => $role,
                ])->save();
            } else {
                $this->assertInvitable($user);

                if ($user->role !== $role) {
                    $user->forceFill(['role' => $role])->save();
                }
            }

            $issued = $this->issueAccessLink->handle(
                $user,
                AdminAccessLinkPurpose::Activation,
                (int) config('admin.access_links.invitation_ttl_minutes'),
                $actor,
            );

            $this->recordAuditEvent->handle(
                AdminAuditAction::InvitationIssued,
                AdminActorType::User,
                actor: $actor,
                subject: $user,
                metadata: [
                    'to_role' => $role->value,
                    ...($previousRole !== null && $previousRole !== $role ? ['from_role' => $previousRole->value] : []),
                    'account_created' => $created,
                    'access_link_id' => $issued->link->getKey(),
                ],
            );

            return $issued;
        }, ActiveOwners::TRANSACTION_ATTEMPTS);
    }

    /**
     * @throws AdminAccountStateException
     */
    private function assertInvitable(User $user): void
    {
        if ($user->role === null) {
            throw AdminAccountStateException::withoutRole();
        }

        if ($user->suspended_at !== null) {
            throw AdminAccountStateException::suspended();
        }

        if ($user->activated_at !== null) {
            throw AdminAccountStateException::accountExists();
        }

        // A locking read: it sees links committed by a concurrent invitation, which a plain
        // read could miss under REPEATABLE READ (its snapshot may predate that commit).
        $hasLiveInvitation = $user->adminAccessLinks()
            ->where('purpose', AdminAccessLinkPurpose::Activation)
            ->whereNull('completed_at')
            ->whereNull('revoked_at')
            ->lockForUpdate()
            ->get()
            ->contains(fn (AdminAccessLink $link): bool => $link->isLive());

        if ($hasLiveInvitation) {
            throw AdminAccountStateException::invitationPending();
        }
    }
}
