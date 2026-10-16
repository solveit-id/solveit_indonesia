<?php

namespace App\Actions\Admin;

use App\Enums\AdminActorType;
use App\Enums\AdminAuditAction;
use App\Exceptions\AdminAccountStateException;
use App\Models\User;
use App\Services\AdminSessionStore;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Suspend or reactivate another account (domain operation for B3.1b user administration).
 */
class SuspendAdminAccount
{
    public function __construct(
        private readonly AdminSessionStore $sessions,
        private readonly RecordAdminAuditEvent $recordAuditEvent,
    ) {}

    /**
     * Only an active owner may suspend, never themselves and never the last active owner.
     * Every session of the account ends at once; sign-in is refused while suspended.
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
            $activeOwners = $this->lockActorAsActiveOwner($actor);
            $target = User::query()->whereKey($target->getKey())->lockForUpdate()->firstOrFail();

            if ($target->suspended_at !== null) {
                return $target;
            }

            if (ActiveOwners::wouldRemoveLast($activeOwners, $target)) {
                throw AdminAccountStateException::lastActiveOwner();
            }

            $target->forceFill(['suspended_at' => now()])->save();
            $sessionsEnded = $this->sessions->revokeAll($target);

            $this->recordAuditEvent->handle(
                AdminAuditAction::AccountSuspended,
                AdminActorType::User,
                actor: $actor,
                subject: $target,
                metadata: ['sessions_ended' => $sessionsEnded],
            );

            return $target;
        });
    }

    /**
     * Lift a suspension. The account signs in again with its existing credentials.
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
            $this->lockActorAsActiveOwner($actor);
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
        });
    }

    /**
     * @return Collection<int, User>
     *
     * @throws AuthorizationException
     */
    private function lockActorAsActiveOwner(User $actor): Collection
    {
        $activeOwners = ActiveOwners::lock();

        if (! $activeOwners->contains(fn (User $owner): bool => $owner->is($actor))) {
            throw new AuthorizationException;
        }

        return $activeOwners;
    }
}
