<?php

namespace App\Http\Middleware;

use App\Actions\Admin\RecordAdminAuditEvent;
use App\Enums\AdminActorType;
use App\Enums\AdminAuditAction;
use App\Listeners\RecordAdminAuthenticationEvents;
use Closure;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Absolute session limit: a session ends config('admin.session.absolute_lifetime_minutes')
 * after sign-in, however active it is. Idle expiry (30 minutes) is enforced by the
 * session store. A session without a sign-in time is treated as expired.
 */
class EnforceAdminSessionLifetime
{
    public function __construct(private readonly RecordAdminAuditEvent $recordAuditEvent) {}

    /**
     * @param  Closure(Request): Response  $next
     *
     * @throws AuthenticationException
     */
    public function handle(Request $request, Closure $next): Response
    {
        $signedInAt = $request->session()->get(RecordAdminAuthenticationEvents::SIGNED_IN_AT);
        $limit = (int) config('admin.session.absolute_lifetime_minutes') * 60;

        if (! is_int($signedInAt) || now()->getTimestamp() - $signedInAt >= $limit) {
            $this->recordAuditEvent->handle(
                AdminAuditAction::SessionExpired,
                AdminActorType::User,
                actor: $request->user(),
                subject: $request->user(),
                metadata: ['reason' => 'absolute-lifetime'],
            );

            EnsureAdminAccountActive::endSession($request);

            throw new AuthenticationException;
        }

        return $next($request);
    }
}
