<?php

namespace App\Models;

use App\Enums\InquiryBudget;
use App\Enums\InquiryService;
use App\Enums\InquiryStatus;
use App\Enums\InquiryTimeline;
use Database\Factories\InquiryFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * A consultation request sent from the website. Holds personal contact data:
 * see docs/api/inquiries.md (privacy) before reading, exporting, or logging it.
 *
 * `id` is internal; `public_id` is the only identifier shown to visitors.
 * `public_id` and `status` are never mass assignable.
 */
#[Fillable(['name', 'organization', 'contact', 'service', 'budget', 'timeline', 'message'])]
class Inquiry extends Model
{
    /** @use HasFactory<InquiryFactory> */
    use HasFactory;

    /**
     * Crockford base32: no I, L, O, or U, so a reference read aloud cannot be misheard.
     */
    private const PUBLIC_ID_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

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
}
