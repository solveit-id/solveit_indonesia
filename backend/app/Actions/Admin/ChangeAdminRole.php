<?php

namespace App\Actions\Admin;

use App\Enums\AdminActorType;
use App\Enums\AdminAuditAction;
use App\Enums\AdminRole;
use App\Exceptions\AdminAccountStateException;
use App\Models\User;
use App\Services\AdminSessionStore;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\DB;

/**
 * Change another account's role (domain operation for B3.1b user administration).
 */
class ChangeAdminRole
{
    public function __construct(
        private readonly AdminSessionStore $sessions,
        private readonly RecordAdminAuditEvent $recordAuditEvent,
    ) {}

    /**
     * Only an active owner may change roles, never their own, and never so that no
     * active owner remains. The target's sessions end, so the new role applies at once.
     *
     * @throws AuthorizationException
     * @throws AdminAccountStateException
     */
    public function handle(User $actor, User $target, AdminRole $role): User
    {
        if ($actor->is($target)) {
            throw AdminAccountStateException::ownAccount();
        }

        return DB::transaction(function () use ($actor, $target, $role): User {
            $activeOwners = ActiveOwners::lock();
            $target = User::query()->whereKey($target->getKey())->lockForUpdate()->firstOrFail();

            if (! $activeOwners->contains(fn (User $owner): bool => $owner->is($actor))) {
                throw new AuthorizationException;
            }

            if ($target->role === null || $target->activated_at === null) {
                throw AdminAccountStateException::notActivated();
            }

            if ($target->role === $role) {
                return $target;
            }

            if ($role !== AdminRole::Owner && ActiveOwners::wouldRemoveLast($activeOwners, $target)) {
                throw AdminAccountStateException::lastActiveOwner();
            }

            $previousRole = $target->role;
            $target->forceFill(['role' => $role])->save();
            $sessionsEnded = $this->sessions->revokeAll($target);

            $this->recordAuditEvent->handle(
                AdminAuditAction::RoleChanged,
                AdminActorType::User,
                actor: $actor,
                subject: $target,
                metadata: ['from_role' => $previousRole->value, 'to_role' => $role->value, 'sessions_ended' => $sessionsEnded],
            );

            return $target;
        });
    }
}
