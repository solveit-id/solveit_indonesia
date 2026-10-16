<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\Response;

/**
 * Starts an anonymous admin session and returns 204. The request-forgery middleware
 * attaches the XSRF-TOKEN cookie, whose value the admin application sends back in
 * the X-XSRF-TOKEN header on every write.
 */
class CsrfCookieController extends Controller
{
    public function __invoke(): Response
    {
        return response()->noContent();
    }
}
