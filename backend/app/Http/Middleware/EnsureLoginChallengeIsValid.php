<?php

namespace App\Http\Middleware;

use App\Listeners\RecordAdminAuthenticationEvents;
use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\Response;

/**
 * Guards Fortify's TOTP challenge: it must follow a correct password within
 * config('admin.login.challenge_ttl_minutes'), and the account must still be allowed to
 * sign in (it may have been suspended or reset in between). Otherwise the pending
 * sign-in is dropped and the person starts again.
 */
class EnsureLoginChallengeIsValid
{
    /**
     * @param  Closure(Request): Response  $next
     *
     * @throws ValidationException
     */
    public function handle(Request $request, Closure $next): Response
    {
        $session = $request->session();
        $startedAt = $session->get(RecordAdminAuthenticationEvents::CHALLENGE_STARTED_AT);
        $userId = $session->get('login.id');
        $ttl = (int) config('admin.login.challenge_ttl_minutes') * 60;

        $valid = is_int($startedAt)
            && now()->getTimestamp() - $startedAt < $ttl
            && $userId !== null
            && User::query()->find($userId)?->canSignInToAdmin() === true;

        if (! $valid) {
            $session->forget(['login.id', 'login.remember', RecordAdminAuthenticationEvents::CHALLENGE_STARTED_AT]);

            throw ValidationException::withMessages([
                'code' => ['The sign-in attempt has expired. Sign in again.'],
            ]);
        }

        return $next($request);
    }
}
