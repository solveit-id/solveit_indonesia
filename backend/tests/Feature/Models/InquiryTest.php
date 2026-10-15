<?php

namespace Tests\Feature\Models;

use App\Models\Inquiry;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class InquiryTest extends TestCase
{
    use RefreshDatabase;

    public function test_database_rejects_a_duplicate_public_id(): void
    {
        Inquiry::factory()->create(['public_id' => 'INQ-AAAA-BBBB-CCCC']);

        $this->expectException(UniqueConstraintViolationException::class);

        Inquiry::factory()->create(['public_id' => 'INQ-AAAA-BBBB-CCCC']);
    }

    public function test_database_rejects_a_duplicate_idempotency_key_hash(): void
    {
        Inquiry::factory()->create(['idempotency_key_hash' => Inquiry::hashIdempotencyKey('3f2b8c1e-9d4a-4b7e-8c21-5a6f0e9d1b42')]);

        $this->expectException(UniqueConstraintViolationException::class);

        Inquiry::factory()->create(['idempotency_key_hash' => Inquiry::hashIdempotencyKey('3f2b8c1e-9d4a-4b7e-8c21-5a6f0e9d1b42')]);
    }

    public function test_any_number_of_inquiries_may_have_no_idempotency_key(): void
    {
        Inquiry::factory()->count(3)->create(['idempotency_key_hash' => null]);

        $this->assertDatabaseCount('inquiries', 3);
    }

    public function test_idempotency_key_hash_is_never_serialized(): void
    {
        $inquiry = Inquiry::factory()->create(['idempotency_key_hash' => Inquiry::hashIdempotencyKey('3f2b8c1e-9d4a-4b7e-8c21-5a6f0e9d1b42')]);

        $this->assertArrayNotHasKey('idempotency_key_hash', $inquiry->toArray());
    }
}
