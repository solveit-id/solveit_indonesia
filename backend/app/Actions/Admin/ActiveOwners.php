<?php

namespace App\Actions\Admin;

use App\Enums\AdminRole;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\Eloquent\Collection;

/**
 * The last-active-owner invariant and the "acting owner" check, shared by every user
 * administration operation.
 *
 * An active owner is an owner who can sign in: activated, not suspended, and with a
 * confirmed authenticator. An owner whose credentials are being reset is not one, so a
 * reset counts as removing an owner (two owners resetting each other at the same time
 * cannot both succeed and leave nobody able to sign in).
 */
final class ActiveOwners
{
    /**
     * Attempts for every transaction that takes this lock. Two owners acting at once can
     * meet in an InnoDB deadlock (the winner's role or suspension update writes into the
     * index gap the waiting transaction has locked); MySQL rolls one back, and its retry
     * then sees the committed change and answers from it (usually 403: the actor is no
     * longer an active owner). Verified by AdminAdministrationConcurrencyTest.
     */
    public const TRANSACTION_ATTEMPTS = 3;

    /**
     * Active owners, locked until the surrounding transaction ends, so two concurrent
     * changes cannot each remove "another" owner and leave none. Every owner operation
     * takes this lock first, which also serializes them against each other.
     *
     * @return Collection<int, User>
     */
    public static function lock(): Collection
    {
        return User::query()
            ->where('role', AdminRole::Owner)
            ->whereNotNull('activated_at')
            ->whereNull('suspended_at')
            ->whereNotNull('two_factor_confirmed_at')
            ->orderBy('id')
            ->lockForUpdate()
            ->get();
    }

    /**
     * Lock the active owners and require $actor to be one of them, as the database holds it
     * now (not as it was when the request was authorized).
     *
     * @return Collection<int, User>
     *
     * @throws AuthorizationException
     */
    public static function lockForActor(User $actor): Collection
    {
        $activeOwners = self::lock();

        if (! $activeOwners->contains(fn (User $owner): bool => $owner->is($actor))) {
            throw new AuthorizationException;
        }

        return $activeOwners;
    }

    /**
     * Whether taking the owner role or activity away from $target leaves no active owner.
     *
     * @param  Collection<int, User>  $activeOwners
     */
    public static function wouldRemoveLast(Collection $activeOwners, User $target): bool
    {
        return $activeOwners->contains(fn (User $owner): bool => $owner->is($target))
            && $activeOwners->count() <= 1;
    }
}
