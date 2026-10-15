<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Trusted Proxies
    |--------------------------------------------------------------------------
    |
    | Read by Laravel's TrustProxies middleware. Comma-separated IP addresses
    | or CIDR ranges of the load balancer or CDN in front of the API, so that
    | $request->ip() (and therefore rate limiting) sees the visitor's address.
    | Leave empty to trust no proxy. Use "*" only when the hosting platform
    | guarantees that every request arrives through its own proxy.
    |
    */

    'proxies' => env('TRUSTED_PROXIES') ?: null,

];
