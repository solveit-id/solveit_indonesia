<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Sign-in and access-link routes run only without a signed-in account, so a pending
 * enrollment or a second sign-in never mixes with an existing session.
 */
class EnsureAdminGuest
{
    /**
     * @param  Closure(Request): Response  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        if ($request->user() !== null) {
            return new JsonResponse(['message' => 'You are already signed in. Sign out first.'], 409);
        }

        return $next($request);
    }
}
