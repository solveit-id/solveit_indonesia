<?php

namespace App\Actions\Admin;

use App\Enums\AdminActorType;
use App\Enums\AdminAuditAction;
use App\Exceptions\AdminAccountStateException;
use App\Models\AdminAccessLink;
use App\Models\User;
use App\Services\AdminSessionStore;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\DB;

/**
 * Suspend or reactivate another account (/api/v1/admin/users/{user}/suspension, B3.1b).
 */
class SuspendAdminAccount
{
    public function __construct(
        private readonly AdminSessionStore $sessions,
        private readonly RecordAdminAuditEvent $recordAuditEvent,
    ) {}

    /**
     * Only an active owner may suspend, never themselves and never the last active owner.
     * Every session of the account ends at once; sign-in is refused while suspended. Open
     * access links (invitation or credential reset) are revoked too, so lifting the
     * suspension never revives a link issued before it: the owner issues a new one.
     *
     * @throws AuthorizationException
     * @throws AdminAccountStateException
     */
    public function suspend(User $actor, User $target): User
    {
        if ($actor->is($target)) {
            throw AdminAccountStateException::ownAccount();
        }

        return DB::transaction(function () use ($actor, $target): User {
            $activeOwners = ActiveOwners::lockForActor($actor);
            $target = User::query()->whereKey($target->getKey())->lockForUpdate()->firstOrFail();

            if ($target->suspended_at !== null) {
                return $target;
            }

            if (ActiveOwners::wouldRemoveLast($activeOwners, $target)) {
                throw AdminAccountStateException::lastActiveOwner();
            }

            $target->forceFill(['suspended_at' => now()])->save();
            $sessionsEnded = $this->sessions->revokeAll($target);
            $linksRevoked = AdminAccessLink::query()
                ->where('user_id', $target->getKey())
                ->whereNull('completed_at')
                ->whereNull('revoked_at')
                ->update(['revoked_at' => now()]);

            $this->recordAuditEvent->handle(
                AdminAuditAction::AccountSuspended,
                AdminActorType::User,
                actor: $actor,
                subject: $target,
                metadata: ['sessions_ended' => $sessionsEnded, 'access_links_revoked' => $linksRevoked],
            );

            return $target;
        }, ActiveOwners::TRANSACTION_ATTEMPTS);
    }

    /**
     * Lift a suspension. The account signs in again with its existing credentials; no
     * session is created here (the person signs in with password and TOTP again).
     *
     * @throws AuthorizationException
     * @throws AdminAccountStateException
     */
    public function reactivate(User $actor, User $target): User
    {
        if ($actor->is($target)) {
            throw AdminAccountStateException::ownAccount();
        }

        return DB::transaction(function () use ($actor, $target): User {
            ActiveOwners::lockForActor($actor);
            $target = User::query()->whereKey($target->getKey())->lockForUpdate()->firstOrFail();

            if ($target->suspended_at === null) {
                return $target;
            }

            $target->forceFill(['suspended_at' => null])->save();

            $this->recordAuditEvent->handle(
                AdminAuditAction::AccountReactivated,
                AdminActorType::User,
                actor: $actor,
                subject: $target,
            );

            return $target;
        }, ActiveOwners::TRANSACTION_ATTEMPTS);
    }
}
