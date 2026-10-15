<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Inquiry Rate Limits
    |--------------------------------------------------------------------------
    |
    | Submissions allowed per client IP address for POST /api/v1/inquiries.
    | Every attempt counts, including rejected ones. Behind a proxy or CDN,
    | set TRUSTED_PROXIES so the limit applies to the visitor, not the proxy.
    |
    */

    'rate_limit' => [
        'per_minute' => (int) env('INQUIRY_RATE_LIMIT_PER_MINUTE', 5),
        'per_hour' => (int) env('INQUIRY_RATE_LIMIT_PER_HOUR', 20),
    ],

    /*
    |--------------------------------------------------------------------------
    | Maximum Request Body Size
    |--------------------------------------------------------------------------
    |
    | Bytes. The largest valid inquiry (5,000 character message, JSON escaped
    | non-ASCII text) stays below the 64 KB default.
    |
    */

    'max_body_bytes' => (int) env('INQUIRY_MAX_BODY_BYTES', 65536),

];
