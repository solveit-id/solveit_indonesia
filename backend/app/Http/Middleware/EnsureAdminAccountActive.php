<?php

namespace App\Http\Middleware;

use App\Actions\Admin\RecordAdminAuditEvent;
use App\Enums\AdminActorType;
use App\Enums\AdminAuditAction;
use App\Models\User;
use Closure;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

/**
 * Re-checks the account on every request: a role, completed activation, a confirmed
 * authenticator, and no suspension. Otherwise the session ends (401). Together with the
 * session revocation done by suspension, role changes, and credential resets, a change
 * of account state applies to sessions that already exist.
 */
class EnsureAdminAccountActive
{
    public function __construct(private readonly RecordAdminAuditEvent $recordAuditEvent) {}

    /**
     * @param  Closure(Request): Response  $next
     *
     * @throws AuthenticationException
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user instanceof User || ! $user->canSignInToAdmin()) {
            if ($user instanceof User) {
                $this->recordAuditEvent->handle(
                    AdminAuditAction::SessionEndedInactiveAccount,
                    AdminActorType::User,
                    actor: $user,
                    subject: $user,
                );
            }

            self::endSession($request);

            throw new AuthenticationException;
        }

        return $next($request);
    }

    /**
     * Sign out and discard the session without recording a regular logout.
     */
    public static function endSession(Request $request): void
    {
        $request->attributes->set(self::class.'.ended', true);

        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();
    }
}
