<?php

namespace App\Actions\Admin;

use App\Enums\AdminAccessLinkPurpose;
use App\Enums\AdminActorType;
use App\Enums\AdminAuditAction;
use App\Exceptions\AdminAccountStateException;
use App\Models\User;
use App\Services\AdminSessionStore;
use Illuminate\Auth\Access\AuthorizationException;
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
     * From the shell (AdminActorType::Cli) this is the emergency path and needs no owner.
     * Over HTTP (AdminActorType::User) the issuer must be an active owner other than the
     * account, checked under the owner lock: the target stops counting as an active owner
     * until it completes the reset, so two owners resetting each other cannot both win.
     * Issuing again for an account whose reset is still pending replaces the link (lost,
     * expired, or never delivered).
     *
     * @throws AuthorizationException
     * @throws AdminAccountStateException
     */
    public function handle(User $user, AdminActorType $actorType, int $ttlMinutes, ?User $issuer = null): IssuedAdminAccessLink
    {
        if ($actorType === AdminActorType::User && $issuer === null) {
            throw new AuthorizationException;
        }

        if ($actorType === AdminActorType::User && $issuer->is($user)) {
            throw AdminAccountStateException::ownCredentials();
        }

        return DB::transaction(function () use ($user, $actorType, $ttlMinutes, $issuer): IssuedAdminAccessLink {
            if ($actorType === AdminActorType::User) {
                ActiveOwners::lockForActor($issuer);
            }

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
                    'access_link_id' => $issued->link->getKey(),
                ],
            );

            return $issued;
        }, ActiveOwners::TRANSACTION_ATTEMPTS);
    }
}
