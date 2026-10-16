<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Admin application origin
    |--------------------------------------------------------------------------
    |
    | Exact origin (scheme://host[:port]) of the admin application. The admin API under
    | /api/v1/admin answers only requests whose Host is this origin's host and whose
    | Origin header (when sent, and always on writes) is this origin; access links are built
    | from it, never from the request. Local: the admin dev server (B3.2), which proxies
    | /api to Laravel. Production: https://admin.<domain> once the domain is decided.
    | The scheme also decides the session cookie's Secure flag and __Host- name
    | (config/session.php).
    |
    */

    'url' => rtrim((string) env('ADMIN_URL', 'http://127.0.0.1:5174'), '/'),

    /*
    |--------------------------------------------------------------------------
    | Session and credential policy (approved for B3.1a)
    |--------------------------------------------------------------------------
    |
    | Fixed in code on purpose: these are security policy, not deployment settings.
    | Idle expiry (30 minutes) is the session lifetime in config/session.php; sensitive
    | actions need a password confirmation within config('auth.password_timeout').
    |
    */

    'session' => [
        // Absolute limit from sign-in, however active the session is.
        'absolute_lifetime_minutes' => 720,
    ],

    'login' => [
        // Time allowed between a correct password and the TOTP or recovery code.
        'challenge_ttl_minutes' => 5,
        // Every sign-in attempt takes at least this long, so the response time does not
        // reveal whether the account exists. Lowered only by the test suite (phpunit.xml).
        'minimum_duration_microseconds' => (int) env('ADMIN_LOGIN_MINIMUM_DURATION_US', 400_000),
    ],

    'access_links' => [
        // Lifetime of a link issued on the server shell (owner bootstrap, credential reset).
        'cli_ttl_minutes' => 30,
        // Lifetime of a link an owner issues through the API (owner decision, B3.1b). The
        // owner delivers it by hand, so it lives longer than a shell link; it can be revoked
        // (invitation) or replaced (reset) at any time.
        'invitation_ttl_minutes' => 2880,
        'owner_reset_ttl_minutes' => 1440,
        // Time between redeeming a link (password set, TOTP secret shown) and confirming
        // the first code.
        'enrollment_ttl_minutes' => 15,
        // Path of the admin application page that reads the token from the URL fragment.
        // The fragment never reaches a server, a proxy log, or a Referer header.
        'path' => '/access',
    ],

    'pagination' => [
        // Page size of the owner lists (users, invitations, audit events).
        'default_per_page' => 25,
        'max_per_page' => 100,
    ],

];
