<?php

namespace App\Actions\Admin;

use App\Enums\AdminAccessLinkPurpose;
use App\Enums\AdminActorType;
use App\Enums\AdminAuditAction;
use App\Exceptions\AdminAccountStateException;
use App\Models\AdminAccessLink;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Support\Facades\DB;

/**
 * An owner withdraws an invitation that is not accepted yet
 * (DELETE /api/v1/admin/invitations/{invitation}, B3.1b).
 */
class RevokeAdminInvitation
{
    public function __construct(private readonly RecordAdminAuditEvent $recordAuditEvent) {}

    /**
     * The link stops working at once, including an enrollment already started with it
     * (its confirmation is refused). The pending account stays and cannot sign in; the
     * owner may invite it again. Revoking an already revoked invitation changes nothing.
     *
     * @throws AuthorizationException
     * @throws AdminAccountStateException when the invitation was already accepted.
     * @throws ModelNotFoundException
     */
    public function handle(User $actor, int $invitationId): AdminAccessLink
    {
        return DB::transaction(function () use ($actor, $invitationId): AdminAccessLink {
            ActiveOwners::lockForActor($actor);

            $link = AdminAccessLink::query()
                ->whereKey($invitationId)
                ->where('purpose', AdminAccessLinkPurpose::Activation)
                ->lockForUpdate()
                ->firstOrFail();

            if ($link->completed_at !== null) {
                throw AdminAccountStateException::invitationCompleted();
            }

            if ($link->revoked_at !== null) {
                return $link;
            }

            $link->forceFill(['revoked_at' => now()])->save();

            $this->recordAuditEvent->handle(
                AdminAuditAction::InvitationRevoked,
                AdminActorType::User,
                actor: $actor,
                subject: $link->user,
                metadata: ['access_link_id' => $link->getKey()],
            );

            return $link;
        }, ActiveOwners::TRANSACTION_ATTEMPTS);
    }
}
