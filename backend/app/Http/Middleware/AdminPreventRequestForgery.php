<?php

namespace App\Http\Middleware;

use Illuminate\Foundation\Http\Middleware\PreventRequestForgery;

/**
 * Laravel's request-forgery protection for the admin API, without its test bypass.
 *
 * Writes pass when the browser marks them Sec-Fetch-Site: same-origin (a header pages
 * cannot forge) or when X-XSRF-TOKEN (from the XSRF-TOKEN cookie) or X-CSRF-TOKEN
 * matches the session token; otherwise 419. Same-site requests are not accepted.
 * The parent skips every check while unit tests run; the admin suite must exercise the
 * real check, so this class never does.
 */
class AdminPreventRequestForgery extends PreventRequestForgery
{
    /**
     * @return bool
     */
    protected function runningUnitTests()
    {
        return false;
    }
}
