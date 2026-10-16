<?php

namespace App\Actions\Admin;

use App\Enums\AdminAccessLinkPurpose;
use App\Enums\AdminActorType;
use App\Enums\AdminAuditAction;
use App\Exceptions\InvalidAdminAccessLinkException;
use App\Models\AdminAccessLink;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Laravel\Fortify\Actions\EnableTwoFactorAuthentication;

class RedeemAdminAccessLink
{
    public function __construct(
        private readonly EnableTwoFactorAuthentication $enableTwoFactor,
        private readonly RecordAdminAuditEvent $recordAuditEvent,
    ) {}

    /**
     * Use an access link once: set the new password (and the name, for an activation),
     * generate a new TOTP secret and recovery codes, and mark the link redeemed.
     *
     * The account stays unable to sign in: its authenticator is unconfirmed until
     * CompleteAdminEnrollment verifies the first code. A second redemption of the same
     * link fails, even concurrently (the link row is locked).
     *
     * @param  array{password: string, name?: string}  $attributes
     *
     * @throws InvalidAdminAccessLinkException
     */
    public function handle(#[\SensitiveParameter] string $token, #[\SensitiveParameter] array $attributes): AdminAccessLink
    {
        return DB::transaction(function () use ($token, $attributes): AdminAccessLink {
            $link = AdminAccessLink::query()
                ->where('token_hash', AdminAccessLink::hashToken($token))
                ->lockForUpdate()
                ->first();

            if ($link === null || ! $link->isRedeemable()) {
                throw new InvalidAdminAccessLinkException;
            }

            $user = User::query()->whereKey($link->user_id)->lockForUpdate()->first();

            if ($user === null || ! self::accountFits($link, $user)) {
                throw new InvalidAdminAccessLinkException;
            }

            $user->forceFill([
                'password' => $attributes['password'],
                'two_factor_confirmed_at' => null,
                ...($link->purpose === AdminAccessLinkPurpose::Activation ? ['name' => $attributes['name']] : []),
            ])->save();

            ($this->enableTwoFactor)($user, true);

            $link->forceFill(['redeemed_at' => now()])->save();

            $this->recordAuditEvent->handle(
                AdminAuditAction::AccessLinkRedeemed,
                AdminActorType::Anonymous,
                subject: $user,
                metadata: ['purpose' => $link->purpose->value],
            );

            return $link;
        });
    }

    /**
     * Whether the account is in the state the link was issued for.
     */
    public static function accountFits(AdminAccessLink $link, User $user): bool
    {
        if ($user->role === null || $user->suspended_at !== null) {
            return false;
        }

        return match ($link->purpose) {
            AdminAccessLinkPurpose::Activation => $user->activated_at === null,
            AdminAccessLinkPurpose::CredentialReset => $user->activated_at !== null,
        };
    }
}
