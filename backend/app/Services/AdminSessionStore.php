<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Database\DatabaseManager;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Collection;
use RuntimeException;

/**
 * The admin sessions of an account in the database session table: listing them for the
 * account holder and ending them (sign-out elsewhere, suspension, role change, credential
 * reset). Session IDs never leave the server; the API refers to a session by a keyed
 * handle derived from its ID.
 */
class AdminSessionStore
{
    public function __construct(private readonly DatabaseManager $database) {}

    /**
     * @return Collection<int, object{id: string, ip_address: ?string, user_agent: ?string, last_activity: int}>
     */
    public function forUser(User $user): Collection
    {
        return $this->table()
            ->where('user_id', $user->getKey())
            ->orderByDesc('last_activity')
            ->get(['id', 'ip_address', 'user_agent', 'last_activity']);
    }

    /**
     * Opaque, stable reference to a session that does not reveal its ID.
     */
    public function handleFor(string $sessionId): string
    {
        return substr(hash_hmac('sha256', $sessionId, $this->handleKey()), 0, 32);
    }

    /**
     * End every session of the account, optionally keeping one (the caller's own).
     *
     * @return int The number of sessions ended.
     */
    public function revokeAll(User $user, ?string $exceptSessionId = null): int
    {
        return $this->table()
            ->where('user_id', $user->getKey())
            ->when($exceptSessionId !== null, fn (Builder $query) => $query->where('id', '!=', $exceptSessionId))
            ->delete();
    }

    /**
     * End one session of the account by its handle.
     *
     * @return bool Whether a session of this account had that handle.
     */
    public function revokeByHandle(User $user, string $handle): bool
    {
        $session = $this->forUser($user)->first(
            fn (object $session): bool => hash_equals($this->handleFor($session->id), $handle),
        );

        if ($session === null) {
            return false;
        }

        $this->table()->where('id', $session->id)->where('user_id', $user->getKey())->delete();

        return true;
    }

    private function table(): Builder
    {
        if (config('session.driver') !== 'database') {
            throw new RuntimeException('Admin sessions need the database session driver (SESSION_DRIVER=database).');
        }

        return $this->database->connection(config('session.connection'))->table(config('session.table'));
    }

    private function handleKey(): string
    {
        return hash_hmac('sha256', 'solveit-admin-session-handle', (string) config('app.key'), true);
    }
}
