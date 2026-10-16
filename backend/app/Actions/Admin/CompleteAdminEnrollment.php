<?php

namespace App\Actions\Admin;

use App\Enums\AdminAccessLinkPurpose;
use App\Enums\AdminActorType;
use App\Enums\AdminAuditAction;
use App\Exceptions\InvalidAdminAccessLinkException;
use App\Models\AdminAccessLink;
use App\Models\User;
use App\Services\AdminSessionStore;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Laravel\Fortify\Actions\ConfirmTwoFactorAuthentication;

class CompleteAdminEnrollment
{
    public function __construct(
        private readonly ConfirmTwoFactorAuthentication $confirmTwoFactor,
        private readonly AdminSessionStore $sessions,
        private readonly RecordAdminAuditEvent $recordAuditEvent,
    ) {}

    /**
     * Finish a redeemed access link with the first TOTP code: confirm the authenticator,
     * activate the account (activation) and close the link. Every existing session of
     * the account ends. Returns the account and its recovery codes, which the caller shows
     * exactly once.
     *
     * @return array{user: User, recovery_codes: list<string>}
     *
     * @throws InvalidAdminAccessLinkException when the link is no longer waiting for completion.
     * @throws ValidationException when the code is wrong (nothing changes).
     */
    public function handle(int $linkId, int $userId, #[\SensitiveParameter] string $code): array
    {
        return DB::transaction(function () use ($linkId, $userId, $code): array {
            $link = AdminAccessLink::query()->whereKey($linkId)->lockForUpdate()->first();

            if ($link === null || (int) $link->user_id !== $userId || ! $link->awaitsCompletion()) {
                throw new InvalidAdminAccessLinkException;
            }

            $user = User::query()->whereKey($userId)->lockForUpdate()->first();

            if ($user === null || ! RedeemAdminAccessLink::accountFits($link, $user)) {
                throw new InvalidAdminAccessLinkException;
            }

            ($this->confirmTwoFactor)($user, $code);

            $activation = $link->purpose === AdminAccessLinkPurpose::Activation;

            if ($activation) {
                $user->forceFill(['activated_at' => now()])->save();
            }

            $link->forceFill(['completed_at' => now()])->save();

            $sessionsEnded = $this->sessions->revokeAll($user);

            $this->recordAuditEvent->handle(
                $activation ? AdminAuditAction::AccountActivated : AdminAuditAction::CredentialResetCompleted,
                AdminActorType::Anonymous,
                subject: $user,
                metadata: ['purpose' => $link->purpose->value, 'sessions_ended' => $sessionsEnded],
            );

            return ['user' => $user, 'recovery_codes' => $user->recoveryCodes()];
        });
    }
}
