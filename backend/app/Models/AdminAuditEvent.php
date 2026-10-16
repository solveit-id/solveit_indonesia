<?php

namespace App\Models;

use App\Enums\AdminActorType;
use App\Enums\AdminAuditAction;
use Illuminate\Database\Eloquent\Model;
use LogicException;

/**
 * One append-only security event. Written only through App\Actions\Admin\RecordAdminAuditEvent.
 * Updates and deletes are refused here and, for every database user, by the triggers
 * created in the migration. Retention is pending an owner decision, so nothing prunes it.
 *
 * @property AdminAuditAction $action
 * @property AdminActorType $actor_type
 * @property array<string, scalar|null>|null $metadata
 */
class AdminAuditEvent extends Model
{
    public const UPDATED_AT = null;

    public const CREATED_AT = 'occurred_at';

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
            'occurred_at' => 'datetime',
            'action' => AdminAuditAction::class,
            'actor_type' => AdminActorType::class,
            'metadata' => 'array',
        ];
    }

    protected static function booted(): void
    {
        static::updating(fn (): never => throw new LogicException('Admin audit events are append-only.'));
        static::deleting(fn (): never => throw new LogicException('Admin audit events are append-only.'));
    }
}
