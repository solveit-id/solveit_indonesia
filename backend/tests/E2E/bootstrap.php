<?php

/*
|--------------------------------------------------------------------------
| Real-browser test harness (B3.2b): shared start-up
|--------------------------------------------------------------------------
|
| Used by tests/E2E/server.php (the PHP built-in server's router) and tests/E2E/harness.php
| (database preparation and synthetic accounts). Neither is part of the application: tests/
| never enters a Docker image (infra/docker/backend/Dockerfile.dockerignore) and PHPUnit does
| not load this folder (phpunit.xml lists tests/Unit and tests/Feature only).
|
| Safety gate, the same one PHPUnit uses (tests/Support/TestDatabaseGuard.php), run before
| any migration, fixture, or HTTP request:
|
| 1. The caller may not ask for another environment: APP_ENV must be unset or "testing".
| 2. The values that decide where data goes are pinned like phpunit.xml pins them ($_SERVER,
|    $_ENV, and putenv), so .env.testing provides only host, port, user, password, and key.
| 3. The guard proves APP_ENV=testing, the "mysql" connection without DB_URL, the database
|    name solveit_indonesia_testing, the database the server actually selected, and a user
|    whose grants cover that database only. Anything else stops the run (fail closed).
|
*/

use Illuminate\Contracts\Console\Kernel;
use Illuminate\Foundation\Application;
use Illuminate\Support\Carbon;
use Tests\Support\TestDatabaseGuard;

const SOLVEIT_E2E_BASE = __DIR__.'/../..';

require_once SOLVEIT_E2E_BASE.'/vendor/autoload.php';

/**
 * Pin the environment, or refuse when the caller asked for a different one.
 *
 * @throws RuntimeException
 */
function solveit_e2e_pin_environment(): void
{
    $requested = getenv('APP_ENV');

    if ($requested !== false && $requested !== '' && $requested !== 'testing') {
        throw new RuntimeException('The browser test harness runs only with APP_ENV=testing.');
    }

    $adminUrl = getenv('SOLVEIT_E2E_ADMIN_URL') ?: 'http://127.0.0.1:4176';

    if (preg_match('#^http://127\.0\.0\.1:\d+$#', $adminUrl) !== 1) {
        throw new RuntimeException('SOLVEIT_E2E_ADMIN_URL must be a loopback origin such as http://127.0.0.1:4176.');
    }

    $pins = [
        'APP_ENV' => 'testing',
        'APP_DEBUG' => 'false',
        'DB_CONNECTION' => 'mysql',
        'DB_DATABASE' => TestDatabaseGuard::DATABASE,
        'DB_URL' => '',
        // Sessions, the rate limiter, and Fortify's used-code cache must outlive a request.
        'SESSION_DRIVER' => 'database',
        'CACHE_STORE' => 'database',
        'QUEUE_CONNECTION' => 'sync',
        'MAIL_MAILER' => 'array',
        'BROADCAST_CONNECTION' => 'null',
        'LOG_CHANNEL' => 'stderr',
        'ADMIN_URL' => $adminUrl,
        'APP_URL' => $adminUrl,
        'PULSE_ENABLED' => 'false',
        'TELESCOPE_ENABLED' => 'false',
        'NIGHTWATCH_ENABLED' => 'false',
    ];

    foreach ($pins as $name => $value) {
        $_SERVER[$name] = $value;
        $_ENV[$name] = $value;
        putenv("{$name}={$value}");
    }
}

/**
 * The test-only clock: an offset in seconds read from SOLVEIT_E2E_CLOCK_FILE, written by the
 * browser tests to move Laravel's time forward (idle, absolute, challenge, and enrollment
 * expiry) without waiting. TOTP codes keep real time: google2fa reads microtime() itself.
 */
function solveit_e2e_apply_clock(): void
{
    $file = getenv('SOLVEIT_E2E_CLOCK_FILE');

    if ($file === false || $file === '' || ! is_file($file)) {
        return;
    }

    $state = json_decode((string) file_get_contents($file), true);
    $offset = is_array($state) && is_int($state['offset_seconds'] ?? null) ? $state['offset_seconds'] : 0;

    if ($offset !== 0) {
        Carbon::setTestNow(Carbon::createFromTimestamp(microtime(true) + $offset));
    }
}

/**
 * A booted application whose database connection passed the guard.
 *
 * @throws RuntimeException
 */
function solveit_e2e_verified_application(): Application
{
    solveit_e2e_pin_environment();

    /** @var Application $app */
    $app = require SOLVEIT_E2E_BASE.'/bootstrap/app.php';
    $app->make(Kernel::class)->bootstrap();

    TestDatabaseGuard::verify($app);

    return $app;
}
