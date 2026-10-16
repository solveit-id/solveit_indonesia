<?php

namespace Tests\Feature\Admin;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Support\InteractsWithAdminApi;
use Tests\TestCase;

/**
 * Host, origin, CSRF, cookies, and the stateless public API.
 */
class AdminRequestBoundaryTest extends TestCase
{
    use InteractsWithAdminApi;
    use RefreshDatabase;

    public function test_csrf_cookie_sets_host_only_strict_http_only_session_and_xsrf_cookies(): void
    {
        $response = $this->adminRequest('GET', 'auth/csrf-cookie')->assertNoContent();

        $headers = implode("\n", $response->headers->all('set-cookie'));
        $session = $this->setCookieLine($headers, 'solveit-admin-session');
        $xsrf = $this->setCookieLine($headers, 'XSRF-TOKEN');

        $this->assertStringContainsString('path=/', $session);
        $this->assertStringContainsString('httponly', $session);
        $this->assertStringContainsString('samesite=strict', $session);
        $this->assertStringNotContainsString('domain=', $session);
        $this->assertStringNotContainsString('expires=', $session, 'expires when the browser closes');
        // Local HTTP: no Secure flag, which browsers would reject on http://.
        $this->assertStringNotContainsString('secure', $session);

        $this->assertStringContainsString('samesite=strict', $xsrf);
        $this->assertStringNotContainsString('httponly', $xsrf, 'the admin application reads it');
        $this->assertStringNotContainsString('domain=', $xsrf);

        $response->assertHeader('Cache-Control', 'no-store, private');
    }

    public function test_an_https_admin_origin_gets_a_secure_host_prefixed_session_cookie(): void
    {
        $config = $this->sessionConfigFor('https://admin.example.test');

        $this->assertSame('__Host-solveit-admin-session', $config['cookie']);
        $this->assertTrue($config['secure']);
        $this->assertSame('/', $config['path']);
        $this->assertNull($config['domain']);

        config(['admin.url' => 'https://admin.example.test', ...collect($config)->mapWithKeys(fn ($value, $key) => ["session.$key" => $value])->all()]);

        $response = $this->withHeaders(['Origin' => 'https://admin.example.test'])
            ->getJson('https://admin.example.test/api/v1/admin/auth/csrf-cookie')
            ->assertNoContent();

        $session = $this->setCookieLine(implode("\n", $response->headers->all('set-cookie')), '__Host-solveit-admin-session');
        $this->assertStringContainsString('secure', $session);
        $this->assertStringContainsString('path=/', $session);
        $this->assertStringNotContainsString('domain=', $session);
        $this->assertStringContainsString('samesite=strict', $session);
    }

    public function test_policy_values_ignore_the_environment(): void
    {
        $config = $this->sessionConfigFor('http://127.0.0.1:5174', ['SESSION_LIFETIME' => '600', 'SESSION_SAME_SITE' => 'none', 'SESSION_ENCRYPT' => 'false', 'SESSION_DOMAIN' => '.example.test', 'SESSION_DRIVER' => 'file']);

        $this->assertSame('database', $config['driver'], 'revocation needs the sessions table');
        $this->assertSame('solveit-admin-session', $config['cookie']);
        $this->assertFalse($config['secure']);
        $this->assertSame(30, $config['lifetime']);
        $this->assertTrue($config['expire_on_close']);
        $this->assertTrue($config['encrypt']);
        $this->assertSame('strict', $config['same_site']);
        $this->assertNull($config['domain']);
        $this->assertTrue($config['http_only']);
        $this->assertSame(900, config('auth.password_timeout'));
    }

    public function test_the_admin_api_refuses_to_run_without_the_database_session_driver(): void
    {
        config(['session.driver' => 'file']);

        $this->adminRequest('GET', 'auth/csrf-cookie')
            ->assertStatus(503)
            ->assertExactJson(['message' => 'The admin API is unavailable.'])
            ->assertHeader('Cache-Control', 'no-store, private');

        $this->assertSame([], $this->adminCookies(), 'no session was started');
        $this->assertSame(0, DB::table('sessions')->count());
    }

    public function test_writes_without_a_csrf_token_get_419(): void
    {
        $this->adminRequest('GET', 'auth/csrf-cookie');

        $this->adminRequest('POST', 'auth/login', ['email' => 'a@example.com', 'password' => 'x'], sendXsrf: false)
            ->assertStatus(419)
            ->assertJsonPath('message', 'CSRF token mismatch.');

        $this->adminRequest('POST', 'auth/login', ['email' => 'a@example.com', 'password' => 'x'], ['X-XSRF-TOKEN' => 'forged'])
            ->assertStatus(419);
    }

    public function test_a_token_from_another_session_is_refused(): void
    {
        $this->adminRequest('GET', 'auth/csrf-cookie');
        $foreignToken = $this->adminCookies()['XSRF-TOKEN'];

        $this->usingAdminClient('victim');
        $this->adminRequest('GET', 'auth/csrf-cookie');

        $this->adminRequest('POST', 'auth/login', ['email' => 'a@example.com', 'password' => 'x'], ['X-XSRF-TOKEN' => $foreignToken])
            ->assertStatus(419);
    }

    public function test_browser_marked_same_origin_writes_pass_without_a_token(): void
    {
        $this->adminRequest('GET', 'auth/csrf-cookie');

        // Sec-Fetch-Site cannot be set by page scripts; Laravel accepts same-origin without a token.
        $this->adminRequest('POST', 'auth/login', ['email' => 'a@example.com', 'password' => 'x'], ['Sec-Fetch-Site' => 'same-origin'], sendXsrf: false)
            ->assertUnprocessable();
    }

    /**
     * @return array<string, array{array<string, string|null>}>
     */
    public static function foreignRequests(): array
    {
        return [
            'public website origin' => [['Origin' => 'http://localhost:5173']],
            'other site origin' => [['Origin' => 'https://evil.example']],
            'opaque origin' => [['Origin' => 'null']],
            'same-site fetch' => [['Sec-Fetch-Site' => 'same-site']],
            'cross-site fetch' => [['Sec-Fetch-Site' => 'cross-site']],
            'write without origin' => [['Origin' => null]],
        ];
    }

    /**
     * @param  array<string, string|null>  $headers
     */
    #[DataProvider('foreignRequests')]
    public function test_cross_origin_and_same_site_requests_are_refused_before_a_session_starts(array $headers): void
    {
        $response = $this->adminRequest('POST', 'auth/login', ['email' => 'a@example.com', 'password' => 'x'], $headers);

        $response->assertForbidden()->assertExactJson(['message' => 'Cross-origin requests to the admin API are not allowed.']);
        $this->assertSame([], $response->headers->getCookies());
        $this->assertSame(0, DB::table('sessions')->count());
    }

    public function test_the_admin_api_does_not_exist_on_another_host(): void
    {
        $response = $this->withHeaders(['Origin' => 'http://www.example.test'])
            ->getJson('http://www.example.test/api/v1/admin/auth/csrf-cookie');

        $response->assertNotFound()->assertExactJson(['message' => 'Not Found.']);
        $this->assertSame([], $response->headers->getCookies());
        $this->assertSame(0, DB::table('sessions')->count());
    }

    /**
     * @return array<string, array{string}>
     */
    public static function alternatePaths(): array
    {
        return [
            'upper case' => ['/api/v1/ADMIN/auth/csrf-cookie'],
            'mixed case' => ['/API/v1/admin/auth/csrf-cookie'],
            'double slash' => ['/api//v1/admin/auth/csrf-cookie'],
            'fortify default login' => ['/login'],
            'fortify registration' => ['/register'],
            'fortify two-factor management' => ['/user/two-factor-authentication'],
            'fortify challenge' => ['/two-factor-challenge'],
            'sanctum csrf' => ['/sanctum/csrf-cookie'],
            'passkeys' => ['/passkeys/login/options'],
        ];
    }

    #[DataProvider('alternatePaths')]
    public function test_alternate_paths_reach_nothing(string $path): void
    {
        $response = $this->withHeaders(['Origin' => 'http://localhost'])->getJson($path);

        $this->assertContains($response->status(), [404, 405]);
        $this->assertSame([], $response->headers->getCookies());
    }

    public function test_the_public_inquiry_endpoint_stays_stateless_and_cookie_free(): void
    {
        $this->adminRequest('GET', 'auth/csrf-cookie');

        $response = $this->withUnencryptedCookies($this->adminCookies())
            ->withHeaders(['Origin' => 'http://localhost'])
            ->postJson('/api/v1/inquiries', [
                'name' => 'Rina Pratiwi',
                'contact' => 'rina@example.com',
                'service' => 'website',
                'budget' => 'belum-tahu',
                'timeline' => 'fleksibel',
                'message' => 'Kami butuh website untuk usaha kami.',
            ]);

        $response->assertCreated();
        $this->assertSame([], $response->headers->all('set-cookie'));
        $this->assertSame(1, DB::table('sessions')->count(), 'only the admin request above created a session');
    }

    public function test_admin_paths_never_answer_a_cors_preflight(): void
    {
        config(['cors.allowed_origins' => ['http://localhost:5173']]);

        $response = $this->call('OPTIONS', '/api/v1/admin/auth/login', server: [
            'HTTP_ORIGIN' => 'http://localhost:5173',
            'HTTP_ACCESS_CONTROL_REQUEST_METHOD' => 'POST',
        ]);

        $response->assertHeaderMissing('Access-Control-Allow-Origin');
        $response->assertHeaderMissing('Access-Control-Allow-Credentials');
    }

    /**
     * Evaluate config/session.php the way the framework does, with the given environment.
     *
     * @param  array<string, string>  $environment
     * @return array<string, mixed>
     */
    private function sessionConfigFor(string $adminUrl, array $environment = []): array
    {
        $environment = ['ADMIN_URL' => $adminUrl, ...$environment];
        $previous = [];

        foreach ($environment as $name => $value) {
            $previous[$name] = [$_ENV[$name] ?? null, $_SERVER[$name] ?? null];
            $_ENV[$name] = $_SERVER[$name] = $value;
        }

        try {
            return require config_path('session.php');
        } finally {
            foreach ($previous as $name => [$env, $server]) {
                if ($env === null) {
                    unset($_ENV[$name]);
                } else {
                    $_ENV[$name] = $env;
                }

                if ($server === null) {
                    unset($_SERVER[$name]);
                } else {
                    $_SERVER[$name] = $server;
                }
            }
        }
    }

    private function setCookieLine(string $headers, string $name): string
    {
        foreach (explode("\n", $headers) as $line) {
            if (str_starts_with($line, $name.'=')) {
                return strtolower($line);
            }
        }

        $this->fail("No Set-Cookie for {$name}.");
    }
}
