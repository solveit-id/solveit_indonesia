<?php

namespace App\Actions\Admin;

use App\Enums\AdminActorType;
use App\Enums\AdminAuditAction;
use App\Models\User;
use App\Services\AdminSessionStore;
use Illuminate\Support\Facades\DB;

class UpdateAdminPassword
{
    public function __construct(
        private readonly AdminSessionStore $sessions,
        private readonly RecordAdminAuditEvent $recordAuditEvent,
    ) {}

    /**
     * Replace the signed-in account's password (the current one was verified by the
     * request) and end its other sessions. The caller's session continues.
     *
     * @return int The number of other sessions ended.
     */
    public function handle(User $user, #[\SensitiveParameter] string $password, string $currentSessionId): int
    {
        return DB::transaction(function () use ($user, $password, $currentSessionId): int {
            $user->forceFill(['password' => $password])->save();

            $sessionsEnded = $this->sessions->revokeAll($user, $currentSessionId);

            $this->recordAuditEvent->handle(
                AdminAuditAction::PasswordChanged,
                AdminActorType::User,
                actor: $user,
                subject: $user,
                metadata: ['sessions_ended' => $sessionsEnded],
            );

            return $sessionsEnded;
        });
    }
}
