<?php

namespace Tests\Unit\Models;

use App\Models\Inquiry;
use PHPUnit\Framework\Attributes\DataProvider;
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

    /**
     * @return array<string, array{string, string, string}>
     */
    public static function contacts(): array
    {
        return [
            'email' => ['rina@example.com', 'email', 'r•••@e•••.com'],
            'email with subdomains' => ['rina.pratiwi@mail.toko.co.id', 'email', 'r•••@m•••.id'],
            'email with a one-letter name' => ['r@example.org', 'email', 'r•••@e•••.org'],
            'email starting with a non-Latin letter' => ['ñandú@ejemplo.es', 'email', 'ñ•••@e•••.es'],
            'international phone' => ['+62 877-5964-1358', 'phone', '+•••••••358'],
            'local phone' => ['081230252499', 'phone', '•••••••499'],
            'phone with fewer than eight digits' => ['1-------', 'phone', '•••••••'],
        ];
    }

    #[DataProvider('contacts')]
    public function test_contacts_are_masked_by_default(string $contact, string $type, string $masked): void
    {
        $inquiry = new Inquiry(['contact' => $contact]);

        $this->assertSame($type, $inquiry->contactType());
        $this->assertSame($masked, $inquiry->maskedContact());
    }

    public function test_the_mask_does_not_reveal_the_length_of_the_contact(): void
    {
        $short = new Inquiry(['contact' => 'ab@cd.com']);
        $long = new Inquiry(['contact' => 'a-very-long-name@a-very-long-domain.com']);

        $this->assertSame(mb_strlen($short->maskedContact()), mb_strlen($long->maskedContact()));
    }
}
