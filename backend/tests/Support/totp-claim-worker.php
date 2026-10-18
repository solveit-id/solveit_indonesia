<?php

/**
 * One TOTP verification in its own PHP process with its own MySQL connection, for
 * tests/Feature/Admin/TotpReplayConcurrencyTest.php. Never run it by hand.
 *
 * Usage: php tests/Support/totp-claim-worker.php <start-at-unix-time>
 * The secret and code come as JSON on stdin; the outcome is printed as JSON on stdout (only
 * true or false, never the secret or the code).
 *
 * The environment is pinned like phpunit.xml and checked by the same TestDatabaseGuard
 * before any query. The provider is the application's own container binding, so the claim
 * runs on the store the HTTP challenge uses (the database store, not CACHE_STORE=array).
 */

use Illuminate\Contracts\Console\Kernel;
use Laravel\Fortify\Contracts\TwoFactorAuthenticationProvider;
use Tests\Support\TestDatabaseGuard;

$pinned = [
    'APP_ENV' => 'testing',
    'DB_CONNECTION' => 'mysql',
    'DB_DATABASE' => 'solveit_indonesia_testing',
    'DB_URL' => '',
    'CACHE_STORE' => 'array',
    'QUEUE_CONNECTION' => 'sync',
    'MAIL_MAILER' => 'array',
    'LOG_CHANNEL' => 'null',
    'ADMIN_URL' => 'http://localhost',
];

foreach ($pinned as $name => $value) {
    putenv("{$name}={$value}");
    $_ENV[$name] = $value;
    $_SERVER[$name] = $value;
}

[, $startAt] = $argv + [null, '0'];
$input = json_decode((string) stream_get_contents(STDIN), true, flags: JSON_THROW_ON_ERROR);

require __DIR__.'/../../vendor/autoload.php';

$app = require __DIR__.'/../../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

TestDatabaseGuard::verify($app);

$provider = $app->make(TwoFactorAuthenticationProvider::class);

while (microtime(true) < (float) $startAt) {
    usleep(200);
}

echo json_encode(['accepted' => $provider->verify($input['secret'], $input['code'])]);
