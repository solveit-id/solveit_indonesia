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
}
