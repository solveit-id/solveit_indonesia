<?php

namespace App\Listeners;

use App\Actions\Admin\RecordAdminAuditEvent;
use App\Enums\AdminActorType;
use App\Enums\AdminAuditAction;
use App\Http\Middleware\EnsureAdminAccountActive;
use App\Models\User;
use Illuminate\Auth\Events\Failed;
use Illuminate\Auth\Events\Login;
use Illuminate\Auth\Events\Logout;
use Illuminate\Events\Dispatcher;
use Laravel\Fortify\Events\RecoveryCodeReplaced;
use Laravel\Fortify\Events\TwoFactorAuthenticationChallenged;
use Laravel\Fortify\Events\TwoFactorAuthenticationFailed;

/**
 * Audit trail and session bookkeeping for sign-in, registered explicitly in
 * App\Providers\AppServiceProvider (Event::subscribe).
 *
 * Fortify's Failed event carries the typed email AND PASSWORD in its credentials, and
 * RecoveryCodeReplaced carries the used code: neither is ever stored or logged here. A
 * failed sign-in keeps only a keyed fingerprint of the typed address.
 */
class RecordAdminAuthenticationEvents
{
    /** Session key: Unix time of the completed sign-in (absolute session limit). */
    public const SIGNED_IN_AT = 'admin.signed_in_at';

    /** Session key: Unix time the TOTP challenge started (correct password given). */
    public const CHALLENGE_STARTED_AT = 'admin.challenge_started_at';

    public function __construct(private readonly RecordAdminAuditEvent $recordAuditEvent) {}

    public function onLogin(Login $event): void
    {
        if (! $event->user instanceof User) {
            return;
        }

        $session = request()->session();
        $session->put(self::SIGNED_IN_AT, now()->getTimestamp());
        $session->forget(self::CHALLENGE_STARTED_AT);

        $event->user->forceFill(['last_login_at' => now()])->save();

        $this->recordAuditEvent->handle(AdminAuditAction::LoginSucceeded, AdminActorType::User, actor: $event->user, subject: $event->user);
    }

    public function onFailed(Failed $event): void
    {
        $this->recordAuditEvent->handle(
            AdminAuditAction::LoginFailed,
            AdminActorType::Anonymous,
            metadata: ['email_fingerprint' => RecordAdminAuditEvent::emailFingerprint((string) ($event->credentials['email'] ?? ''))],
        );
    }

    public function onChallenged(TwoFactorAuthenticationChallenged $event): void
    {
        request()->session()->put(self::CHALLENGE_STARTED_AT, now()->getTimestamp());
    }

    public function onTwoFactorFailed(TwoFactorAuthenticationFailed $event): void
    {
        $this->recordAuditEvent->handle(AdminAuditAction::TwoFactorChallengeFailed, AdminActorType::Anonymous, subject: $event->user);
    }

    public function onRecoveryCodeUsed(RecoveryCodeReplaced $event): void
    {
        $this->recordAuditEvent->handle(
            AdminAuditAction::RecoveryCodeUsed,
            AdminActorType::Anonymous,
            subject: $event->user,
            metadata: ['recovery_codes_remaining' => $event->user->recoveryCodesRemaining()],
        );
    }

    public function onLogout(Logout $event): void
    {
        if (! $event->user instanceof User || request()->attributes->get(EnsureAdminAccountActive::class.'.ended') === true) {
            return;
        }

        $this->recordAuditEvent->handle(AdminAuditAction::Logout, AdminActorType::User, actor: $event->user, subject: $event->user);
    }

    /**
     * @return array<class-string, string>
     */
    public function subscribe(Dispatcher $events): array
    {
        return [
            Login::class => 'onLogin',
            Failed::class => 'onFailed',
            TwoFactorAuthenticationChallenged::class => 'onChallenged',
            TwoFactorAuthenticationFailed::class => 'onTwoFactorFailed',
            RecoveryCodeReplaced::class => 'onRecoveryCodeUsed',
            Logout::class => 'onLogout',
        ];
    }
}
