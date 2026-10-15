<?php

namespace Tests\Unit\Models;

use App\Models\Inquiry;
use PHPUnit\Framework\TestCase;

class InquiryTest extends TestCase
{
    public function test_public_id_uses_the_inq_prefix_and_unambiguous_characters(): void
    {
        $this->assertMatchesRegularExpression(
            '/^INQ-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/',
            Inquiry::newPublicId(),
        );
    }

    public function test_public_ids_do_not_repeat_across_many_generations(): void
    {
        $ids = array_map(fn (): string => Inquiry::newPublicId(), range(1, 5000));

        $this->assertCount(5000, array_unique($ids));
    }

    public function test_consecutive_public_ids_are_not_sequential(): void
    {
        $first = Inquiry::newPublicId();
        $second = Inquiry::newPublicId();

        $this->assertNotSame(substr($first, 0, -1), substr($second, 0, -1));
    }
}
