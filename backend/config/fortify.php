<?php

use Laravel\Fortify\Features;

/*
|--------------------------------------------------------------------------
| Laravel Fortify (headless) for the admin application
|--------------------------------------------------------------------------
|
| Fortify supplies the sign-in pipeline, the TOTP challenge, password confirmation, and
| the TOTP and recovery-code primitives. Its own routes are NOT registered
| (Fortify::ignoreRoutes() in App\Providers\FortifyServiceProvider): routes/admin.php
| maps only the controllers the admin API needs, behind the admin middleware group.
| Registration, self-service password reset, email verification, profile updates, and
| passkeys are off. Two-factor authentication cannot be disabled through the API.
|
*/

return [

    'guard' => 'web',

    'passwords' => 'users',

    'username' => 'email',

    'email' => 'email',

    'lowercase_usernames' => true,

    'home' => '/',

    'prefix' => '',

    'domain' => null,

    'middleware' => ['admin'],

    /*
    |--------------------------------------------------------------------------
    | Rate Limiting
    |--------------------------------------------------------------------------
    |
    | Named limiters defined in App\Providers\AppServiceProvider and applied as route
    | middleware in routes/admin.php.
    |
    */

    'limiters' => [
        'login' => 'admin-login',
        'two-factor' => 'admin-two-factor',
    ],

    'views' => false,

    'features' => [
        Features::twoFactorAuthentication([
            'confirm' => true,
            'confirmPassword' => true,
            // 32 base32 characters: a 160-bit secret, the length RFC 4226 recommends.
            'secret-length' => 32,
            // Accept the previous and the next 30-second step for clock drift; a used code is
            // refused again (Fortify caches it per code).
            'window' => 1,
        ]),
    ],

];
