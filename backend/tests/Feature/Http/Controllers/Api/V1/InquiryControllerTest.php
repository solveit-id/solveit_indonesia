<?php

namespace Tests\Feature\Http\Controllers\Api\V1;

use App\Actions\SubmitInquiry;
use App\Enums\InquiryStatus;
use App\Exceptions\InquiryNotStoredException;
use App\Models\Inquiry;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Exceptions;
use Illuminate\Support\Facades\Log;
use PHPUnit\Framework\Attributes\DataProvider;
use RuntimeException;
use Tests\TestCase;
use UnexpectedValueException;

class InquiryControllerTest extends TestCase
{
    use RefreshDatabase;

    private const ENDPOINT = '/api/v1/inquiries';

    /**
     * A payload the website form produces.
     *
     * @param  array<string, mixed>  $overrides
     * @return array<string, mixed>
     */
    private function payload(array $overrides = []): array
    {
        return [
            'name' => 'Rina Pratiwi',
            'organization' => 'Toko Sinar Jaya',
            'contact' => 'rina@example.com',
            'service' => 'sistem-informasi',
            'budget' => '10-50jt',
            'timeline' => '1-3-bulan',
            'message' => 'Kami butuh sistem stok untuk tiga cabang toko.',
            ...$overrides,
        ];
    }

    public function test_route_is_versioned_under_a_single_api_prefix(): void
    {
        $this->assertSame(url('/api/v1/inquiries'), route('api.v1.inquiries.store'));
    }

    public function test_valid_payload_stores_inquiry_and_returns_201_with_public_reference(): void
    {
        $response = $this->postJson(self::ENDPOINT, $this->payload());

        $response->assertCreated()
            ->assertExactJson([
                'id' => Inquiry::sole()->public_id,
                'status' => 'received',
            ]);
        $this->assertMatchesRegularExpression('/^INQ-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/', $response->json('id'));
        $this->assertDatabaseHas('inquiries', [
            'public_id' => $response->json('id'),
            'name' => 'Rina Pratiwi',
            'organization' => 'Toko Sinar Jaya',
            'contact' => 'rina@example.com',
            'service' => 'sistem-informasi',
            'budget' => '10-50jt',
            'timeline' => '1-3-bulan',
            'message' => 'Kami butuh sistem stok untuk tiga cabang toko.',
            'status' => InquiryStatus::Received->value,
        ]);
        $this->assertNotNull(Inquiry::sole()->created_at);
    }

    public function test_each_inquiry_gets_its_own_public_reference(): void
    {
        $first = $this->postJson(self::ENDPOINT, $this->payload())->assertCreated()->json('id');
        $second = $this->postJson(self::ENDPOINT, $this->payload())->assertCreated()->json('id');

        $this->assertNotSame($first, $second);
        $this->assertDatabaseCount('inquiries', 2);
    }

    public function test_successful_submission_logs_only_the_public_reference(): void
    {
        Log::spy();

        $id = $this->postJson(self::ENDPOINT, $this->payload())->assertCreated()->json('id');

        Log::shouldHaveReceived('info')->once()->with('Inquiry received.', ['inquiry' => $id]);
    }

    public function test_failing_log_channel_still_returns_201_for_a_stored_inquiry(): void
    {
        Log::shouldReceive('info')->once()->andThrow(new UnexpectedValueException('The stream or file could not be opened'));

        $response = $this->postJson(self::ENDPOINT, $this->payload());

        $response->assertCreated()->assertJsonPath('id', Inquiry::sole()->public_id);
    }

    #[DataProvider('emptyOrganizations')]
    public function test_missing_or_empty_organization_is_stored_as_null(?string $organization): void
    {
        $payload = $this->payload(['organization' => $organization]);

        if ($organization === null) {
            unset($payload['organization']);
        }

        $this->postJson(self::ENDPOINT, $payload)->assertCreated();

        $this->assertNull(Inquiry::sole()->organization);
    }

    /**
     * @return array<string, array{?string}>
     */
    public static function emptyOrganizations(): array
    {
        return [
            'omitted' => [null],
            'empty string' => [''],
            'only spaces' => ['   '],
        ];
    }

    public function test_unicode_text_is_stored_unchanged(): void
    {
        $payload = $this->payload([
            'name' => 'Ñoño Ŝeptiani 😊',
            'organization' => 'Koperasi “Maju Bersama”',
            'message' => 'Perlu aplikasi untuk pengurus koperasi: café, naïve, 日本語, emoji 🚀.',
        ]);

        $this->postJson(self::ENDPOINT, $payload)->assertCreated();

        $inquiry = Inquiry::sole();
        $this->assertSame($payload['name'], $inquiry->name);
        $this->assertSame($payload['organization'], $inquiry->organization);
        $this->assertSame($payload['message'], $inquiry->message);
    }

    public function test_surrounding_whitespace_is_trimmed_before_storage(): void
    {
        $this->postJson(self::ENDPOINT, $this->payload(['name' => '  Rina Pratiwi  ', 'contact' => ' rina@example.com ']))
            ->assertCreated();

        $this->assertSame('Rina Pratiwi', Inquiry::sole()->name);
        $this->assertSame('rina@example.com', Inquiry::sole()->contact);
    }

    public function test_empty_payload_returns_422_listing_every_required_field(): void
    {
        $this->postJson(self::ENDPOINT, [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors([
                'name' => 'The name field is required.',
                'contact' => 'The contact field is required.',
                'service' => 'The service field is required.',
                'budget' => 'The budget field is required.',
                'timeline' => 'The timeline field is required.',
                'message' => 'The message field is required.',
            ])
            ->assertJsonMissingValidationErrors(['organization']);

        $this->assertDatabaseEmpty('inquiries');
    }

    public function test_validation_failure_uses_laravel_message_and_errors_format(): void
    {
        $response = $this->postJson(self::ENDPOINT, $this->payload(['name' => 'R']));

        $response->assertUnprocessable()
            ->assertExactJson([
                'message' => 'The name field must be at least 2 characters.',
                'errors' => ['name' => ['The name field must be at least 2 characters.']],
            ]);
    }

    /**
     * @param  array<string, mixed>  $overrides
     */
    #[DataProvider('lengthBoundaries')]
    public function test_field_length_boundaries_are_enforced(array $overrides, ?string $field, ?string $message): void
    {
        $response = $this->postJson(self::ENDPOINT, $this->payload($overrides));

        if ($field === null) {
            $response->assertCreated();

            return;
        }

        $response->assertUnprocessable()->assertJsonValidationErrors([$field => $message]);
        $this->assertDatabaseEmpty('inquiries');
    }

    /**
     * Multibyte characters prove that limits count characters, not bytes.
     *
     * @return array<string, array{array<string, mixed>, ?string, ?string}>
     */
    public static function lengthBoundaries(): array
    {
        return [
            'name at 2 characters' => [['name' => 'Ān'], null, null],
            'name at 1 character' => [['name' => 'Ā'], 'name', 'The name field must be at least 2 characters.'],
            'name trimmed below 2' => [['name' => '  A  '], 'name', 'The name field must be at least 2 characters.'],
            'name at 120 characters' => [['name' => str_repeat('ā', 120)], null, null],
            'name at 121 characters' => [['name' => str_repeat('ā', 121)], 'name', 'The name field must not be greater than 120 characters.'],
            'organization at 160 characters' => [['organization' => str_repeat('ō', 160)], null, null],
            'organization at 161 characters' => [['organization' => str_repeat('ō', 161)], 'organization', 'The organization field must not be greater than 160 characters.'],
            'contact at 255 characters' => [['contact' => str_repeat('a', 243).'@example.com'], 'contact', 'The contact field must not be greater than 254 characters.'],
            'message at 20 characters' => [['message' => str_repeat('é', 20)], null, null],
            'message at 19 characters' => [['message' => str_repeat('é', 19)], 'message', 'The message field must be at least 20 characters.'],
            'message trimmed below 20' => [['message' => '   '.str_repeat('a', 19).'   '], 'message', 'The message field must be at least 20 characters.'],
            'message at 5000 characters' => [['message' => str_repeat('🚀', 5000)], null, null],
            'message at 5001 characters' => [['message' => str_repeat('a', 5001)], 'message', 'The message field must not be greater than 5000 characters.'],
        ];
    }

    public function test_phone_contact_is_accepted(): void
    {
        $this->postJson(self::ENDPOINT, $this->payload(['contact' => '+62 812-3456-7890']))->assertCreated();

        $this->assertSame('+62 812-3456-7890', Inquiry::sole()->contact);
    }

    public function test_contact_that_is_neither_email_nor_phone_returns_422(): void
    {
        $this->postJson(self::ENDPOINT, $this->payload(['contact' => 'call me maybe']))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['contact' => 'The contact field must be a valid email address or phone number.']);

        $this->assertDatabaseEmpty('inquiries');
    }

    #[DataProvider('invalidChoices')]
    public function test_values_outside_the_frontend_enums_return_422(string $field, mixed $value): void
    {
        $this->postJson(self::ENDPOINT, $this->payload([$field => $value]))
            ->assertUnprocessable()
            ->assertJsonValidationErrors([$field => "The selected {$field} is invalid."]);

        $this->assertDatabaseEmpty('inquiries');
    }

    /**
     * @return array<string, array{string, mixed}>
     */
    public static function invalidChoices(): array
    {
        return [
            'unknown service' => ['service', 'mobile-app'],
            'service label instead of id' => ['service', 'Sistem Informasi'],
            'service in other case' => ['service', 'WEBSITE'],
            'unknown budget' => ['budget', '1-2jt'],
            'numeric budget' => ['budget', 50],
            'unknown timeline' => ['timeline', 'kemarin'],
            'array timeline' => ['timeline', ['segera']],
        ];
    }

    public function test_non_string_text_fields_return_422(): void
    {
        $this->postJson(self::ENDPOINT, $this->payload(['name' => ['Rina'], 'message' => 12345678901234567890]))
            ->assertUnprocessable()
            ->assertJsonValidationErrors([
                'name' => 'The name field must be a string.',
                'message' => 'The message field must be a string.',
            ]);
    }

    public function test_filled_honeypot_returns_422_and_stores_nothing(): void
    {
        $this->postJson(self::ENDPOINT, $this->payload(['homepage' => 'https://spam.example']))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['homepage' => 'The submission could not be accepted.']);

        $this->assertDatabaseEmpty('inquiries');
    }

    public function test_empty_honeypot_is_accepted_and_not_stored(): void
    {
        $this->postJson(self::ENDPOINT, $this->payload(['homepage' => '']))->assertCreated();

        $this->assertArrayNotHasKey('homepage', Inquiry::sole()->getAttributes());
    }

    public function test_client_cannot_set_internal_or_protected_attributes(): void
    {
        $response = $this->postJson(self::ENDPOINT, $this->payload([
            'id' => 999,
            'public_id' => 'INQ-AAAA-AAAA-AAAA',
            'status' => 'approved',
            'created_at' => '2000-01-01 00:00:00',
        ]));

        $response->assertCreated()->assertJsonPath('status', 'received');
        $inquiry = Inquiry::sole();
        $this->assertNotSame(999, $inquiry->getKey());
        $this->assertNotSame('INQ-AAAA-AAAA-AAAA', $inquiry->public_id);
        $this->assertSame(InquiryStatus::Received, $inquiry->status);
        $this->assertFalse($inquiry->created_at->isSameDay('2000-01-01'));
    }

    /**
     * Make the database itself refuse the next row: in strict mode MySQL rejects a value
     * longer than its column (SQLSTATE 22001). Unlike dropping the table, this needs no
     * DDL, which MySQL would commit implicitly and leak into the other tests.
     */
    private function makeTheDatabaseRejectTheNextInquiry(): void
    {
        Inquiry::creating(function (Inquiry $inquiry): void {
            $inquiry->name = str_repeat('x', 121);
        });
    }

    public function test_storage_failure_returns_503_without_a_reference(): void
    {
        Exceptions::fake();
        $this->makeTheDatabaseRejectTheNextInquiry();

        $response = $this->postJson(self::ENDPOINT, $this->payload());

        $response->assertServiceUnavailable()
            ->assertExactJson(['message' => 'The inquiry could not be saved. Please try again later or contact us by WhatsApp or email.']);
        $this->assertStringNotContainsString('INQ-', $response->getContent());
        $this->assertStringNotContainsString('received', $response->getContent());
        $this->assertDatabaseEmpty('inquiries');
    }

    public function test_storage_failure_is_reported_without_personal_data(): void
    {
        Exceptions::fake();
        $this->makeTheDatabaseRejectTheNextInquiry();

        $this->postJson(self::ENDPOINT, $this->payload())->assertServiceUnavailable();

        Exceptions::assertReported(function (InquiryNotStoredException $exception): bool {
            $reported = $exception->getMessage().json_encode($exception->context());

            return $exception->getPrevious() === null
                && $exception->context() === ['sqlstate' => '22001']
                && ! str_contains($reported, 'rina@example.com')
                && ! str_contains($reported, 'Toko Sinar Jaya')
                && ! str_contains($reported, 'stok');
        });
    }

    public function test_unexpected_error_returns_generic_500_without_details(): void
    {
        config(['app.debug' => false]);
        $this->mock(SubmitInquiry::class)
            ->shouldReceive('handle')
            ->andThrow(new RuntimeException('Internal detail: db password is hunter2'));

        $response = $this->postJson(self::ENDPOINT, $this->payload());

        $response->assertInternalServerError()->assertExactJson(['message' => 'Server Error']);
        $this->assertStringNotContainsString('hunter2', $response->getContent());
    }

    public function test_requests_over_the_rate_limit_return_429_and_are_not_stored(): void
    {
        config(['app.debug' => false, 'inquiries.rate_limit.per_minute' => 2]);

        $this->postJson(self::ENDPOINT, $this->payload())->assertCreated();
        $this->postJson(self::ENDPOINT, $this->payload())->assertCreated();

        $this->postJson(self::ENDPOINT, $this->payload())
            ->assertTooManyRequests()
            ->assertHeader('Retry-After')
            ->assertExactJson(['message' => 'Too Many Attempts.']);
        $this->assertDatabaseCount('inquiries', 2);
    }

    public function test_hourly_rate_limit_applies_across_minutes(): void
    {
        config(['inquiries.rate_limit.per_minute' => 10, 'inquiries.rate_limit.per_hour' => 1]);

        $this->postJson(self::ENDPOINT, $this->payload())->assertCreated();
        $this->travel(2)->minutes();

        $this->postJson(self::ENDPOINT, $this->payload())->assertTooManyRequests();
        $this->assertDatabaseCount('inquiries', 1);
    }

    public function test_spoofed_forwarded_for_header_does_not_bypass_the_rate_limit(): void
    {
        config(['inquiries.rate_limit.per_minute' => 1, 'trustedproxy.proxies' => null]);

        $this->postJson(self::ENDPOINT, $this->payload(), ['X-Forwarded-For' => '203.0.113.1'])->assertCreated();

        $this->postJson(self::ENDPOINT, $this->payload(), ['X-Forwarded-For' => '203.0.113.2'])->assertTooManyRequests();
    }

    public function test_rate_limit_follows_the_visitor_address_behind_a_trusted_proxy(): void
    {
        config(['inquiries.rate_limit.per_minute' => 1, 'trustedproxy.proxies' => '127.0.0.1']);

        $this->postJson(self::ENDPOINT, $this->payload(), ['X-Forwarded-For' => '203.0.113.1'])->assertCreated();
        $this->postJson(self::ENDPOINT, $this->payload(), ['X-Forwarded-For' => '203.0.113.2'])->assertCreated();

        $this->postJson(self::ENDPOINT, $this->payload(), ['X-Forwarded-For' => '203.0.113.1'])->assertTooManyRequests();
    }

    public function test_rejected_attempts_count_toward_the_rate_limit(): void
    {
        config(['inquiries.rate_limit.per_minute' => 1]);

        $this->postJson(self::ENDPOINT, [])->assertUnprocessable();

        $this->postJson(self::ENDPOINT, $this->payload())->assertTooManyRequests();
        $this->assertDatabaseEmpty('inquiries');
    }

    public function test_request_body_over_the_size_limit_returns_413(): void
    {
        config(['inquiries.max_body_bytes' => 1024]);

        $this->postJson(self::ENDPOINT, $this->payload(['message' => str_repeat('a', 2000)]))
            ->assertStatus(413)
            ->assertExactJson(['message' => 'The request body is too large.']);
        $this->assertDatabaseEmpty('inquiries');
    }

    /**
     * Inquiries hold personal data, so no public route may read, change, or delete them.
     */
    #[DataProvider('forbiddenAccess')]
    public function test_inquiries_cannot_be_read_or_changed_publicly(string $method, bool $withReference, int $status): void
    {
        $inquiry = Inquiry::factory()->create(['contact' => 'private@example.com']);
        $uri = self::ENDPOINT.($withReference ? '/'.$inquiry->public_id : '');

        $response = $this->json($method, $uri, ['status' => 'approved']);

        $response->assertStatus($status);
        $this->assertStringNotContainsString('private@example.com', $response->getContent());
        $this->assertSame(InquiryStatus::Received, $inquiry->fresh()->status);
        $this->assertDatabaseCount('inquiries', 1);
    }

    /**
     * @return array<string, array{string, bool, int}>
     */
    public static function forbiddenAccess(): array
    {
        return [
            'list' => ['GET', false, 405],
            'show' => ['GET', true, 404],
            'replace collection' => ['PUT', false, 405],
            'update' => ['PATCH', true, 404],
            'delete' => ['DELETE', true, 404],
            'delete collection' => ['DELETE', false, 405],
        ];
    }

    public function test_error_responses_in_production_mode_contain_no_debug_details(): void
    {
        config(['app.debug' => false]);

        $response = $this->getJson(self::ENDPOINT);

        $response->assertMethodNotAllowed();
        $this->assertSame(['message'], array_keys($response->json()));
    }

    public function test_preflight_from_an_allowed_origin_is_granted(): void
    {
        config(['cors.allowed_origins' => ['http://localhost:5173']]);

        $this->options(self::ENDPOINT, [], [
            'Origin' => 'http://localhost:5173',
            'Access-Control-Request-Method' => 'POST',
            'Access-Control-Request-Headers' => 'content-type',
        ])
            ->assertNoContent()
            ->assertHeader('Access-Control-Allow-Origin', 'http://localhost:5173')
            ->assertHeaderMissing('Access-Control-Allow-Credentials');
    }

    /**
     * With several allowed origins only a matching one is echoed. (With exactly one,
     * the library always sends that fixed origin, which still does not grant others.)
     */
    public function test_preflight_from_an_unlisted_origin_gets_no_cors_grant(): void
    {
        config(['cors.allowed_origins' => ['http://localhost:5173', 'http://localhost:4173']]);

        $this->options(self::ENDPOINT, [], [
            'Origin' => 'https://evil.example',
            'Access-Control-Request-Method' => 'POST',
        ])->assertHeaderMissing('Access-Control-Allow-Origin');
    }

    public function test_cross_origin_post_without_configured_origins_gets_no_cors_grant(): void
    {
        config(['cors.allowed_origins' => []]);

        $this->postJson(self::ENDPOINT, $this->payload(), ['Origin' => 'http://localhost:5173'])
            ->assertHeaderMissing('Access-Control-Allow-Origin');
    }
}
