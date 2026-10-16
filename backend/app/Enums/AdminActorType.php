<?php

namespace App\Enums;

/**
 * Who caused an admin audit event.
 */
enum AdminActorType: string
{
    /** A signed-in admin account. */
    case User = 'user';

    /** An operator on the server shell (Artisan command). */
    case Cli = 'cli';

    /** A request without a signed-in account (failed sign-in, link redemption). */
    case Anonymous = 'anonymous';
}
