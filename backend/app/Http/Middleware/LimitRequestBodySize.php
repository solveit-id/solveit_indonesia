<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Rejects bodies larger than `inquiries.max_body_bytes` with 413, well below
 * PHP's post_max_size, so oversized payloads never reach validation.
 */
class LimitRequestBodySize
{
    /**
     * Handle an incoming request.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $limit = (int) config('inquiries.max_body_bytes');
        $declaredLength = (int) $request->headers->get('Content-Length', '0');

        if ($declaredLength > $limit || strlen($request->getContent()) > $limit) {
            return response()->json(['message' => 'The request body is too large.'], Response::HTTP_REQUEST_ENTITY_TOO_LARGE);
        }

        return $next($request);
    }
}
