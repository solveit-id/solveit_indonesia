<?php

namespace App\Actions\Admin;

use App\Enums\AdminAccessLinkPurpose;
use App\Enums\AdminActorType;
use App\Enums\AdminAuditAction;
use App\Exceptions\AdminAccountStateException;
use App\Models\User;
use App\Services\AdminSessionStore;
use Illuminate\Support\Facades\DB;

class ResetAdminCredentials
{
    public function __construct(
        private readonly IssueAdminAccessLink $issueAccessLink,
        private readonly AdminSessionStore $sessions,
        private readonly RecordAdminAuditEvent $recordAuditEvent,
    ) {}

    /**
     * Prepare a lost-credentials recovery: remove the authenticator and recovery codes,
     * end every session, and issue a credential-reset link. Until the link is completed
     * (new password and a newly confirmed authenticator) the account cannot sign in,
     * so a stolen password or session stops working at once. The password itself is
     * replaced only when the link is redeemed.
     *
     * @throws AdminAccountStateException
     */
    public function handle(User $user, AdminActorType $actorType, int $ttlMinutes, ?User $issuer = null): IssuedAdminAccessLink
    {
        return DB::transaction(function () use ($user, $actorType, $ttlMinutes, $issuer): IssuedAdminAccessLink {
            $user = User::query()->whereKey($user->getKey())->lockForUpdate()->firstOrFail();

            if ($user->role === null) {
                throw AdminAccountStateException::withoutRole();
            }

            if ($user->activated_at === null) {
                throw AdminAccountStateException::notActivated();
            }

            if ($user->suspended_at !== null) {
                throw AdminAccountStateException::suspended();
            }

            $user->forceFill([
                'two_factor_secret' => null,
                'two_factor_recovery_codes' => null,
                'two_factor_confirmed_at' => null,
            ])->save();

            $sessionsEnded = $this->sessions->revokeAll($user);

            $issued = $this->issueAccessLink->handle($user, AdminAccessLinkPurpose::CredentialReset, $ttlMinutes, $issuer);

            $this->recordAuditEvent->handle(
                AdminAuditAction::CredentialResetIssued,
                $actorType,
                actor: $issuer,
                subject: $user,
                metadata: [
                    'purpose' => AdminAccessLinkPurpose::CredentialReset->value,
                    'sessions_ended' => $sessionsEnded,
                ],
            );

            return $issued;
        });
    }
}
