<?php

namespace App\Models;

use App\Enums\InquiryBudget;
use App\Enums\InquiryService;
use App\Enums\InquiryStatus;
use App\Enums\InquiryTimeline;
use Database\Factories\InquiryFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use LogicException;

/**
 * A consultation request sent from the website. Holds personal contact data:
 * see docs/api/inquiries.md (privacy) before reading, exporting, or logging it.
 *
 * `id` is internal; `public_id` is the only identifier shown to visitors (the admin API
 * uses both). `public_id`, `idempotency_key_hash`, and `status` are never mass assignable.
 * Once stored, what the visitor sent never changes (here and by a MySQL trigger); the admin
 * changes only the workflow status. `contact` is never serialized: the admin API shows it
 * masked, and in full only through the recorded reveal (B4a).
 */
#[Fillable(self::SUBMITTED_FIELDS)]
#[Hidden(['idempotency_key_hash', 'contact'])]
class Inquiry extends Model
{
    /** @use HasFactory<InquiryFactory> */
    use HasFactory;

    /**
     * Crockford base32: no I, L, O, or U, so a reference read aloud cannot be misheard.
     */
    private const PUBLIC_ID_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

    /**
     * The fields a visitor submits, in the order of the contact form.
     */
    public const SUBMITTED_FIELDS = ['name', 'organization', 'contact', 'service', 'budget', 'timeline', 'message'];

    /**
     * Columns that never change after the insert: the submission, its references, and
     * when it arrived. The B2.1 idempotency check compares a retry with the stored row.
     */
    public const IMMUTABLE_COLUMNS = [...self::SUBMITTED_FIELDS, 'public_id', 'idempotency_key_hash', 'created_at'];

    /**
     * Character that replaces the hidden part of a masked contact.
     */
    private const MASK = '•';

    /**
     * Phone digits kept at the end of a masked number, shown only when the number has at
     * least MASKED_PHONE_MIN_DIGITS digits, so a short value is never shown almost whole.
     */
    private const MASKED_PHONE_VISIBLE_DIGITS = 3;

    private const MASKED_PHONE_MIN_DIGITS = 8;

    protected static function booted(): void
    {
        static::updating(function (Inquiry $inquiry): void {
            if ($inquiry->isDirty(self::IMMUTABLE_COLUMNS)) {
                throw new LogicException('The submitted fields of an inquiry cannot be changed.');
            }
        });
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'service' => InquiryService::class,
            'budget' => InquiryBudget::class,
            'timeline' => InquiryTimeline::class,
            'status' => InquiryStatus::class,
        ];
    }

    /**
     * Generate a random public reference such as `INQ-7K3M-9QX2-HD4T` (60 random bits).
     */
    public static function newPublicId(): string
    {
        $alphabet = self::PUBLIC_ID_ALPHABET;
        $characters = '';

        for ($index = 0; $index < 12; $index++) {
            $characters .= $alphabet[random_int(0, strlen($alphabet) - 1)];
        }

        return 'INQ-'.implode('-', str_split($characters, 4));
    }

    /**
     * The stored form of a client's Idempotency-Key: its SHA-256, so the database never holds
     * a key that could be replayed. The key is 122 random bits, so no salt or secret is needed,
     * and the hash survives an APP_KEY rotation.
     */
    public static function hashIdempotencyKey(string $key): string
    {
        return hash('sha256', $key);
    }

    /**
     * Whether validated submission attributes are the same inquiry as this stored one.
     *
     * Compares the canonical values (trimmed, empty organization as null, enum values),
     * field by field against the stored row, so no second copy or fingerprint of the
     * personal data is kept. Field order and ignored extra fields make no difference.
     *
     * @param  array<string, mixed>  $attributes
     */
    public function matchesSubmission(array $attributes): bool
    {
        foreach (self::SUBMITTED_FIELDS as $field) {
            $stored = $this->getRawOriginal($field);
            $submitted = $attributes[$field] ?? null;

            if ($stored !== $submitted) {
                return false;
            }
        }

        return true;
    }

    /**
     * @return HasMany<InquiryStatusChange, $this>
     */
    public function statusChanges(): HasMany
    {
        return $this->hasMany(InquiryStatusChange::class);
    }

    /**
     * @return HasMany<InquiryNote, $this>
     */
    public function notes(): HasMany
    {
        return $this->hasMany(InquiryNote::class);
    }

    /**
     * `email` or `phone`: the website accepts exactly these two forms (App\Rules\EmailOrPhone),
     * and only the email form contains "@".
     */
    public function contactType(): string
    {
        return str_contains((string) $this->contact, '@') ? 'email' : 'phone';
    }

    /**
     * The contact as the admin sees it by default. Email: the first character of the name
     * and of the domain, and the top-level domain (`r•••@e•••.com`). Phone: an optional
     * leading `+` and the last three digits (`+•••••••358`). The mask has a fixed length, so
     * it does not reveal how long the value is.
     */
    public function maskedContact(): string
    {
        $contact = (string) $this->contact;
        $mask = str_repeat(self::MASK, 3);

        if ($this->contactType() === 'email') {
            $at = (int) mb_strrpos($contact, '@');
            $local = mb_substr($contact, 0, $at);
            $domain = mb_substr($contact, $at + 1);
            $topLevel = mb_substr($domain, (int) mb_strrpos($domain, '.') + 1);

            return mb_substr($local, 0, 1).$mask.'@'.mb_substr($domain, 0, 1).$mask.'.'.$topLevel;
        }

        $digits = (string) preg_replace('/\D/', '', $contact);
        $visible = strlen($digits) >= self::MASKED_PHONE_MIN_DIGITS ? substr($digits, -self::MASKED_PHONE_VISIBLE_DIGITS) : '';

        return (str_starts_with($contact, '+') ? '+' : '').str_repeat(self::MASK, 7).$visible;
    }
}
