<?php

namespace App\Enums;

use App\Models\AdminAccessLink;
use Illuminate\Database\Eloquent\Builder;

/**
 * Where an access link (invitation or credential reset) stands, derived from its
 * timestamps (never stored). Exactly one applies to every link.
 */
enum AdminAccessLinkStatus: string
{
    /** Issued, not used, not expired: the link can be redeemed. */
    case Pending = 'pending';

    /** Redeemed (password set, authenticator shown), first TOTP code not confirmed yet. */
    case Redeemed = 'redeemed';

    /** Finished: the account activated or recovered with a confirmed authenticator. */
    case Completed = 'completed';

    /** Never redeemed before its expiry. */
    case Expired = 'expired';

    /** Revoked by an owner, by a newer link, or by a suspension. */
    case Revoked = 'revoked';

    public static function of(AdminAccessLink $link): self
    {
        return match (true) {
            $link->completed_at !== null => self::Completed,
            $link->revoked_at !== null => self::Revoked,
            $link->redeemed_at !== null => self::Redeemed,
            ! $link->expires_at->isFuture() => self::Expired,
            default => self::Pending,
        };
    }

    /**
     * Restrict an access-links query to links in this state (the SQL form of of()).
     *
     * @param  Builder<AdminAccessLink>  $query
     * @return Builder<AdminAccessLink>
     */
    public function constrain(Builder $query): Builder
    {
        if ($this === self::Completed) {
            return $query->whereNotNull('completed_at');
        }

        $query->whereNull('completed_at');

        if ($this === self::Revoked) {
            return $query->whereNotNull('revoked_at');
        }

        $query->whereNull('revoked_at');

        return match ($this) {
            self::Redeemed => $query->whereNotNull('redeemed_at'),
            self::Expired => $query->whereNull('redeemed_at')->where('expires_at', '<=', now()),
            self::Pending => $query->whereNull('redeemed_at')->where('expires_at', '>', now()),
        };
    }
}
