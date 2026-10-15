<?php

namespace Tests\Feature;

use Illuminate\Foundation\Events\DiagnosingHealth;
use Illuminate\Support\Facades\Event;
use RuntimeException;
use Tests\TestCase;

class HealthCheckTest extends TestCase
{
    public function test_health_endpoint_returns_200_with_status_only(): void
    {
        $response = $this->get('/up');

        $response->assertOk()->assertExactJson(['status' => 'ok']);
        $this->assertStringNotContainsStringIgnoringCase('laravel', (string) $response->getContent());
        $response->assertCookieMissing((string) config('session.cookie'));
    }

    public function test_failing_health_check_returns_503_without_details(): void
    {
        config(['app.debug' => false]);
        Event::listen(DiagnosingHealth::class, fn () => throw new RuntimeException('database at 10.0.0.5 refused'));

        $response = $this->get('/up');

        $response->assertServiceUnavailable()->assertExactJson(['status' => 'down']);
    }

    public function test_site_root_does_not_serve_a_default_page(): void
    {
        $this->get('/')->assertNotFound();
    }
}
