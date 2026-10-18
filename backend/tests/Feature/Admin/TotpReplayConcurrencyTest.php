<?php

namespace Tests\Feature\Admin;

use App\Models\User;
use GuzzleHttp\Client;
use GuzzleHttp\Cookie\CookieJar;
use GuzzleHttp\Handler\CurlMultiHandler;
use GuzzleHttp\HandlerStack;
use GuzzleHttp\Promise\PromiseInterface;
use GuzzleHttp\Promise\Utils;
use Illuminate\Contracts\Process\InvokedProcess;
use Illuminate\Foundation\Testing\DatabaseTruncation;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Process;
use Illuminate\Support\Facades\Schema;
use PragmaRX\Google2FA\Google2FA;
use RuntimeException;
use Tests\Support\InteractsWithAdminApi;
use Tests\TestCase;

/**
 * One TOTP code submitted twice at the same instant, by independent PHP processes with
 * their own MySQL connections (B3.2b security review). Before the fix both were accepted in
 * 20 of 20 rounds: Fortify's replay check reads, verifies, and writes separately. Now exactly
 * one may win, through an atomic claim on the database cache store.
 *
 * Committed rows are needed across connections, so this class truncates its tables instead
 * of wrapping each test in a transaction, and empties them again afterwards.
 */
class TotpReplayConcurrencyTest extends TestCase
{
    use DatabaseTruncation;
    use InteractsWithAdminApi;

    /** Each scenario is repeated, so a lucky interleaving cannot hide a race. */
    private const ROUNDS = 5;

    /** Origin the two test servers accept as ADMIN_URL (any loopback port, never opened). */
    private const ADMIN_ORIGIN = 'http://127.0.0.1:4199';

    /**
     * @var list<string>
     */
    protected array $tablesToTruncate = ['cache', 'sessions', 'admin_audit_events', 'users'];

    private ?HandlerStack $sharedHandler = null;

    protected function tearDown(): void
    {
        while (DB::transactionLevel() > 0) {
            DB::rollBack();
        }

        Schema::withoutForeignKeyConstraints(function (): void {
            foreach ($this->tablesToTruncate as $table) {
                DB::table($table)->truncate();
            }
        });

        parent::tearDown();
    }

    public function test_two_processes_verifying_one_code_at_once_accept_it_exactly_once(): void
    {
        $google2fa = new Google2FA;

        for ($round = 0; $round < self::ROUNDS; $round++) {
            $secret = $google2fa->generateSecretKey(32);
            $code = $google2fa->getCurrentOtp($secret);
            $startAt = microtime(true) + 3;

            $workers = array_map(
                fn (): InvokedProcess => Process::path(base_path())
                    ->timeout(120)
                    ->input((string) json_encode(['secret' => $secret, 'code' => $code]))
                    ->start([PHP_BINARY, 'tests/Support/totp-claim-worker.php', sprintf('%.6F', $startAt)]),
                [1, 2],
            );

            $accepted = array_sum(array_map(function (InvokedProcess $worker): int {
                $result = $worker->wait();

                if (! $result->successful()) {
                    throw new RuntimeException('Worker failed: '.$result->errorOutput().$result->output());
                }

                return json_decode($result->output(), true, flags: JSON_THROW_ON_ERROR)['accepted'] ? 1 : 0;
            }, $workers));

            $this->assertSame(1, $accepted, "Round {$round}: exactly one process may accept the code.");
        }
    }

    /**
     * Two browsers of one account pass the password step on two separate Laravel servers
     * (separate PHP processes sharing the MySQL session table), then submit the same TOTP
     * code at the same instant. One session signs in, the other is refused.
     */
    public function test_two_sessions_submitting_one_code_at_once_sign_in_exactly_once(): void
    {
        $servers = [$this->startServer(18191), $this->startServer(18192)];

        try {
            for ($round = 0; $round < 3; $round++) {
                $user = $this->createActiveAdmin();
                $clients = [$this->browser(18191), $this->browser(18192)];

                foreach ($clients as $client) {
                    $this->send($client, 'GET', 'auth/csrf-cookie')->wait();
                    $login = $this->send($client, 'POST', 'auth/login', ['email' => $user->email, 'password' => self::ADMIN_PASSWORD])->wait();
                    $this->assertSame(200, $login->getStatusCode(), 'Password step');
                }

                // Both requests travel the real HTTP path and wait inside the TOTP provider until
                // the same instant (the router's test-only barrier), then race.
                $code = (new Google2FA)->getCurrentOtp($this->totpSecret($user));
                $releaseAt = sprintf('%.6F', microtime(true) + 2);
                $answers = Utils::settle(array_map(
                    fn (array $client) => $this->send($client, 'POST', 'auth/two-factor-challenge', ['code' => $code], ['X-Solveit-Test-Barrier' => $releaseAt]),
                    $clients,
                ))->wait();

                $statuses = array_map(fn (array $answer): int => $answer['value']->getStatusCode(), $answers);
                sort($statuses);
                $this->assertSame([204, 422], $statuses, "Round {$round}: one sign-in, one refusal.");

                $signedIn = array_map(fn (array $client): int => $this->send($client, 'GET', 'me')->wait()->getStatusCode(), $clients);
                sort($signedIn);
                $this->assertSame([200, 401], $signedIn, "Round {$round}: exactly one session is signed in.");

                User::query()->whereKey($user->getKey())->delete();
            }
        } finally {
            foreach ($servers as $server) {
                $server->stop();
            }
        }
    }

    /**
     * A Laravel HTTP server on its own port and PHP process, through the gated test router
     * (tests/E2E/server.php: APP_ENV=testing, the testing database, TestDatabaseGuard on
     * every request).
     */
    private function startServer(int $port): InvokedProcess
    {
        $server = Process::path(base_path('public'))
            ->env(['SOLVEIT_E2E_ADMIN_URL' => self::ADMIN_ORIGIN, 'SOLVEIT_E2E_CLOCK_FILE' => '', 'SOLVEIT_E2E_TOTP_BARRIER' => '1'])
            ->forever()
            ->start([PHP_BINARY, '-S', "127.0.0.1:{$port}", '-t', base_path('public'), base_path('tests/E2E/server.php')]);

        $probe = new Client(['base_uri' => "http://127.0.0.1:{$port}", 'http_errors' => false, 'timeout' => 2]);

        for ($attempt = 0; $attempt < 50; $attempt++) {
            try {
                if ($probe->get('/up')->getStatusCode() === 200) {
                    return $server;
                }
            } catch (\Throwable) {
                // Not listening yet.
            }

            usleep(200_000);
        }

        $server->stop();

        throw new RuntimeException("The test server on port {$port} did not start: ".$server->latestErrorOutput());
    }

    /**
     * @return array{client: Client, jar: CookieJar}
     */
    private function browser(int $port): array
    {
        $jar = new CookieJar;

        return [
            'jar' => $jar,
            'client' => new Client([
                // One cURL multi handler for every browser, so their requests are in flight
                // together; a handler per client would run one request after the other.
                'handler' => $this->sharedHandler ??= HandlerStack::create(new CurlMultiHandler),
                // Addressed to the admin origin, as a browser behind the admin proxy is; cURL
                // connects to this server's port instead, keeping Host and Origin intact.
                'base_uri' => self::ADMIN_ORIGIN.'/api/v1/admin/',
                'curl' => [CURLOPT_CONNECT_TO => ["127.0.0.1:4199:127.0.0.1:{$port}"]],
                'http_errors' => false,
                'timeout' => 30,
                'cookies' => $jar,
                'headers' => ['Origin' => self::ADMIN_ORIGIN, 'Accept' => 'application/json'],
            ]),
        ];
    }

    /**
     * @param  array{client: Client, jar: CookieJar}  $browser
     * @param  array<string, mixed>  $data
     * @param  array<string, string>  $headers
     */
    private function send(array $browser, string $method, string $path, array $data = [], array $headers = []): PromiseInterface
    {
        $token = $browser['jar']->getCookieByName('XSRF-TOKEN')?->getValue();

        return $browser['client']->requestAsync($method, $path, array_filter([
            'json' => $data === [] ? null : $data,
            'headers' => $headers + ($token === null ? [] : ['X-XSRF-TOKEN' => urldecode($token)]),
        ], fn ($value): bool => $value !== null));
    }
}
