<?php

namespace Tests\Feature\Admin;

use App\Actions\Admin\RecordAdminAuditEvent;
use App\Enums\AdminActorType;
use App\Enums\AdminAuditAction;
use App\Enums\AdminRole;
use App\Models\AdminAuditEvent;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Support\InteractsWithAdminApi;
use Tests\TestCase;

/**
 * Owner-only audit reader (B3.1b): read-only, newest first, cursor pages, allowlisted
 * filters and output, nothing secret.
 */
class AdminAuditReaderTest extends TestCase
{
    use InteractsWithAdminApi;
    use RefreshDatabase;

    public function test_an_owner_reads_events_newest_first_with_allowlisted_fields(): void
    {
        $owner = $this->createActiveAdmin(AdminRole::Owner);
        $this->signIn($owner);

        $response = $this->adminRequest('GET', 'audit-events')->assertOk()->assertHeader('Cache-Control', 'no-store, private');

        $ids = array_column($response->json('data'), 'id');
        $this->assertSame(AdminAuditEvent::query()->orderByDesc('id')->pluck('id')->all(), $ids);
        $newest = $response->json('data.0');
        $this->assertSame(['id', 'occurred_at', 'action', 'actor', 'subject', 'ip_address', 'user_agent', 'metadata'], array_keys($newest));
        $this->assertSame('login.succeeded', $newest['action']);
        $this->assertSame(['type' => 'user', 'user_id' => $owner->id], $newest['actor']);
        $this->assertSame(['type' => 'user', 'id' => $owner->id], $newest['subject']);
        $this->assertSame('127.0.0.1', $newest['ip_address']);
    }

    public function test_the_admin_role_cannot_read_the_audit_log(): void
    {
        $this->signIn($this->createActiveAdmin());

        $this->adminRequest('GET', 'audit-events')->assertForbidden();
        $this->adminRequest('GET', 'audit-events?per_page=1000')->assertForbidden();
    }

    public function test_there_is_no_way_to_change_delete_or_export_events(): void
    {
        $this->signIn($this->createActiveAdmin(AdminRole::Owner));
        $this->confirmAdminPassword();
        $id = AdminAuditEvent::query()->value('id');
        $count = AdminAuditEvent::query()->count();

        foreach (['POST', 'PUT', 'PATCH', 'DELETE'] as $method) {
            $this->adminRequest($method, 'audit-events')->assertStatus(405);
        }

        foreach (['GET', 'PUT', 'PATCH', 'DELETE'] as $method) {
            $this->adminRequest($method, "audit-events/{$id}")->assertNotFound();
        }

        $this->adminRequest('GET', 'audit-events/export')->assertNotFound();
        $this->assertSame($count, AdminAuditEvent::query()->count());
    }

    public function test_pages_follow_the_cursor_without_gaps_or_repeats_while_events_arrive(): void
    {
        $this->signIn($this->createActiveAdmin(AdminRole::Owner));
        $this->recordSyntheticEvents(7);
        $expected = AdminAuditEvent::query()->orderByDesc('id')->pluck('id')->all();

        $seen = [];
        $cursor = null;
        do {
            $page = $this->adminRequest('GET', 'audit-events?per_page=3'.($cursor ? "&cursor={$cursor}" : ''))->assertOk();
            $this->assertLessThanOrEqual(3, count($page->json('data')));
            $seen = [...$seen, ...array_column($page->json('data'), 'id')];
            $cursor = $page->json('meta.next_cursor');
            // A new event between pages must not shift what the next page returns.
            $this->recordSyntheticEvents(1);
        } while ($cursor !== null);

        $this->assertSame($expected, $seen);
    }

    public function test_the_default_and_maximum_page_sizes_apply(): void
    {
        $this->signIn($this->createActiveAdmin(AdminRole::Owner));
        $this->recordSyntheticEvents(120);

        $this->assertCount(25, $this->adminRequest('GET', 'audit-events')->json('data'));
        $this->assertCount(100, $this->adminRequest('GET', 'audit-events?per_page=100')->json('data'));
        $this->adminRequest('GET', 'audit-events?per_page=101')->assertUnprocessable()->assertJsonValidationErrors(['per_page']);
    }

    public function test_filters_select_by_action_actor_subject_and_time(): void
    {
        $owner = $this->createActiveAdmin(AdminRole::Owner);
        $admin = $this->createActiveAdmin();
        $this->usingAdminClient('admin')->signIn($admin);
        $this->travel(1)->hours();
        $this->usingAdminClient('owner')->signIn($owner);
        $this->confirmAdminPassword();
        $this->adminRequest('POST', "users/{$admin->id}/suspension")->assertOk();

        $this->assertActions(['account.suspended'], 'action=account.suspended');
        $this->assertSame([$owner->id], array_unique(array_column(array_column($this->adminRequest('GET', "audit-events?actor_user_id={$owner->id}")->json('data'), 'actor'), 'user_id')));
        $this->assertActions(['account.suspended', 'login.succeeded'], "subject_user_id={$admin->id}");
        $this->assertActions(['login.succeeded'], "subject_user_id={$admin->id}&occurred_to=".urlencode(now()->subMinutes(30)->toIso8601String()));
        $this->assertActions(['account.suspended'], "subject_user_id={$admin->id}&occurred_from=".urlencode(now()->subMinutes(30)->toIso8601String()));
        $this->assertActions(['login.succeeded'], "actor_type=user&action=login.succeeded&subject_user_id={$admin->id}");
        $this->assertActions([], 'actor_type=cli');
    }

    /**
     * @return array<string, array{string, string}>
     */
    public static function invalidFilters(): array
    {
        return [
            'unknown action' => ['action=account.deleted', 'action'],
            'unknown actor type' => ['actor_type=root', 'actor_type'],
            'non-numeric actor' => ['actor_user_id=1%20or%201%3D1', 'actor_user_id'],
            'zero subject' => ['subject_user_id=0', 'subject_user_id'],
            'not a date' => ['occurred_from=yesterday-ish', 'occurred_from'],
            'reversed range' => ['occurred_from=2026-10-16T10:00:00Z&occurred_to=2026-10-16T09:00:00Z', 'occurred_to'],
            'metadata search' => ['metadata=sessions_ended', 'metadata'],
            'ip search' => ['ip_address=127.0.0.1', 'ip_address'],
            'ordering' => ['order=asc', 'order'],
            'tampered cursor' => ['cursor='.rtrim(strtr(base64_encode('{"id":"1 or 1=1","_pointsToNextItems":true}'), '+/', '-_'), '='), 'cursor'],
            'cursor with an extra column' => ['cursor='.rtrim(strtr(base64_encode('{"id":5,"action":"x","_pointsToNextItems":true}'), '+/', '-_'), '='), 'cursor'],
        ];
    }

    #[DataProvider('invalidFilters')]
    public function test_filters_outside_the_allowlist_are_refused(string $query, string $field): void
    {
        $this->signIn($this->createActiveAdmin(AdminRole::Owner));

        $this->adminRequest('GET', "audit-events?{$query}")->assertUnprocessable()->assertJsonValidationErrors([$field]);
    }

    public function test_output_holds_no_secret_even_after_a_full_administration_round(): void
    {
        $owner = $this->createActiveAdmin(AdminRole::Owner);
        $admin = $this->createActiveAdmin();
        $this->signIn($owner);
        $this->confirmAdminPassword();
        $invited = $this->adminRequest('POST', 'invitations', ['email' => 'invitee@example.com', 'role' => 'admin'])->assertCreated();
        $reset = $this->adminRequest('POST', "users/{$admin->id}/credential-reset", ['acknowledge_access_loss' => true])->assertCreated();
        $this->adminRequest('PUT', "users/{$admin->id}/role", ['role' => 'owner'])->assertOk();
        $this->usingAdminClient('failed');
        $this->adminRequest('GET', 'auth/csrf-cookie');
        $this->adminRequest('POST', 'auth/login', ['email' => 'someone@example.com', 'password' => 'wrong password guess'])->assertUnprocessable();
        $this->usingAdminClient('browser');

        $content = (string) $this->adminRequest('GET', 'audit-events?per_page=100')->assertOk()->getContent();

        foreach ([$invited->json('data.access_link.url'), $reset->json('data.access_link.url')] as $url) {
            $this->assertStringNotContainsString($this->tokenFromAccessLink($url), $content);
        }
        foreach ([self::ADMIN_PASSWORD, 'wrong password guess', 'someone@example.com', $this->totpSecret($owner), '#token=', 'token_hash'] as $secret) {
            $this->assertStringNotContainsString($secret, $content);
        }
        $this->assertStringNotContainsString((string) DB::table('sessions')->where('user_id', $owner->id)->value('id'), $content);
    }

    public function test_metadata_keys_outside_the_allowlist_are_never_shown(): void
    {
        $this->signIn($this->createActiveAdmin(AdminRole::Owner));
        // Written past the action, as a row from an older or tampered writer would be.
        DB::table('admin_audit_events')->insert([
            'occurred_at' => now(),
            'action' => AdminAuditAction::Logout->value,
            'actor_type' => AdminActorType::Cli->value,
            'metadata' => json_encode(['sessions_ended' => 1, 'password' => 'leaked', 'token' => 'leaked']),
        ]);

        $response = $this->adminRequest('GET', 'audit-events?actor_type=cli')->assertOk();

        $this->assertSame(['sessions_ended' => 1], $response->json('data.0.metadata'));
        $this->assertStringNotContainsString('leaked', $response->getContent());
    }

    /**
     * @param  list<string>  $actions
     */
    private function assertActions(array $actions, string $query): void
    {
        $this->assertSame($actions, array_column($this->adminRequest('GET', "audit-events?{$query}")->assertOk()->json('data'), 'action'));
    }

    private function recordSyntheticEvents(int $count): void
    {
        for ($index = 0; $index < $count; $index++) {
            app(RecordAdminAuditEvent::class)->handle(AdminAuditAction::LoginFailed, AdminActorType::Anonymous, metadata: ['email_fingerprint' => str_repeat('a', 64)]);
        }
    }
}
