<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use LogicException;

/**
 * An internal note of the admin team about an inquiry (B4a). Never shown to the visitor.
 * The body may hold personal data, so it is never logged or copied into the audit log
 * (the audit event carries only the note ID). Append-only here and, for every database
 * user, by MySQL triggers: a correction is a new note. It is removed only together with
 * its inquiry.
 */
class InquiryNote extends Model
{
    public const UPDATED_AT = null;

    /**
     * Longest note, in characters.
     */
    public const MAX_LENGTH = 2000;

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
            'created_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::updating(fn (): never => throw new LogicException('Inquiry notes are append-only.'));
        static::deleting(fn (): never => throw new LogicException('Inquiry notes are append-only.'));
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
    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'author_user_id');
    }
}
