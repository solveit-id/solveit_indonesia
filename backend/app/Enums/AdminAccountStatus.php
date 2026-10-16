<?php

namespace App\Enums;

use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

/**
 * State of an admin account as owners see it, derived from its columns (never stored).
 * Exactly one applies to every account with a role; only `active` may sign in.
 */
enum AdminAccountStatus: string
{
    /** Invited (or bootstrapped) but not activated yet: no password of its own, no authenticator. */
    case Pending = 'pending';

    /** Activated, not suspended, authenticator confirmed: may sign in. */
    case Active = 'active';

    /** Activated, but a credential reset removed the authenticator and it is not completed yet. */
    case CredentialResetPending = 'credential-reset-pending';

    /** Suspended by an owner, whatever else is true. */
    case Suspended = 'suspended';

    public static function of(User $user): self
    {
        return match (true) {
            $user->suspended_at !== null => self::Suspended,
            $user->activated_at === null => self::Pending,
            $user->two_factor_confirmed_at === null => self::CredentialResetPending,
            default => self::Active,
        };
    }

    /**
     * Restrict a users query to accounts in this state (the SQL form of of()).
     *
     * @param  Builder<User>  $query
     * @return Builder<User>
     */
    public function constrain(Builder $query): Builder
    {
        if ($this === self::Suspended) {
            return $query->whereNotNull('suspended_at');
        }

        $query->whereNull('suspended_at');

        return match ($this) {
            self::Pending => $query->whereNull('activated_at'),
            self::CredentialResetPending => $query->whereNotNull('activated_at')->whereNull('two_factor_confirmed_at'),
            self::Active => $query->whereNotNull('activated_at')->whereNotNull('two_factor_confirmed_at'),
        };
    }
}
