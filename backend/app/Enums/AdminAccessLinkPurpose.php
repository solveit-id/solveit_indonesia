<?php

namespace App\Enums;

/**
 * What redeeming an admin access link does. Both purposes end with a new password and a
 * newly confirmed TOTP authenticator, so a link never grants access with only one factor.
 */
enum AdminAccessLinkPurpose: string
{
    /** First sign-in of a new account (owner bootstrap; invitations in B3.1b). */
    case Activation = 'activation';

    /** Lost password or authenticator: both are replaced. */
    case CredentialReset = 'credential-reset';
}
