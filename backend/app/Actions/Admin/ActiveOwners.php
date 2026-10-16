<?php

namespace App\Actions\Admin;

use App\Enums\AdminRole;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;

/**
 * The last-active-owner invariant, shared by role changes and suspensions.
 */
final class ActiveOwners
{
    /**
     * Active owners, locked until the surrounding transaction ends, so two concurrent
     * changes cannot each remove "another" owner and leave none.
     *
     * @return Collection<int, User>
     */
    public static function lock(): Collection
    {
        return User::query()
            ->where('role', AdminRole::Owner)
            ->whereNotNull('activated_at')
            ->whereNull('suspended_at')
            ->lockForUpdate()
            ->get();
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
