<?php

namespace App\Actions\Admin;

use App\Enums\AdminPermission;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;

/**
 * The acting account of an inquiry operation (B4a), checked again inside its transaction.
 *
 * The route's `can:` check ran when the request arrived; a suspension or role change can
 * commit between that check and the write. Reading the account with a shared lock waits
 * for such a change (it locks the account row for update) and then sees it, so an account
 * that lost the permission cannot write a status, a note, or a contact reveal after the
 * change committed.
 */
final class InquiryHandler
{
    /**
     * Attempts for every inquiry transaction. MySQL may roll one back in a deadlock; the
     * retry reads the committed state again.
     */
    public const TRANSACTION_ATTEMPTS = 3;

    /**
     * @throws AuthorizationException
     */
    public static function lockFor(User $actor, AdminPermission $permission): User
    {
        $current = User::query()->whereKey($actor->getKey())->sharedLock()->first();

        if ($current === null || ! $current->hasAdminPermission($permission)) {
            throw new AuthorizationException;
        }

        return $current;
    }
}
