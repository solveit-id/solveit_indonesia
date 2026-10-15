<?php

namespace Tests\Unit\Rules;

use App\Rules\EmailOrPhone;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

class EmailOrPhoneTest extends TestCase
{
    private function passes(mixed $value): bool
    {
        $failed = false;

        (new EmailOrPhone)->validate('contact', $value, function () use (&$failed): void {
            $failed = true;
        });

        return ! $failed;
    }

    #[DataProvider('validContacts')]
    public function test_accepts_contacts_the_website_form_accepts(string $contact): void
    {
        $this->assertTrue($this->passes($contact));
    }

    /**
     * @return array<string, array{string}>
     */
    public static function validContacts(): array
    {
        return [
            'email' => ['rina@example.com'],
            'email with subdomain and plus' => ['rina+inquiry@mail.example.co.id'],
            'email with unicode local part' => ['ñoño@example.com'],
            'international phone with spaces and hyphens' => ['+62 877-5964-1358'],
            'local phone digits only' => ['081230252499'],
            'shortest phone (8 characters)' => ['12345678'],
            'longest phone without plus (17 characters)' => ['12345678901234567'],
            'longest phone with plus (18 characters)' => ['+12345678901234567'],
        ];
    }

    #[DataProvider('invalidContacts')]
    public function test_rejects_values_that_are_neither_email_nor_phone(mixed $contact): void
    {
        $this->assertFalse($this->passes($contact));
    }

    /**
     * @return array<string, array{mixed}>
     */
    public static function invalidContacts(): array
    {
        return [
            'plain text' => ['call me maybe'],
            'email without domain dot' => ['rina@example'],
            'email with one-letter tld' => ['rina@example.c'],
            'email with space' => ['rina pratiwi@example.com'],
            'two at signs' => ['rina@@example.com'],
            'phone too short (7 characters)' => ['1234567'],
            'phone too long without plus (18 characters)' => ['123456789012345678'],
            'phone too long with plus (19 characters)' => ['+123456789012345678'],
            'phone with letters' => ['0812-ABCD-9999'],
            'phone starting with hyphen' => ['-81234567890'],
            'phone with newline' => ["0812\n34567890"],
            'phone with tab' => ["0812\t34567890"],
            'integer' => [81234567890],
            'array' => [['rina@example.com']],
        ];
    }
}
