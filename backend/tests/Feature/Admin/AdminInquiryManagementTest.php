<?php

namespace Tests\Feature\Admin;

use App\Actions\Admin\AddInquiryNote;
use App\Actions\Admin\ChangeInquiryStatus;
use App\Actions\Admin\RevealInquiryContact;
use App\Enums\AdminAuditAction;
use App\Enums\AdminRole;
use App\Enums\InquiryStatus;
use App\Exceptions\InquiryNoteNotStoredException;
use App\Models\AdminAuditEvent;
use App\Models\Inquiry;
use App\Models\InquiryNote;
use App\Models\InquiryStatusChange;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\Events\QueryExecuted;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Exceptions;
use Illuminate\Support\Facades\Gate;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Support\InteractsWithAdminApi;
use Tests\TestCase;

/**
 * Inquiry management (B4a): list, detail, status workflow, internal notes, and history.
 * Contract: docs/api/admin-inquiries.md. Contact reveal and privacy: AdminInquiryContactTest.
 * Behaviour under concurrent processes: AdminInquiryConcurrencyTest.
 */
class AdminInquiryManagementTest extends TestCase
{
    use InteractsWithAdminApi;
    use RefreshDatabase;

    private const LIST_FIELDS = ['id', 'reference', 'status', 'name', 'organization', 'contact', 'service', 'budget', 'timeline', 'received_at', 'updated_at'];

    /**
     * Error bodies are asserted as production returns them (APP_DEBUG=false, required
     * outside local development); CI runs the suite with APP_DEBUG=true.
     */
    protected function setUp(): void
    {
        parent::setUp();

        config(['app.debug' => false]);
    }

    /**
     * @return array<string, array{string, string, array<string, mixed>, string}>
     */
    public static function inquiryRoutes(): array
    {
        return [
            'list' => ['GET', 'inquiries', [], 'inquiries.view'],
            'detail' => ['GET', 'inquiries/{inquiry}', [], 'inquiries.view'],
            'status history' => ['GET', 'inquiries/{inquiry}/status-changes', [], 'inquiries.view'],
            'notes' => ['GET', 'inquiries/{inquiry}/notes', [], 'inquiries.view'],
            'status change' => ['PUT', 'inquiries/{inquiry}/status', ['status' => 'in-review', 'expected_status' => 'received'], 'inquiries.change-status'],
            'new note' => ['POST', 'inquiries/{inquiry}/notes', ['body' => 'Called back.'], 'inquiries.add-note'],
            'contact reveal' => ['POST', 'inquiries/{inquiry}/contact-reveal', ['acknowledge_personal_data' => true], 'inquiries.reveal-contact'],
        ];
    }

    /**
     * @param  array<string, mixed>  $data
     */
    #[DataProvider('inquiryRoutes')]
    public function test_inquiry_routes_need_a_session(string $method, string $path, array $data, string $permission): void
    {
        $inquiry = $this->inquiry();
        $this->adminRequest('GET', 'auth/csrf-cookie');

        $response = $this->adminRequest($method, str_replace('{inquiry}', (string) $inquiry->id, $path), $data)->assertUnauthorized();

        $this->assertStringNotContainsString('Rina', $response->getContent());
        $this->assertNothingWritten($inquiry);
    }

    /**
     * Both roles hold the inquiry permissions; this proves each route asks its own Gate,
     * before the inquiry is looked up (the same answer for an existing and a missing ID).
     *
     * @param  array<string, mixed>  $data
     */
    #[DataProvider('inquiryRoutes')]
    public function test_each_route_is_refused_without_its_permission(string $method, string $path, array $data, string $permission): void
    {
        $inquiry = $this->inquiry();
        $this->signInConfirmedAdmin();
        Gate::define($permission, fn (): bool => false);

        $forExisting = $this->adminRequest($method, str_replace('{inquiry}', (string) $inquiry->id, $path), $data)->assertForbidden();
        $forMissing = $this->adminRequest($method, str_replace('{inquiry}', '999999', $path), $data)->assertForbidden();

        $this->assertSame($forExisting->getContent(), $forMissing->getContent());
        $this->assertStringNotContainsString('Rina', $forExisting->getContent());
        $this->assertNothingWritten($inquiry);
    }

    /**
     * @return array<string, array{string, string, array<string, mixed>, string}>
     */
    public static function singleInquiryRoutes(): array
    {
        return array_filter(self::inquiryRoutes(), fn (array $route): bool => str_contains($route[1], '{inquiry}'));
    }

    /**
     * @param  array<string, mixed>  $data
     */
    #[DataProvider('singleInquiryRoutes')]
    public function test_a_missing_inquiry_is_404(string $method, string $path, array $data, string $permission): void
    {
        $this->signInConfirmedAdmin();

        $this->adminRequest($method, str_replace('{inquiry}', '999999', $path), $data)
            ->assertNotFound()
            ->assertExactJson(['message' => 'Inquiry not found.']);
    }

    public function test_writes_without_csrf_or_from_another_origin_change_nothing(): void
    {
        $inquiry = $this->inquiry();
        $this->signInConfirmedAdmin();
        $status = ['status' => 'in-review', 'expected_status' => 'received'];

        $this->adminRequest('PUT', "inquiries/{$inquiry->id}/status", $status, sendXsrf: false)->assertStatus(419);
        $this->adminRequest('PUT', "inquiries/{$inquiry->id}/status", $status, headers: ['Origin' => 'https://evil.example'])->assertForbidden();
        $this->adminRequest('POST', "inquiries/{$inquiry->id}/notes", ['body' => 'x'], headers: ['Origin' => null])->assertForbidden();
        $this->adminRequest('GET', 'inquiries', headers: ['Sec-Fetch-Site' => 'cross-site'])->assertForbidden();

        $this->assertNothingWritten($inquiry);
    }

    public function test_an_admin_lists_inquiries_newest_first_with_masked_contacts_and_no_message(): void
    {
        $older = $this->inquiry(['contact' => '+62 877-5964-1358', 'organization' => null]);
        $newer = $this->inquiry();
        $this->signInConfirmedAdmin();

        $response = $this->adminRequest('GET', 'inquiries')->assertOk();

        $this->assertSame([$newer->id, $older->id], array_column($response->json('data'), 'id'));
        $this->assertSame(self::LIST_FIELDS, array_keys($response->json('data.0')));
        $response->assertJsonPath('data.0', [
            'id' => $newer->id,
            'reference' => $newer->public_id,
            'status' => 'received',
            'name' => 'Rina Pratiwi',
            'organization' => 'Toko Sinar Jaya',
            'contact' => ['type' => 'email', 'masked' => 'r•••@e•••.com'],
            'service' => 'sistem-informasi',
            'budget' => '10-50jt',
            'timeline' => '1-3-bulan',
            'received_at' => $newer->created_at->toIso8601String(),
            'updated_at' => $newer->updated_at->toIso8601String(),
        ]);
        $response->assertJsonPath('data.1.contact', ['type' => 'phone', 'masked' => '+•••••••358']);

        $content = $response->getContent();
        foreach (['rina@example.com', '877-5964-1358', 'sistem stok', 'idempotency', $newer->idempotency_key_hash] as $hidden) {
            $this->assertStringNotContainsString($hidden, $content);
        }
    }

    public function test_the_list_filters_on_indexed_columns_and_pages_with_a_cursor(): void
    {
        $this->travelTo('2026-10-01 08:00:00');
        $october = $this->inquiry(['service' => 'website']);
        $this->travelTo('2026-10-10 08:00:00');
        $inReview = $this->inquiry(['service' => 'website']);
        $inReview->forceFill(['status' => InquiryStatus::InReview])->save();
        $this->travelTo('2026-10-18 08:00:00');
        $latest = $this->inquiry(['service' => 'custom-software']);
        $this->signInConfirmedAdmin();

        $ids = fn (string $query): array => array_column($this->adminRequest('GET', "inquiries?{$query}")->assertOk()->json('data'), 'id');

        $this->assertSame([$inReview->id], $ids('status=in-review'));
        $this->assertSame([$latest->id, $october->id], $ids('status=received'));
        $this->assertSame([$inReview->id, $october->id], $ids('service=website'));
        $this->assertSame([$inReview->id], $ids('received_from=2026-10-05&received_to=2026-10-15'));
        $this->assertSame([$latest->id], $ids('received_from=2026-10-18T08:00:00Z'));
        $this->assertSame([$october->id], $ids('reference='.$october->public_id));
        $this->assertSame([], $ids('reference=INQ-0000-0000-0000'));
        $this->assertSame([$october->id], $ids('service=website&status=received'));

        $first = $this->adminRequest('GET', 'inquiries?per_page=2&service=website')->assertOk();
        $this->assertCount(2, $first->json('data'));
        $first = $this->adminRequest('GET', 'inquiries?per_page=2')->assertOk();
        $this->assertSame([$latest->id, $inReview->id], array_column($first->json('data'), 'id'));
        $this->assertStringContainsString('per_page=2', (string) $first->json('links.next'));

        $second = $this->adminRequest('GET', 'inquiries?per_page=2&cursor='.$first->json('meta.next_cursor'))->assertOk();
        $this->assertSame([$october->id], array_column($second->json('data'), 'id'));
        $this->assertNull($second->json('meta.next_cursor'));
    }

    /**
     * Every filter of the list can use an index, so a filter never scans the table of
     * personal data. Checked on the SQL the endpoint actually runs.
     *
     * @return array<string, array{string, string}>
     */
    public static function indexedFilters(): array
    {
        return [
            'status' => ['status=in-review', 'inquiries_status_index'],
            'service' => ['service=website', 'inquiries_service_index'],
            'received from' => ['received_from=2026-10-01', 'inquiries_created_at_index'],
            'received to' => ['received_to=2026-10-01', 'inquiries_created_at_index'],
            'reference' => ['reference={reference}', 'inquiries_public_id_unique'],
        ];
    }

    #[DataProvider('indexedFilters')]
    public function test_each_list_filter_can_use_an_index(string $query, string $index): void
    {
        $inquiry = $this->inquiry();
        $this->signInConfirmedAdmin();
        $listQueries = [];
        DB::listen(function (QueryExecuted $query) use (&$listQueries): void {
            if (str_starts_with($query->sql, 'select') && str_contains($query->sql, 'from `inquiries`')) {
                $listQueries[] = $query;
            }
        });

        $this->adminRequest('GET', 'inquiries?'.str_replace('{reference}', $inquiry->public_id, $query))->assertOk();

        $this->assertCount(1, $listQueries);
        $plan = DB::select('explain '.$listQueries[0]->sql, $listQueries[0]->bindings);
        $this->assertContains($index, explode(',', (string) $plan[0]->possible_keys), "plan: {$plan[0]->possible_keys}");
    }

    /**
     * @return array<string, array{string, string}>
     */
    public static function invalidListQueries(): array
    {
        return [
            'unknown parameter' => ['sort=name', 'sort'],
            'search over personal data' => ['contact=rina@example.com', 'contact'],
            'free text' => ['q=Rina', 'q'],
            'unknown status' => ['status=approved', 'status'],
            'status label' => ['status=In%20review', 'status'],
            'unknown service' => ['service=hosting', 'service'],
            'reference in lower case' => ['reference=inq-7k3m-9qx2-hd4t', 'reference'],
            'reference with ambiguous letters' => ['reference=INQ-ILOU-0000-0000', 'reference'],
            'reversed dates' => ['received_from=2026-10-10&received_to=2026-10-01', 'received_to'],
            'not a date' => ['received_from=yesterday-ish', 'received_from'],
            'page too large' => ['per_page=101', 'per_page'],
            'tampered cursor' => ['cursor=eyJuYW1lIjoiUmluYSJ9', 'cursor'],
        ];
    }

    #[DataProvider('invalidListQueries')]
    public function test_list_parameters_are_validated(string $query, string $field): void
    {
        $this->signInConfirmedAdmin();

        $this->adminRequest('GET', "inquiries?{$query}")->assertUnprocessable()->assertJsonValidationErrors([$field]);
    }

    public function test_the_detail_shows_the_message_and_workflow_with_the_contact_masked(): void
    {
        $inquiry = $this->inquiry();
        $this->signInConfirmedAdmin();

        $response = $this->adminRequest('GET', "inquiries/{$inquiry->id}")->assertOk();

        $this->assertSame([...self::LIST_FIELDS, 'message', 'allowed_transitions', 'notes_count', 'status_changes_count'], array_keys($response->json('data')));
        $response->assertJsonPath('data.message', 'Kami butuh sistem stok untuk tiga cabang toko.')
            ->assertJsonPath('data.contact', ['type' => 'email', 'masked' => 'r•••@e•••.com'])
            ->assertJsonPath('data.allowed_transitions', ['in-review', 'contacted', 'closed'])
            ->assertJsonPath('data.notes_count', 0)
            ->assertJsonPath('data.status_changes_count', 0)
            ->assertHeader('Cache-Control', 'no-store, private');
        $this->assertStringNotContainsString('rina@example.com', $response->getContent());
    }

    public function test_a_status_change_is_stored_with_its_history_and_audit_event(): void
    {
        $inquiry = $this->inquiry();
        $admin = $this->signInConfirmedAdmin();

        $response = $this->adminRequest('PUT', "inquiries/{$inquiry->id}/status", ['status' => 'in-review', 'expected_status' => 'received'])->assertOk();

        $response->assertJsonPath('data.status', 'in-review')
            ->assertJsonPath('data.allowed_transitions', ['contacted', 'closed'])
            ->assertJsonPath('data.status_changes_count', 1)
            ->assertJsonPath('data.contact.masked', 'r•••@e•••.com');
        $this->assertSame(InquiryStatus::InReview, $inquiry->fresh()->status);

        $change = InquiryStatusChange::query()->sole();
        $this->assertSame([$inquiry->id, InquiryStatus::Received, InquiryStatus::InReview, $admin->id], [$change->inquiry_id, $change->from_status, $change->to_status, $change->changed_by_user_id]);

        $event = AdminAuditEvent::query()->where('action', AdminAuditAction::InquiryStatusChanged)->sole();
        $this->assertSame(['user', $admin->id, 'inquiry', $inquiry->id], [$event->actor_type->value, $event->actor_user_id, $event->subject_type, $event->subject_id]);
        $this->assertEquals(['from_status' => 'received', 'to_status' => 'in-review'], $event->metadata);

        $this->adminRequest('GET', "inquiries/{$inquiry->id}/status-changes")->assertOk()->assertExactJson([
            'data' => [[
                'id' => $change->id,
                'from_status' => 'received',
                'to_status' => 'in-review',
                'changed_by' => ['user_id' => $admin->id, 'name' => $admin->name],
                'changed_at' => $change->created_at->toIso8601String(),
            ]],
            'links' => ['first' => null, 'last' => null, 'prev' => null, 'next' => null],
            'meta' => ['path' => url("/api/v1/admin/inquiries/{$inquiry->id}/status-changes"), 'per_page' => 25, 'next_cursor' => null, 'prev_cursor' => null],
        ]);
    }

    public function test_the_whole_workflow_can_be_walked_and_reopened(): void
    {
        $inquiry = $this->inquiry();
        $this->signInConfirmedAdmin();

        foreach ([['received', 'in-review'], ['in-review', 'contacted'], ['contacted', 'closed'], ['closed', 'in-review'], ['in-review', 'closed']] as [$from, $to]) {
            $this->adminRequest('PUT', "inquiries/{$inquiry->id}/status", ['status' => $to, 'expected_status' => $from])->assertOk()->assertJsonPath('data.status', $to);
        }

        $this->assertSame(5, InquiryStatusChange::query()->count());
        $this->assertSame(5, AdminAuditEvent::query()->where('action', AdminAuditAction::InquiryStatusChanged)->count());
        $history = $this->adminRequest('GET', "inquiries/{$inquiry->id}/status-changes?per_page=2")->assertOk();
        $this->assertSame([['in-review', 'closed'], ['closed', 'in-review']], array_map(fn (array $row): array => [$row['from_status'], $row['to_status']], $history->json('data')));
    }

    public function test_asking_for_the_current_status_changes_nothing(): void
    {
        $inquiry = $this->inquiry();
        $this->signInConfirmedAdmin();
        $this->adminRequest('PUT', "inquiries/{$inquiry->id}/status", ['status' => 'contacted', 'expected_status' => 'received'])->assertOk();

        // A retry of the same change, after an uncertain outcome, is harmless.
        $this->adminRequest('PUT', "inquiries/{$inquiry->id}/status", ['status' => 'contacted', 'expected_status' => 'received'])
            ->assertOk()
            ->assertJsonPath('data.status', 'contacted')
            ->assertJsonPath('data.status_changes_count', 1);

        $this->assertSame(1, InquiryStatusChange::query()->count());
        $this->assertSame(1, AdminAuditEvent::query()->where('action', AdminAuditAction::InquiryStatusChanged)->count());
    }

    public function test_a_change_based_on_a_stale_status_is_refused(): void
    {
        $inquiry = $this->inquiry();
        $this->signInConfirmedAdmin();
        $this->adminRequest('PUT', "inquiries/{$inquiry->id}/status", ['status' => 'in-review', 'expected_status' => 'received'])->assertOk();

        $this->adminRequest('PUT', "inquiries/{$inquiry->id}/status", ['status' => 'closed', 'expected_status' => 'received'])
            ->assertConflict()
            ->assertExactJson(['message' => 'The inquiry status has changed since it was read. Read it again before changing it.', 'code' => 'status_changed']);

        $this->assertSame(InquiryStatus::InReview, $inquiry->fresh()->status);
        $this->assertSame(1, InquiryStatusChange::query()->count());
    }

    public function test_a_change_outside_the_workflow_is_refused(): void
    {
        $inquiry = $this->inquiry();
        $this->signInConfirmedAdmin();
        $this->adminRequest('PUT', "inquiries/{$inquiry->id}/status", ['status' => 'closed', 'expected_status' => 'received'])->assertOk();

        foreach (['contacted', 'received'] as $target) {
            $this->adminRequest('PUT', "inquiries/{$inquiry->id}/status", ['status' => $target, 'expected_status' => 'closed'])
                ->assertConflict()
                ->assertExactJson(['message' => 'The inquiry cannot move from its current status to the requested one.', 'code' => 'transition_not_allowed']);
        }

        $this->assertSame(InquiryStatus::Closed, $inquiry->fresh()->status);
        $this->assertSame(1, InquiryStatusChange::query()->count());
    }

    /**
     * @return array<string, array{array<string, mixed>, list<string>}>
     */
    public static function invalidStatusChanges(): array
    {
        return [
            'empty' => [[], ['status', 'expected_status']],
            'without the status that was read' => [['status' => 'closed'], ['expected_status']],
            'unknown status' => [['status' => 'approved', 'expected_status' => 'received'], ['status']],
            'label instead of value' => [['status' => 'In review', 'expected_status' => 'received'], ['status']],
            'not a string' => [['status' => ['closed'], 'expected_status' => 'received'], ['status']],
        ];
    }

    /**
     * @param  array<string, mixed>  $data
     * @param  list<string>  $fields
     */
    #[DataProvider('invalidStatusChanges')]
    public function test_status_changes_are_validated(array $data, array $fields): void
    {
        $inquiry = $this->inquiry();
        $this->signInConfirmedAdmin();

        $this->adminRequest('PUT', "inquiries/{$inquiry->id}/status", $data)->assertUnprocessable()->assertJsonValidationErrors($fields);

        $this->assertNothingWritten($inquiry);
    }

    public function test_writes_cannot_touch_the_submission_or_forge_their_author(): void
    {
        $inquiry = $this->inquiry();
        $before = $inquiry->getRawOriginal();
        $admin = $this->signInConfirmedAdmin();
        $other = $this->createActiveAdmin(AdminRole::Owner);
        $forged = [
            'name' => 'Changed', 'contact' => 'attacker@example.com', 'message' => 'Changed message that is long enough.',
            'public_id' => 'INQ-AAAA-BBBB-CCCC', 'idempotency_key_hash' => null, 'created_at' => '2020-01-01T00:00:00Z',
            'inquiry_id' => 999, 'author_user_id' => $other->id, 'changed_by_user_id' => $other->id, 'from_status' => 'closed',
        ];

        $this->adminRequest('PUT', "inquiries/{$inquiry->id}/status", ['status' => 'in-review', 'expected_status' => 'received', ...$forged])->assertOk();
        $this->adminRequest('POST', "inquiries/{$inquiry->id}/notes", ['body' => 'Called back.', ...$forged])->assertCreated()->assertJsonPath('data.author.user_id', $admin->id);

        $after = $inquiry->fresh()->getRawOriginal();
        foreach (Inquiry::IMMUTABLE_COLUMNS as $column) {
            $this->assertSame($before[$column], $after[$column], $column);
        }
        $this->assertSame([$inquiry->id, $admin->id, 'received'], [InquiryStatusChange::query()->sole()->inquiry_id, InquiryStatusChange::query()->sole()->changed_by_user_id, InquiryStatusChange::query()->sole()->from_status->value]);
        $this->assertSame([$inquiry->id, $admin->id], [InquiryNote::query()->sole()->inquiry_id, InquiryNote::query()->sole()->author_user_id]);
        $this->assertSame(0, AdminAuditEvent::query()->where('actor_user_id', $other->id)->count());
    }

    public function test_a_note_is_stored_with_an_audit_event_that_holds_only_its_id(): void
    {
        $inquiry = $this->inquiry();
        $admin = $this->signInConfirmedAdmin();

        $response = $this->adminRequest('POST', "inquiries/{$inquiry->id}/notes", ['body' => '  Rina prefers a call after 4 pm.  '])->assertCreated();

        $note = InquiryNote::query()->sole();
        $response->assertExactJson(['data' => [
            'id' => $note->id,
            'body' => 'Rina prefers a call after 4 pm.',
            'author' => ['user_id' => $admin->id, 'name' => $admin->name],
            'created_at' => $note->created_at->toIso8601String(),
        ]]);

        $event = AdminAuditEvent::query()->where('action', AdminAuditAction::InquiryNoteAdded)->sole();
        $this->assertSame(['user', $admin->id, 'inquiry', $inquiry->id, ['note_id' => $note->id]], [$event->actor_type->value, $event->actor_user_id, $event->subject_type, $event->subject_id, $event->metadata]);
        $this->assertStringNotContainsString('4 pm', (string) json_encode($event->getAttributes()));

        $this->adminRequest('GET', "inquiries/{$inquiry->id}")->assertOk()->assertJsonPath('data.notes_count', 1);
    }

    public function test_notes_are_listed_newest_first_page_by_page_with_their_authors(): void
    {
        $inquiry = $this->inquiry();
        $first = $this->signInConfirmedAdmin();
        $this->adminRequest('POST', "inquiries/{$inquiry->id}/notes", ['body' => 'First note.'])->assertCreated();
        $second = $this->usingAdminClient('owner')->signInConfirmedOwner();
        $this->adminRequest('POST', "inquiries/{$inquiry->id}/notes", ['body' => 'Second note.'])->assertCreated();
        $this->adminRequest('POST', "inquiries/{$this->inquiry()->id}/notes", ['body' => 'Another inquiry.'])->assertCreated();

        $page = $this->usingAdminClient('browser')->adminRequest('GET', "inquiries/{$inquiry->id}/notes?per_page=1")->assertOk();
        $this->assertSame(['Second note.'], array_column($page->json('data'), 'body'));
        $page->assertJsonPath('data.0.author', ['user_id' => $second->id, 'name' => $second->name]);

        $next = $this->adminRequest('GET', "inquiries/{$inquiry->id}/notes?per_page=1&cursor=".$page->json('meta.next_cursor'))->assertOk();
        $this->assertSame(['First note.'], array_column($next->json('data'), 'body'));
        $next->assertJsonPath('data.0.author', ['user_id' => $first->id, 'name' => $first->name]);
        $this->assertStringNotContainsString($first->email, $page->getContent().$next->getContent());
    }

    /**
     * @return array<string, array{mixed, string}>
     */
    public static function invalidNotes(): array
    {
        return [
            'missing' => [null, 'The body field is required.'],
            'spaces only' => ['     ', 'The body field is required.'],
            'too long' => [str_repeat('a', 2001), 'The body field must not be greater than 2000 characters.'],
            'not a string' => [['a note'], 'The body field must be a string.'],
        ];
    }

    #[DataProvider('invalidNotes')]
    public function test_notes_are_validated(mixed $body, string $message): void
    {
        $inquiry = $this->inquiry();
        $this->signInConfirmedAdmin();

        $this->adminRequest('POST', "inquiries/{$inquiry->id}/notes", $body === null ? [] : ['body' => $body])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['body' => $message]);

        $this->assertNothingWritten($inquiry);
    }

    public function test_a_note_of_the_maximum_length_in_any_script_is_stored_unchanged(): void
    {
        $inquiry = $this->inquiry();
        $this->signInConfirmedAdmin();
        $body = str_repeat('😀', 1000).str_repeat('ā', 1000);

        $this->adminRequest('POST', "inquiries/{$inquiry->id}/notes", ['body' => $body])->assertCreated();

        $this->assertSame($body, InquiryNote::query()->sole()->body);
    }

    public function test_a_note_the_database_refuses_is_reported_without_its_body(): void
    {
        Exceptions::fake();
        $inquiry = $this->inquiry();
        $this->signInConfirmedAdmin();
        InquiryNote::creating(function (InquiryNote $note): void {
            // Over the 65,535 bytes of a TEXT column: strict mode refuses the row.
            $note->body .= str_repeat('x', 70000);
        });

        $this->adminRequest('POST', "inquiries/{$inquiry->id}/notes", ['body' => 'Rina prefers a call after 4 pm.'])
            ->assertServiceUnavailable()
            ->assertExactJson(['message' => 'The note could not be saved. Read the notes again before retrying.']);

        $this->assertSame(0, InquiryNote::query()->count());
        $this->assertSame(0, AdminAuditEvent::query()->where('action', AdminAuditAction::InquiryNoteAdded)->count());
        Exceptions::assertReported(function (InquiryNoteNotStoredException $exception): bool {
            $reported = $exception->getMessage().json_encode($exception->context());

            return $exception->getPrevious() === null
                && $exception->context() === ['sqlstate' => '22001']
                && ! str_contains($reported, '4 pm');
        });
    }

    /**
     * @return array<string, array{string, string, array<string, mixed>, AdminAuditAction}>
     */
    public static function auditedWrites(): array
    {
        return [
            'status change' => ['PUT', 'status', ['status' => 'closed', 'expected_status' => 'received'], AdminAuditAction::InquiryStatusChanged],
            'new note' => ['POST', 'notes', ['body' => 'Called back.'], AdminAuditAction::InquiryNoteAdded],
        ];
    }

    /**
     * @param  array<string, mixed>  $data
     */
    #[DataProvider('auditedWrites')]
    public function test_a_failed_audit_write_undoes_the_change(string $method, string $path, array $data, AdminAuditAction $action): void
    {
        $inquiry = $this->inquiry();
        $this->signInConfirmedAdmin();
        $this->failAuditWritesFor($action);

        $this->adminRequest($method, "inquiries/{$inquiry->id}/{$path}", $data)
            ->assertStatus(500)
            ->assertExactJson(['message' => 'Server Error']);

        $this->assertNothingWritten($inquiry);
    }

    public function test_workflow_writes_are_rate_limited_per_account(): void
    {
        $inquiry = $this->inquiry();
        $this->signInConfirmedAdmin();

        for ($attempt = 1; $attempt <= 60; $attempt++) {
            $this->adminRequest('PUT', "inquiries/{$inquiry->id}/status", ['status' => 'received', 'expected_status' => 'received'])->assertOk();
        }

        $this->adminRequest('POST', "inquiries/{$inquiry->id}/notes", ['body' => 'One too many.'])->assertTooManyRequests()->assertHeader('Retry-After');
        $this->adminRequest('GET', "inquiries/{$inquiry->id}")->assertOk();
        $this->usingAdminClient('owner')->signInConfirmedOwner();
        $this->adminRequest('POST', "inquiries/{$inquiry->id}/notes", ['body' => 'Another account is not limited.'])->assertCreated();
    }

    /**
     * The route authorized the request, then the account was suspended before the write ran
     * (like a request in flight while an owner acts). Each operation checks the account again
     * under a lock inside its transaction and refuses.
     */
    public function test_an_account_suspended_after_authorization_cannot_write(): void
    {
        $inquiry = $this->inquiry();
        $admin = $this->createActiveAdmin();
        $authorized = User::query()->findOrFail($admin->id);
        $admin->forceFill(['suspended_at' => now()])->save();

        $operations = [
            'status change' => fn () => app(ChangeInquiryStatus::class)->handle($authorized, $inquiry, InquiryStatus::Closed, InquiryStatus::Received),
            'new note' => fn () => app(AddInquiryNote::class)->handle($authorized, $inquiry, 'Late note.'),
            'contact reveal' => fn () => app(RevealInquiryContact::class)->handle($authorized, $inquiry),
        ];

        foreach ($operations as $name => $operation) {
            try {
                $operation();
                $this->fail("{$name} ran for a suspended account.");
            } catch (AuthorizationException) {
                $this->addToAssertionCount(1);
            }
        }

        $this->assertNothingWritten($inquiry);
    }

    public function test_an_admin_holds_the_inquiry_permissions_but_no_owner_permission(): void
    {
        $this->signInConfirmedAdmin();

        $this->adminRequest('GET', 'me')->assertOk()->assertJsonPath('data.permissions', self::ADMIN_PERMISSIONS);
        $this->adminRequest('GET', 'audit-events')->assertForbidden();
        $this->adminRequest('GET', 'users')->assertForbidden();
    }

    /**
     * An admin, signed in with a fresh password confirmation, in the current client.
     */
    private function signInConfirmedAdmin(): User
    {
        $admin = $this->createActiveAdmin();
        $this->signIn($admin);
        $this->confirmAdminPassword();

        return $admin;
    }

    /**
     * @param  array<string, mixed>  $overrides
     */
    private function inquiry(array $overrides = []): Inquiry
    {
        return Inquiry::factory()->create([
            'name' => 'Rina Pratiwi',
            'organization' => 'Toko Sinar Jaya',
            'contact' => 'rina@example.com',
            'service' => 'sistem-informasi',
            'budget' => '10-50jt',
            'timeline' => '1-3-bulan',
            'message' => 'Kami butuh sistem stok untuk tiga cabang toko.',
            'idempotency_key_hash' => Inquiry::hashIdempotencyKey(fake()->uuid()),
            ...$overrides,
        ])->fresh();
    }

    private function assertNothingWritten(Inquiry $inquiry): void
    {
        $this->assertSame(InquiryStatus::Received, $inquiry->fresh()->status);
        $this->assertSame(0, InquiryStatusChange::query()->count());
        $this->assertSame(0, InquiryNote::query()->count());
        $this->assertSame(0, AdminAuditEvent::query()->where('action', 'like', 'inquiry.%')->count());
    }
}
