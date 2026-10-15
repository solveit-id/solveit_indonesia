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
}
