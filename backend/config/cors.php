<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS) Configuration
    |--------------------------------------------------------------------------
    |
    | Only the origins listed in CORS_ALLOWED_ORIGINS (comma-separated, exact
    | scheme, host, and port) may call the API from a browser. Empty means no
    | cross-origin access. Never use "*": the production website origin is
    | added once the domain is decided. Idempotency-Key (request) and
    | Idempotent-Replayed (response) belong to POST /api/v1/inquiries.
    |
    | To learn more: https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
    |
    */

    // Only the public endpoint. The admin API (api/v1/admin/*) is same-origin and must never
    // answer a preflight or send CORS headers, whatever CORS_ALLOWED_ORIGINS lists.
    'paths' => ['api/v1/inquiries'],

    'allowed_methods' => ['GET', 'POST'],

    'allowed_origins' => array_values(array_filter(array_map(
        trim(...),
        explode(',', (string) env('CORS_ALLOWED_ORIGINS', '')),
    ))),

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['Accept', 'Content-Type', 'Idempotency-Key', 'X-Requested-With'],

    'exposed_headers' => ['Idempotent-Replayed', 'Retry-After', 'X-RateLimit-Limit', 'X-RateLimit-Remaining'],

    'max_age' => 3600,

    'supports_credentials' => false,

];
