<?php

namespace Tests\Feature\Models;

use App\Enums\InquiryStatus;
use App\Models\Inquiry;
use App\Models\InquiryNote;
use App\Models\InquiryStatusChange;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use LogicException;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * What B4a guarantees in the database itself, for every database user: the submitted
 * fields of an inquiry never change, status history and notes are append-only, and
 * deleting an inquiry (retention, once decided) removes everything written about it.
 */
class InquiryRecordsTest extends TestCase
{
    use RefreshDatabase;

    /**
     * @return array<string, array{string, string}>
     */
    public static function submittedColumns(): array
    {
        return [
            'name' => ['name', 'Someone Else'],
            'name, letter case only' => ['name', 'RINA PRATIWI'],
            'organization' => ['organization', 'Other Org'],
            'organization emptied' => ['organization', ''],
            'contact' => ['contact', 'other@example.com'],
            'service' => ['service', 'website'],
            'budget' => ['budget', 'di-atas-150jt'],
            'timeline' => ['timeline', 'segera'],
            'message' => ['message', 'A different message that is long enough.'],
            'public reference' => ['public_id', 'INQ-AAAA-BBBB-CCCC'],
            'idempotency key hash' => ['idempotency_key_hash', str_repeat('a', 64)],
            'received at' => ['created_at', '2020-01-01 00:00:00'],
        ];
    }

    #[DataProvider('submittedColumns')]
    public function test_mysql_refuses_to_change_a_submitted_column_even_without_the_model(string $column, string $value): void
    {
        $inquiry = $this->storedInquiry();

        try {
            DB::table('inquiries')->where('id', $inquiry->id)->update([$column => $value]);
            $this->fail("The database accepted a change to {$column}.");
        } catch (QueryException $exception) {
            $this->assertSame('45000', $exception->errorInfo[0]);
            $this->assertStringContainsString('inquiries keep the submitted fields unchanged', $exception->getMessage());
        }

        $this->assertSame($inquiry->getRawOriginal(), Inquiry::query()->find($inquiry->id)->getRawOriginal());
    }

    #[DataProvider('submittedColumns')]
    public function test_the_model_refuses_to_change_a_submitted_column(string $column, string $value): void
    {
        $inquiry = $this->storedInquiry();
        $inquiry->forceFill([$column => $value]);

        $this->expectException(LogicException::class);

        $inquiry->save();
    }

    public function test_the_workflow_status_may_change(): void
    {
        $inquiry = $this->storedInquiry();

        DB::table('inquiries')->where('id', $inquiry->id)->update(['status' => InquiryStatus::Contacted->value, 'updated_at' => now()]);

        $this->assertSame(InquiryStatus::Contacted, $inquiry->fresh()->status);
    }

    public function test_the_contact_is_never_serialized(): void
    {
        $inquiry = $this->storedInquiry();

        $this->assertArrayNotHasKey('contact', $inquiry->toArray());
        $this->assertStringNotContainsString('rina@example.com', $inquiry->toJson());
    }

    /**
     * @return array<string, array{string}>
     */
    public static function appendOnlyTables(): array
    {
        return ['status history' => ['inquiry_status_changes'], 'notes' => ['inquiry_notes']];
    }

    #[DataProvider('appendOnlyTables')]
    public function test_mysql_refuses_to_change_or_delete_history_and_notes(string $table): void
    {
        $this->recordsFor($this->storedInquiry());
        $id = DB::table($table)->value('id');

        $attempts = [
            'update' => fn () => DB::table($table)->where('id', $id)->update(['created_at' => now()->subDay()]),
            'delete' => fn () => DB::table($table)->where('id', $id)->delete(),
        ];

        foreach ($attempts as $name => $attempt) {
            try {
                $attempt();
                $this->fail("The database accepted an {$name} of {$table}.");
            } catch (QueryException $exception) {
                $this->assertStringContainsString("{$table} is append-only", $exception->getMessage());
            }
        }

        $this->assertSame(1, DB::table($table)->count());
    }

    public function test_the_models_refuse_to_change_or_delete_history_and_notes(): void
    {
        [$change, $note] = $this->recordsFor($this->storedInquiry());

        $attempts = [
            'change history' => fn () => $change->forceFill(['to_status' => InquiryStatus::Closed])->save(),
            'delete history' => fn () => $change->delete(),
            'change note' => fn () => $note->forceFill(['body' => 'Rewritten.'])->save(),
            'delete note' => fn () => $note->delete(),
        ];

        foreach ($attempts as $name => $attempt) {
            try {
                $attempt();
                $this->fail("The model allowed: {$name}.");
            } catch (LogicException) {
                $this->addToAssertionCount(1);
            }
        }

        $this->assertSame(InquiryStatus::InReview, InquiryStatusChange::query()->sole()->to_status);
        $this->assertSame('Called back, waiting for the brief.', InquiryNote::query()->sole()->body);
    }

    public function test_deleting_an_inquiry_removes_its_history_and_notes(): void
    {
        $kept = $this->storedInquiry();
        $this->recordsFor($kept);
        $removed = $this->storedInquiry();
        $this->recordsFor($removed);

        // Foreign key actions do not fire the append-only triggers.
        DB::table('inquiries')->where('id', $removed->id)->delete();

        $this->assertSame(0, InquiryStatusChange::query()->where('inquiry_id', $removed->id)->count());
        $this->assertSame(0, InquiryNote::query()->where('inquiry_id', $removed->id)->count());
        $this->assertSame(1, InquiryStatusChange::query()->where('inquiry_id', $kept->id)->count());
        $this->assertSame(1, InquiryNote::query()->where('inquiry_id', $kept->id)->count());
    }

    public function test_an_account_that_wrote_history_or_notes_cannot_be_deleted(): void
    {
        $this->recordsFor($this->storedInquiry());

        $this->expectException(QueryException::class);

        DB::table('users')->delete();
    }

    private function storedInquiry(): Inquiry
    {
        return Inquiry::factory()->create([
            'name' => 'Rina Pratiwi',
            'organization' => 'Toko Sinar Jaya',
            'contact' => 'rina@example.com',
            'service' => 'sistem-informasi',
            'budget' => '10-50jt',
            'timeline' => '1-3-bulan',
            'idempotency_key_hash' => Inquiry::hashIdempotencyKey(fake()->uuid()),
        ])->fresh();
    }

    /**
     * @return array{InquiryStatusChange, InquiryNote}
     */
    private function recordsFor(Inquiry $inquiry): array
    {
        $author = User::factory()->activeAdmin()->create();

        $change = new InquiryStatusChange;
        $change->forceFill(['inquiry_id' => $inquiry->id, 'from_status' => InquiryStatus::Received, 'to_status' => InquiryStatus::InReview, 'changed_by_user_id' => $author->id])->save();

        $note = new InquiryNote;
        $note->forceFill(['inquiry_id' => $inquiry->id, 'author_user_id' => $author->id, 'body' => 'Called back, waiting for the brief.'])->save();

        return [$change, $note];
    }
}
