<?php

namespace App\Models;

use App\Enums\AdminAccessLinkPurpose;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A one-time link to activate an account or reset its credentials. Only the SHA-256 of
 * the token is stored; the token itself exists once, in the issuer's output. Nothing is
 * mass assignable: links are created only by App\Actions\Admin\IssueAdminAccessLink.
 *
 * @property AdminAccessLinkPurpose $purpose
 */
class AdminAccessLink extends Model
{
    /**
     * Raw token length: 32 random bytes as unpadded base64url.
     */
    public const TOKEN_LENGTH = 43;

    /**
     * @var list<string>
     */
    protected $guarded = ['*'];

    /**
     * @var list<string>
     */
    protected $hidden = ['token_hash'];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'purpose' => AdminAccessLinkPurpose::class,
            'expires_at' => 'datetime',
            'redeemed_at' => 'datetime',
            'completed_at' => 'datetime',
            'revoked_at' => 'datetime',
        ];
    }

    /**
     * A new random token (256 bits) in URL-safe form.
     */
    public static function newToken(): string
    {
        return rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=');
    }

    public static function hashToken(string $token): string
    {
        return hash('sha256', $token);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Links that can still be redeemed: not redeemed, not revoked, not expired.
     *
     * @param  Builder<self>  $query
     */
    public function scopeRedeemable(Builder $query): void
    {
        $query->whereNull('redeemed_at')->whereNull('revoked_at')->where('expires_at', '>', now());
    }

    public function isRedeemable(): bool
    {
        return $this->redeemed_at === null && $this->revoked_at === null && $this->expires_at->isFuture();
    }

    /**
     * Redeemed in this enrollment and waiting for the first TOTP code.
     */
    public function awaitsCompletion(): bool
    {
        return $this->redeemed_at !== null && $this->completed_at === null && $this->revoked_at === null;
    }
}
