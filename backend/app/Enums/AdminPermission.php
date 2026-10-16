<?php

namespace App\Enums;

/**
 * Narrow admin abilities, each registered as a Gate with the same name
 * (App\Providers\AppServiceProvider). Add a case only together with the endpoint that
 * needs it; B3.1b adds user administration and audit reading.
 */
enum AdminPermission: string
{
    /** Read and manage one's own account: profile, password, recovery codes, sessions. */
    case ManageOwnAccount = 'account.manage-own';
}
