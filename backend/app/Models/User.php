<?php

namespace App\Models;

use App\Enums\AdminPermission;
use App\Enums\AdminRole;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Fortify\Events\RecoveryCodeReplaced;
use Laravel\Fortify\Fortify;
use Laravel\Fortify\TwoFactorAuthenticatable;

/**
 * An admin account of the website (B3.1a). Accounts are created only by the owner
 * bootstrap command (later by invitation); there is no registration. Role, activation,
 * suspension, and the TOTP columns are never mass assignable.
 *
 * @property AdminRole|null $role
 */
#[Fillable(['name', 'email', 'password'])]
#[Hidden(['password', 'remember_token', 'two_factor_secret', 'two_factor_recovery_codes'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable, TwoFactorAuthenticatable;

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'role' => AdminRole::class,
            'two_factor_confirmed_at' => 'datetime',
            'activated_at' => 'datetime',
            'suspended_at' => 'datetime',
            'last_login_at' => 'datetime',
        ];
    }

    /**
     * Email addresses are stored lowercased and trimmed, the form sign-in looks them up by.
     */
    protected function email(): Attribute
    {
        return Attribute::make(set: fn (string $value): string => mb_strtolower(trim($value)));
    }

    /**
     * @return HasMany<AdminAccessLink, $this>
     */
    public function adminAccessLinks(): HasMany
    {
        return $this->hasMany(AdminAccessLink::class);
    }

    /**
     * Whether this account may sign in or keep a session: it has a role, finished
     * activation with a confirmed authenticator, and is not suspended.
     */
    public function canSignInToAdmin(): bool
    {
        return $this->role !== null
            && $this->activated_at !== null
            && $this->suspended_at === null
            && $this->hasEnabledTwoFactorAuthentication();
    }

    public function hasAdminPermission(AdminPermission $permission): bool
    {
        return $this->canSignInToAdmin() && $this->role->grants($permission);
    }

    /**
     * @return list<AdminPermission>
     */
    public function adminPermissions(): array
    {
        return $this->canSignInToAdmin() ? $this->role->permissions() : [];
    }

    public function recoveryCodesRemaining(): int
    {
        return $this->two_factor_recovery_codes === null ? 0 : count($this->recoveryCodes());
    }

    /**
     * Consume a used recovery code.
     *
     * Fortify replaces a used code with a fresh one the person never sees, so the number of
     * codes they actually hold would silently shrink while the count stayed at eight. Here
     * the code is removed instead; new codes come only from regeneration, which shows them.
     *
     * @param  string  $code
     */
    public function replaceRecoveryCode($code): void
    {
        $remaining = array_values(array_filter(
            $this->recoveryCodes(),
            fn (string $stored): bool => ! hash_equals($stored, $code),
        ));

        $this->forceFill([
            'two_factor_recovery_codes' => Fortify::currentEncrypter()->encrypt(json_encode($remaining)),
        ])->save();

        RecoveryCodeReplaced::dispatch($this, $code);
    }
}
