<?php

namespace Tests\Feature\Actions;

use App\Actions\SubmitInquiry;
use App\Exceptions\InquiryNotStoredException;
use App\Models\Inquiry;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Arr;
use Tests\TestCase;

class SubmitInquiryTest extends TestCase
{
    use RefreshDatabase;

    private const TAKEN_REFERENCE = 'INQ-AAAA-BBBB-CCCC';

    private int $attempts = 0;

    /**
     * Validated attributes as the controller passes them.
     *
     * @return array<string, mixed>
     */
    private function attributes(): array
    {
        return Arr::only(Inquiry::factory()->raw(), ['name', 'organization', 'contact', 'service', 'budget', 'timeline', 'message']);
    }

    /**
     * Give the next `$collisions` inserts a reference that is already stored, so the
     * database's unique index (not a mock) reports the collision.
     */
    private function collideOnTheNextAttempts(int $collisions): void
    {
        Inquiry::factory()->create(['public_id' => self::TAKEN_REFERENCE]);

        Inquiry::creating(function (Inquiry $inquiry) use ($collisions): void {
            if (++$this->attempts <= $collisions) {
                $inquiry->public_id = self::TAKEN_REFERENCE;
            }
        });
    }

    public function test_a_public_reference_collision_is_retried_with_a_fresh_reference(): void
    {
        $this->collideOnTheNextAttempts(2);

        $inquiry = app(SubmitInquiry::class)->handle($this->attributes());

        $this->assertTrue($inquiry->exists);
        $this->assertNotSame(self::TAKEN_REFERENCE, $inquiry->public_id);
        $this->assertSame(3, $this->attempts);
        $this->assertDatabaseCount('inquiries', 2);
    }

    public function test_storage_gives_up_after_three_collisions_without_storing_a_row(): void
    {
        $this->collideOnTheNextAttempts(3);

        try {
            app(SubmitInquiry::class)->handle($this->attributes());
            $this->fail('Expected the inquiry not to be stored.');
        } catch (InquiryNotStoredException $exception) {
            $this->assertSame(['sqlstate' => '23000'], $exception->context());
            $this->assertNull($exception->getPrevious());
        }

        $this->assertSame(3, $this->attempts);
        $this->assertDatabaseCount('inquiries', 1);
    }

    /**
     * A public reference collision must not be mistaken for an idempotency collision: the
     * request is retried with a fresh reference and keeps its key.
     */
    public function test_a_reference_collision_with_a_key_is_retried_and_keeps_the_key(): void
    {
        $this->collideOnTheNextAttempts(1);

        $inquiry = app(SubmitInquiry::class)->handle($this->attributes(), '3f2b8c1e-9d4a-4b7e-8c21-5a6f0e9d1b42');

        $this->assertTrue($inquiry->wasRecentlyCreated);
        $this->assertNotSame(self::TAKEN_REFERENCE, $inquiry->public_id);
        $this->assertSame(Inquiry::hashIdempotencyKey('3f2b8c1e-9d4a-4b7e-8c21-5a6f0e9d1b42'), $inquiry->fresh()->idempotency_key_hash);
        $this->assertSame(2, $this->attempts);
    }
}
