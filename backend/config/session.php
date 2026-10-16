<?php

/*
|--------------------------------------------------------------------------
| Sessions exist only for the admin application (B3.1a)
|--------------------------------------------------------------------------
|
| Only routes in the "admin" middleware group (routes/admin.php) start a session. The
| public API (routes/api.php, POST /api/v1/inquiries) and /up never do, and send no
| cookie. The approved security policy is fixed here instead of read from the
| environment, so a stale .env cannot weaken it: idle expiry 30 minutes, expiry when the
| browser closes, encrypted payloads, host-only HttpOnly cookie with SameSite=Strict.
|
| Transport follows ADMIN_URL (config/admin.php): with an https:// admin origin the
| cookie is Secure and named with the __Host- prefix (Secure, Path=/, no Domain, so no
| sibling subdomain can set or overwrite it). Local HTTP development gets a plain name
| without Secure, which browsers would otherwise reject or drop on http://.
|
*/

$adminUsesHttps = str_starts_with(strtolower((string) env('ADMIN_URL', 'http://127.0.0.1:5174')), 'https://');

return [

    /*
    |--------------------------------------------------------------------------
    | Default Session Driver
    |--------------------------------------------------------------------------
    |
    | "database" (the sessions table) is required for the admin application: it lets
    | an account list and revoke its sessions, and lets suspension, role changes, and
    | credential resets end every session of an account at once.
    |
    | Supported: "file", "cookie", "database", "memcached",
    |            "redis", "dynamodb", "array"
    |
    */

    'driver' => env('SESSION_DRIVER', 'database'),

    /*
    |--------------------------------------------------------------------------
    | Session Lifetime
    |--------------------------------------------------------------------------
    |
    | Idle expiry in minutes, enforced by the server (last activity), not only by the
    | cookie. The absolute limit from sign-in is config('admin.session').
    |
    */

    'lifetime' => 30,

    'expire_on_close' => true,

    /*
    |--------------------------------------------------------------------------
    | Session Encryption
    |--------------------------------------------------------------------------
    |
    | Session payloads are encrypted with APP_KEY before they are stored.
    |
    */

    'encrypt' => true,

    /*
    |--------------------------------------------------------------------------
    | Session File Location
    |--------------------------------------------------------------------------
    |
    | When utilizing the "file" session driver, the session files are placed
    | on disk. The default storage location is defined here; however, you
    | are free to provide another location where they should be stored.
    |
    */

    'files' => storage_path('framework/sessions'),

    /*
    |--------------------------------------------------------------------------
    | Session Database Connection
    |--------------------------------------------------------------------------
    |
    | When using the "database" or "redis" session drivers, you may specify a
    | connection that should be used to manage these sessions. This should
    | correspond to a connection in your database configuration options.
    |
    */

    'connection' => env('SESSION_CONNECTION'),

    /*
    |--------------------------------------------------------------------------
    | Session Database Table
    |--------------------------------------------------------------------------
    |
    | When using the "database" session driver, you may specify the table to
    | be used to store sessions. Of course, a sensible default is defined
    | for you; however, you're welcome to change this to another table.
    |
    */

    'table' => env('SESSION_TABLE', 'sessions'),

    /*
    |--------------------------------------------------------------------------
    | Session Cache Store
    |--------------------------------------------------------------------------
    |
    | When using one of the framework's cache driven session backends, you may
    | define the cache store which should be used to store the session data
    | between requests. This must match one of your defined cache stores.
    |
    | Affects: "dynamodb", "memcached", "redis"
    |
    */

    'store' => env('SESSION_STORE'),

    /*
    |--------------------------------------------------------------------------
    | Session Sweeping Lottery
    |--------------------------------------------------------------------------
    |
    | Some session drivers must manually sweep their storage location to get
    | rid of old sessions from storage. Here are the chances that it will
    | happen on a given request. By default, the odds are 2 out of 100.
    |
    */

    'lottery' => [2, 100],

    /*
    |--------------------------------------------------------------------------
    | Session Cookie Name
    |--------------------------------------------------------------------------
    |
    | __Host- only when the cookie is Secure, Path=/ and has no Domain (all fixed below).
    |
    */

    'cookie' => $adminUsesHttps ? '__Host-solveit-admin-session' : 'solveit-admin-session',

    /*
    |--------------------------------------------------------------------------
    | Session Cookie Path and Domain
    |--------------------------------------------------------------------------
    |
    | Path "/" and no Domain attribute: the cookie belongs to the admin host only and is
    | never sent to the public website or another subdomain.
    |
    */

    'path' => '/',

    'domain' => null,

    /*
    |--------------------------------------------------------------------------
    | HTTPS Only Cookies
    |--------------------------------------------------------------------------
    |
    | Follows the scheme of ADMIN_URL (see the top of this file).
    |
    */

    'secure' => $adminUsesHttps,

    /*
    |--------------------------------------------------------------------------
    | HTTP Access Only
    |--------------------------------------------------------------------------
    |
    | The session cookie is never readable by JavaScript.
    |
    */

    'http_only' => true,

    /*
    |--------------------------------------------------------------------------
    | Same-Site Cookies
    |--------------------------------------------------------------------------
    |
    | Strict: the browser never attaches the admin cookies to a request started by
    | another site, including a link from an email or chat. Also applied to the
    | XSRF-TOKEN cookie. Requests from the public website are same-site but
    | cross-origin; the admin middleware rejects those by Origin and Sec-Fetch-Site.
    |
    | See: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie#samesitesamesite-value
    |
    */

    'same_site' => 'strict',

    /*
    |--------------------------------------------------------------------------
    | Partitioned Cookies
    |--------------------------------------------------------------------------
    |
    | Not used: the admin cookies are first-party only.
    |
    */

    'partitioned' => false,

    /*
    |--------------------------------------------------------------------------
    | Session Serialization
    |--------------------------------------------------------------------------
    |
    | This value controls the serialization strategy for session data, which
    | is JSON by default. Setting this to "php" allows the storage of PHP
    | objects in the session but can make an application vulnerable to
    | "gadget chain" serialization attacks if the APP_KEY is leaked.
    |
    | Supported: "json", "php"
    |
    */

    'serialization' => 'json',

];
