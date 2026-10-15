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

/**
 * A consultation request sent from the website. Holds personal contact data:
 * see docs/api/inquiries.md (privacy) before reading, exporting, or logging it.
 *
 * `id` is internal; `public_id` is the only identifier shown to visitors.
 * `public_id`, `idempotency_key_hash`, and `status` are never mass assignable.
 */
#[Fillable(self::SUBMITTED_FIELDS)]
#[Hidden(['idempotency_key_hash'])]
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
}
