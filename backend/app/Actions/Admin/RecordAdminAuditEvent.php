<?php

namespace App\Actions\Admin;

use App\Enums\AdminActorType;
use App\Enums\AdminAuditAction;
use App\Models\AdminAccessLink;
use App\Models\AdminAuditEvent;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;
use InvalidArgumentException;

/**
 * Write one admin audit event. The only writer of admin_audit_events.
 *
 * Metadata is an allowlist of keys with scalar values, so a caller cannot record a
 * password, code, token, session ID, or personal data by accident. Request context
 * (IP address, truncated user agent) is added for HTTP actors, never for the shell.
 */
class RecordAdminAuditEvent
{
    /**
     * Metadata keys an event may carry. Values must be scalar or null.
     */
    public const ALLOWED_METADATA_KEYS = [
        'purpose',
        'reason',
        'from_role',
        'to_role',
        'email_fingerprint',
        'recovery_codes_remaining',
        'sessions_ended',
    ];

    /**
     * @param  array<string, scalar|null>  $metadata
     */
    public function handle(
        AdminAuditAction $action,
        AdminActorType $actorType,
        ?User $actor = null,
        ?Model $subject = null,
        array $metadata = [],
    ): AdminAuditEvent {
        $this->assertSafeMetadata($metadata);

        $request = $actorType === AdminActorType::Cli ? null : request();

        $event = new AdminAuditEvent;
        $event->forceFill([
            'occurred_at' => now(),
            'action' => $action,
            'actor_type' => $actorType,
            'actor_user_id' => $actor?->getKey(),
            'subject_type' => $subject === null ? null : $this->subjectType($subject),
            'subject_id' => $subject?->getKey(),
            'ip_address' => $request?->ip(),
            'user_agent' => $request === null ? null : Str::limit((string) $request->userAgent(), 252),
            'metadata' => $metadata === [] ? null : $metadata,
        ])->save();

        return $event;
    }

    /**
     * Keyed fingerprint of an email address typed at sign-in, so repeated failures against
     * one address can be correlated without storing the address (which may not even be an
     * account). Depends on APP_KEY: fingerprints change if the key is rotated.
     */
    public static function emailFingerprint(string $email): string
    {
        $key = hash_hmac('sha256', 'solveit-admin-audit-email', (string) config('app.key'), true);

        return hash_hmac('sha256', mb_strtolower(trim($email)), $key);
    }

    /**
     * @param  array<string, mixed>  $metadata
     */
    private function assertSafeMetadata(array $metadata): void
    {
        foreach ($metadata as $key => $value) {
            if (! in_array($key, self::ALLOWED_METADATA_KEYS, true) || ! (is_scalar($value) || $value === null)) {
                throw new InvalidArgumentException("Audit metadata key [{$key}] is not allowed.");
            }
        }
    }

    private function subjectType(Model $subject): string
    {
        return match (true) {
            $subject instanceof User => 'user',
            $subject instanceof AdminAccessLink => 'access-link',
            default => throw new InvalidArgumentException('Unsupported audit subject.'),
        };
    }
}
