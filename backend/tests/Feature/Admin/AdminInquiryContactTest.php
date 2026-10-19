<?php

namespace Tests\Feature\Admin;

use App\Enums\AdminAuditAction;
use App\Enums\InquiryStatus;
use App\Models\AdminAuditEvent;
use App\Models\Inquiry;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Log\Events\MessageLogged;
use Illuminate\Support\Facades\Event;
use Tests\Support\InteractsWithAdminApi;
use Tests\TestCase;

/**
 * Contact masking and the recorded reveal (B4a), and what never leaves the server: full
 * contacts outside the reveal, personal data in audit rows or logs, and any change to the
 * public receipt of POST /api/v1/inquiries. Contract: docs/api/admin-inquiries.md.
 */
class AdminInquiryContactTest extends TestCase
{
    use InteractsWithAdminApi;
    use RefreshDatabase;

    private const ACKNOWLEDGED = ['acknowledge_personal_data' => true];

    /**
     * Error bodies are asserted as production returns them (APP_DEBUG=false, required
     * outside local development); CI runs the suite with APP_DEBUG=true.
     */
    protected function setUp(): void
    {
        parent::setUp();

        config(['app.debug' => false]);
    }

    public function test_a_reveal_returns_the_full_contact_only_after_recording_it(): void
    {
        $inquiry = $this->inquiry();
        $admin = $this->signInConfirmedAdmin();

        $response = $this->adminRequest('POST', "inquiries/{$inquiry->id}/contact-reveal", self::ACKNOWLEDGED)->assertOk();

        $event = AdminAuditEvent::query()->where('action', AdminAuditAction::InquiryContactRevealed)->sole();
        $response->assertExactJson(['data' => [
            'id' => $inquiry->id,
            'reference' => $inquiry->public_id,
            'contact' => ['type' => 'email', 'value' => 'rina@example.com'],
            'revealed_at' => $event->occurred_at->format('Y-m-d\TH:i:s.uP'),
        ]])->assertHeader('Cache-Control', 'no-store, private');

        $this->assertSame(['user', $admin->id, 'inquiry', $inquiry->id, null], [$event->actor_type->value, $event->actor_user_id, $event->subject_type, $event->subject_id, $event->metadata]);
        $this->assertNoPersonalDataIn((string) json_encode($event->getAttributes()));
    }

    public function test_every_reveal_is_recorded_separately(): void
    {
        $inquiry = $this->inquiry(['contact' => '+62 877-5964-1358']);
        $this->signInConfirmedAdmin();

        $this->adminRequest('POST', "inquiries/{$inquiry->id}/contact-reveal", self::ACKNOWLEDGED)->assertOk()->assertJsonPath('data.contact', ['type' => 'phone', 'value' => '+62 877-5964-1358']);
        $this->adminRequest('POST', "inquiries/{$inquiry->id}/contact-reveal", self::ACKNOWLEDGED)->assertOk();
        $this->usingAdminClient('owner')->signInConfirmedOwner();
        $this->adminRequest('POST', "inquiries/{$inquiry->id}/contact-reveal", self::ACKNOWLEDGED)->assertOk();

        $this->assertSame(3, AdminAuditEvent::query()->where('action', AdminAuditAction::InquiryContactRevealed)->where('subject_id', $inquiry->id)->count());
    }

    public function test_a_reveal_needs_a_password_confirmation_from_the_last_15_minutes(): void
    {
        $inquiry = $this->inquiry();
        $this->signIn($this->createActiveAdmin());

        $this->adminRequest('POST', "inquiries/{$inquiry->id}/contact-reveal", self::ACKNOWLEDGED)
            ->assertStatus(423)
            ->assertJsonPath('message', 'Password confirmation required.');

        $this->confirmAdminPassword();
        $this->travel(14)->minutes();
        $this->adminRequest('POST', "inquiries/{$inquiry->id}/contact-reveal", self::ACKNOWLEDGED)->assertOk();

        $this->travel(2)->minutes();
        $response = $this->adminRequest('POST', "inquiries/{$inquiry->id}/contact-reveal", self::ACKNOWLEDGED)->assertStatus(423);
        $this->assertStringNotContainsString('rina@example.com', $response->getContent());
        $this->assertSame(1, AdminAuditEvent::query()->where('action', AdminAuditAction::InquiryContactRevealed)->count());
    }

    public function test_a_reveal_must_be_acknowledged_explicitly(): void
    {
        $inquiry = $this->inquiry();
        $this->signInConfirmedAdmin();

        foreach ([[], ['acknowledge_personal_data' => false], ['acknowledge_personal_data' => 'no']] as $data) {
            $response = $this->adminRequest('POST', "inquiries/{$inquiry->id}/contact-reveal", $data)
                ->assertUnprocessable()
                ->assertJsonValidationErrors(['acknowledge_personal_data' => 'Confirm that opening the full contact is recorded in the audit log.']);
            $this->assertStringNotContainsString('rina@example.com', $response->getContent());
        }

        $this->assertSame(0, AdminAuditEvent::query()->where('action', AdminAuditAction::InquiryContactRevealed)->count());
    }

    public function test_a_reveal_is_a_write_and_cannot_be_made_by_a_get_or_without_csrf(): void
    {
        $inquiry = $this->inquiry();
        $this->signInConfirmedAdmin();

        $this->adminRequest('GET', "inquiries/{$inquiry->id}/contact-reveal")->assertMethodNotAllowed();
        $this->adminRequest('GET', "inquiries/{$inquiry->id}/contact")->assertNotFound();
        $this->adminRequest('POST', "inquiries/{$inquiry->id}/contact-reveal", self::ACKNOWLEDGED, sendXsrf: false)->assertStatus(419);
        $this->adminRequest('POST', "inquiries/{$inquiry->id}/contact-reveal", self::ACKNOWLEDGED, headers: ['Origin' => 'https://evil.example'])->assertForbidden();

        $this->assertSame(0, AdminAuditEvent::query()->where('action', AdminAuditAction::InquiryContactRevealed)->count());
    }

    public function test_without_a_recorded_event_the_contact_is_not_shown(): void
    {
        $inquiry = $this->inquiry();
        $this->signInConfirmedAdmin();
        $this->failAuditWritesFor(AdminAuditAction::InquiryContactRevealed);

        $response = $this->adminRequest('POST', "inquiries/{$inquiry->id}/contact-reveal", self::ACKNOWLEDGED)
            ->assertStatus(500)
            ->assertExactJson(['message' => 'Server Error']);

        $this->assertStringNotContainsString('rina@example.com', $response->getContent());
        $this->assertSame(0, AdminAuditEvent::query()->where('action', AdminAuditAction::InquiryContactRevealed)->count());
    }

    public function test_reveals_are_limited_per_minute_and_per_hour(): void
    {
        $inquiry = $this->inquiry();
        $this->signInConfirmedAdmin();

        for ($round = 1; $round <= 6; $round++) {
            for ($attempt = 1; $attempt <= 10; $attempt++) {
                $this->adminRequest('POST', "inquiries/{$inquiry->id}/contact-reveal", self::ACKNOWLEDGED)->assertOk();
            }

            $this->adminRequest('POST', "inquiries/{$inquiry->id}/contact-reveal", self::ACKNOWLEDGED)->assertTooManyRequests()->assertHeader('Retry-After');
            $this->travel(61)->seconds();
            $this->confirmAdminPassword();
        }

        // 60 reveals in this hour: the hourly limit holds even though a minute has passed.
        $response = $this->adminRequest('POST', "inquiries/{$inquiry->id}/contact-reveal", self::ACKNOWLEDGED)->assertTooManyRequests();
        $this->assertStringNotContainsString('rina@example.com', $response->getContent());
        $this->assertSame(60, AdminAuditEvent::query()->where('action', AdminAuditAction::InquiryContactRevealed)->count());
        $this->adminRequest('GET', "inquiries/{$inquiry->id}")->assertOk();
    }

    /**
     * Every read and write of the module, by both roles: the full contact appears only in
     * the reveal response, and no log line or audit row carries a name, contact, message,
     * or note.
     */
    public function test_personal_data_stays_out_of_responses_logs_and_audit_rows(): void
    {
        $logged = [];
        Event::listen(MessageLogged::class, function (MessageLogged $message) use (&$logged): void {
            $logged[] = $message->message.' '.json_encode($message->context);
        });
        $inquiry = $this->inquiry();
        $id = $inquiry->id;
        $this->usingAdminClient('owner')->signInConfirmedOwner();
        $this->usingAdminClient('admin')->signInConfirmedAdmin();

        $responses = [];
        foreach (['admin', 'owner'] as $client) {
            $this->usingAdminClient($client);
            $responses[] = $this->adminRequest('GET', 'inquiries')->assertOk();
            $responses[] = $this->adminRequest('GET', "inquiries/{$id}")->assertOk();
            $responses[] = $this->adminRequest('GET', "inquiries/{$id}/status-changes")->assertOk();
            $responses[] = $this->adminRequest('GET', "inquiries/{$id}/notes")->assertOk();
        }
        $this->usingAdminClient('admin');
        $responses[] = $this->adminRequest('PUT', "inquiries/{$id}/status", ['status' => 'contacted', 'expected_status' => 'received'])->assertOk();
        $responses[] = $this->adminRequest('POST', "inquiries/{$id}/notes", ['body' => 'Spoke with Rina at rina@example.com about the stock system.'])->assertCreated();
        $revealed = $this->adminRequest('POST', "inquiries/{$id}/contact-reveal", self::ACKNOWLEDGED)->assertOk();
        $this->usingAdminClient('owner');
        $audit = $this->adminRequest('GET', "audit-events?subject_inquiry_id={$id}")->assertOk();

        foreach ($responses as $response) {
            $this->assertStringNotContainsString('rina@example.com', str_replace('rina@example.com about', '', $response->getContent()));
        }
        $this->assertSame('rina@example.com', $revealed->json('data.contact.value'));

        $this->assertSame(
            [AdminAuditAction::InquiryContactRevealed->value, AdminAuditAction::InquiryNoteAdded->value, AdminAuditAction::InquiryStatusChanged->value],
            array_column($audit->json('data'), 'action'),
        );
        $this->assertNoPersonalDataIn($audit->getContent());
        $this->assertNoPersonalDataIn((string) json_encode(AdminAuditEvent::query()->get()->map->getAttributes()));
        $this->assertNoPersonalDataIn(implode("\n", $logged));
    }

    public function test_the_audit_reader_filters_by_inquiry(): void
    {
        $first = $this->inquiry();
        $second = $this->inquiry();
        $this->usingAdminClient('admin')->signInConfirmedAdmin();
        $this->adminRequest('POST', "inquiries/{$first->id}/notes", ['body' => 'First.'])->assertCreated();
        $this->adminRequest('POST', "inquiries/{$second->id}/notes", ['body' => 'Second.'])->assertCreated();
        $owner = $this->usingAdminClient('owner')->signInConfirmedOwner();

        $events = $this->adminRequest('GET', "audit-events?subject_inquiry_id={$second->id}")->assertOk()->json('data');

        $this->assertCount(1, $events);
        $this->assertSame(['type' => 'inquiry', 'id' => $second->id], $events[0]['subject']);
        $this->adminRequest('GET', "audit-events?subject_inquiry_id={$second->id}&subject_user_id={$owner->id}")
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['subject_inquiry_id']);
    }

    /**
     * The workflow status is internal. A retry of the original submission, after the team
     * moved and annotated the inquiry, still gets the original receipt (B2.1), which the
     * website reads as a success (B2.2).
     */
    public function test_the_public_receipt_is_unchanged_by_the_workflow(): void
    {
        $key = '3f2b8c1e-9d4a-4b7e-8c21-5a6f0e9d1b42';
        $payload = [
            'name' => 'Rina Pratiwi',
            'organization' => 'Toko Sinar Jaya',
            'contact' => 'rina@example.com',
            'service' => 'sistem-informasi',
            'budget' => '10-50jt',
            'timeline' => '1-3-bulan',
            'message' => 'Kami butuh sistem stok untuk tiga cabang toko.',
        ];
        $original = $this->postJson('/api/v1/inquiries', $payload, ['Idempotency-Key' => $key])->assertCreated()->json();
        $inquiry = Inquiry::query()->sole();

        $this->signInConfirmedAdmin();
        $this->adminRequest('PUT', "inquiries/{$inquiry->id}/status", ['status' => 'closed', 'expected_status' => 'received'])->assertOk();
        $this->adminRequest('POST', "inquiries/{$inquiry->id}/notes", ['body' => 'Answered by phone.'])->assertCreated();

        $this->postJson('/api/v1/inquiries', $payload, ['Idempotency-Key' => $key])
            ->assertCreated()
            ->assertExactJson($original)
            ->assertExactJson(['id' => $inquiry->public_id, 'status' => 'received'])
            ->assertHeader('Idempotent-Replayed', 'true')
            ->assertCookieMissing('XSRF-TOKEN');
        $this->postJson('/api/v1/inquiries', [...$payload, 'message' => 'Kami butuh sistem stok untuk empat cabang toko.'], ['Idempotency-Key' => $key])->assertConflict();

        $this->assertSame(InquiryStatus::Closed, $inquiry->fresh()->status);
        $this->assertSame(1, Inquiry::query()->count());
    }

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
            'message' => 'Kami butuh sistem stok untuk tiga cabang toko.',
            ...$overrides,
        ])->fresh();
    }

    private function assertNoPersonalDataIn(string $content): void
    {
        foreach (['rina@example.com', 'Rina', 'Toko Sinar Jaya', 'sistem stok', 'stock system', '877-5964'] as $personal) {
            $this->assertStringNotContainsString($personal, $content);
        }
    }
}
