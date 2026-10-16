<?php

namespace App\Actions\Admin;

use App\Enums\AdminAccessLinkPurpose;
use App\Enums\AdminActorType;
use App\Enums\AdminAuditAction;
use App\Enums\AdminRole;
use App\Exceptions\OwnerBootstrapRefusedException;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class BootstrapAdminOwner
{
    public function __construct(
        private readonly IssueAdminAccessLink $issueAccessLink,
        private readonly RecordAdminAuditEvent $recordAuditEvent,
    ) {}

    /**
     * Create the first owner account (not yet usable) and an activation link for it.
     *
     * Refused once any owner is active: from then on accounts come only from an owner.
     * Running it again for the same pending address replaces the link, so a lost or
     * expired bootstrap link can be reissued. The account gets an unknown random password;
     * the person sets theirs and enrols TOTP through the link. The owner rows are locked,
     * so two concurrent runs cannot create two owners.
     *
     * @throws OwnerBootstrapRefusedException
     */
    public function handle(string $email): IssuedAdminAccessLink
    {
        $email = mb_strtolower(trim($email));

        return DB::transaction(function () use ($email): IssuedAdminAccessLink {
            $owners = User::query()->where('role', AdminRole::Owner)->lockForUpdate()->get();

            if ($owners->contains(fn (User $owner): bool => $owner->activated_at !== null)) {
                throw OwnerBootstrapRefusedException::activeOwnerExists();
            }

            if ($owners->contains(fn (User $owner): bool => $owner->email !== $email)) {
                throw OwnerBootstrapRefusedException::anotherOwnerPending();
            }

            $user = User::query()->where('email', $email)->lockForUpdate()->first();

            if ($user !== null && $user->role !== AdminRole::Owner) {
                throw OwnerBootstrapRefusedException::emailBelongsToAnotherAccount();
            }

            if ($user === null) {
                $user = new User;
                $user->forceFill([
                    'name' => '',
                    'email' => $email,
                    'password' => Str::random(64),
                    'role' => AdminRole::Owner,
                ])->save();
            }

            $issued = $this->issueAccessLink->handle(
                $user,
                AdminAccessLinkPurpose::Activation,
                (int) config('admin.access_links.cli_ttl_minutes'),
            );

            $this->recordAuditEvent->handle(
                AdminAuditAction::OwnerBootstrapIssued,
                AdminActorType::Cli,
                subject: $user,
                metadata: ['purpose' => AdminAccessLinkPurpose::Activation->value],
            );

            return $issued;
        });
    }
}
