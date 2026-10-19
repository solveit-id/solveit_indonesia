<?php

namespace App\Models;

use App\Enums\InquiryStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use LogicException;

/**
 * One step of an inquiry's status workflow (B4a). Written only by
 * App\Actions\Admin\ChangeInquiryStatus, in the same transaction as the status itself and
 * its audit event. Append-only here and, for every database user, by MySQL triggers; it is
 * removed only together with its inquiry.
 *
 * @property InquiryStatus $from_status
 * @property InquiryStatus $to_status
 */
class InquiryStatusChange extends Model
{
    public const UPDATED_AT = null;

    /**
     * @var list<string>
     */
    protected $guarded = ['*'];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'from_status' => InquiryStatus::class,
            'to_status' => InquiryStatus::class,
            'created_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::updating(fn (): never => throw new LogicException('Inquiry status changes are append-only.'));
        static::deleting(fn (): never => throw new LogicException('Inquiry status changes are append-only.'));
    }

    /**
     * @return BelongsTo<Inquiry, $this>
     */
    public function inquiry(): BelongsTo
    {
        return $this->belongsTo(Inquiry::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function changedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'changed_by_user_id');
    }
}
