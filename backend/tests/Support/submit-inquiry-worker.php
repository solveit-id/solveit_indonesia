<?php

/**
 * One POST /api/v1/inquiries in its own PHP process with its own MySQL connection, for
 * tests/Feature/Actions/SubmitInquiryConcurrencyTest.php. Never run it by hand.
 *
 * Usage: php tests/Support/submit-inquiry-worker.php <idempotency-key> <start-at-unix-time>
 * The JSON payload comes on stdin; the result is printed as JSON on stdout.
 *
 * The environment is pinned like phpunit.xml and checked by the same TestDatabaseGuard
 * before any query, so a worker can only ever write to solveit_indonesia_testing.
 */

use Illuminate\Contracts\Http\Kernel;
use Illuminate\Http\Request;
use Tests\Support\TestDatabaseGuard;

$pinned = [
    'APP_ENV' => 'testing',
    'DB_CONNECTION' => 'mysql',
    'DB_DATABASE' => 'solveit_indonesia_testing',
    'DB_URL' => '',
    'CACHE_STORE' => 'array',
    'SESSION_DRIVER' => 'array',
    'QUEUE_CONNECTION' => 'sync',
    'MAIL_MAILER' => 'array',
    'LOG_CHANNEL' => 'null',
];

foreach ($pinned as $name => $value) {
    putenv("{$name}={$value}");
    $_ENV[$name] = $value;
    $_SERVER[$name] = $value;
}

[, $idempotencyKey, $startAt] = $argv + [null, null, '0'];
$payload = (string) stream_get_contents(STDIN);

require __DIR__.'/../../vendor/autoload.php';

$app = require __DIR__.'/../../bootstrap/app.php';
$kernel = $app->make(Kernel::class);
$kernel->bootstrap();

TestDatabaseGuard::verify($app);

// Every worker boots first, then all send at the same moment.
while (microtime(true) < (float) $startAt) {
    usleep(1000);
}

$server = ['CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT' => 'application/json'];

if ($idempotencyKey !== null && $idempotencyKey !== '') {
    $server['HTTP_IDEMPOTENCY_KEY'] = $idempotencyKey;
}

$response = $kernel->handle(Request::create('/api/v1/inquiries', 'POST', server: $server, content: $payload));

echo json_encode([
    'status' => $response->getStatusCode(),
    'body' => json_decode((string) $response->getContent(), true),
    'replayed' => $response->headers->get('Idempotent-Replayed') === 'true',
]);
