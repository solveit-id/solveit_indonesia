<?php

/**
 * One inquiry operation (B4a) in its own PHP process with its own MySQL connection, for
 * tests/Feature/Admin/AdminInquiryConcurrencyTest.php. Never run it by hand.
 *
 * Usage: php tests/Support/inquiry-workflow-worker.php <start-at-unix-time>
 * The operation comes as JSON on stdin; the outcome is printed as JSON on stdout. Contacts,
 * names, messages, and note bodies are never printed.
 *
 * The environment is pinned like phpunit.xml and checked by the same TestDatabaseGuard
 * before any query, so a worker can only ever write to solveit_indonesia_testing. The
 * acting account and the inquiry are loaded before the start signal, like an HTTP request
 * that passed its authorization check just before another request changed them.
 */

use App\Actions\Admin\AddInquiryNote;
use App\Actions\Admin\ChangeInquiryStatus;
use App\Actions\Admin\RevealInquiryContact;
use App\Actions\Admin\SuspendAdminAccount;
use App\Enums\InquiryStatus;
use App\Exceptions\InquiryStateException;
use App\Models\Inquiry;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Contracts\Console\Kernel;
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
    'BCRYPT_ROUNDS' => '4',
    'ADMIN_URL' => 'http://localhost',
];

foreach ($pinned as $name => $value) {
    putenv("{$name}={$value}");
    $_ENV[$name] = $value;
    $_SERVER[$name] = $value;
}

[, $startAt] = $argv + [null, '0'];
$operation = json_decode((string) stream_get_contents(STDIN), true, flags: JSON_THROW_ON_ERROR);

require __DIR__.'/../../vendor/autoload.php';

$app = require __DIR__.'/../../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

TestDatabaseGuard::verify($app);

$actor = User::query()->findOrFail($operation['actor_id']);
$inquiry = isset($operation['inquiry_id']) ? Inquiry::query()->findOrFail($operation['inquiry_id']) : null;
$target = isset($operation['target_id']) ? User::query()->findOrFail($operation['target_id']) : null;

// Every worker boots first, then all act at the same moment.
while (microtime(true) < (float) $startAt) {
    usleep(1000);
}

try {
    $outcome = match ($operation['operation']) {
        'change-status' => (function () use ($app, $actor, $inquiry, $operation): array {
            $result = $app->make(ChangeInquiryStatus::class)->handle($actor, $inquiry, InquiryStatus::from($operation['status']), InquiryStatus::from($operation['expected']));

            return ['outcome' => 'ok', 'changed' => $result->wasChanged('status'), 'status' => $result->status->value];
        })(),
        'add-note' => ['outcome' => 'ok', 'id' => $app->make(AddInquiryNote::class)->handle($actor, $inquiry, $operation['body'])->getKey()],
        'reveal' => ['outcome' => 'ok', 'id' => $app->make(RevealInquiryContact::class)->handle($actor, $inquiry)->getKey()],
        'suspend' => ['outcome' => 'ok', 'id' => $app->make(SuspendAdminAccount::class)->suspend($actor, $target)->getKey()],
    };
} catch (InquiryStateException $exception) {
    $outcome = ['outcome' => 'conflict', 'code' => $exception->reason];
} catch (AuthorizationException) {
    $outcome = ['outcome' => 'forbidden'];
} catch (Throwable $exception) {
    // Anything else (a deadlock that outlived the retries, a query error) fails the test.
    // Only the class and SQLSTATE: the message of a query error holds its bindings.
    fwrite(STDERR, $exception::class.(property_exists($exception, 'errorInfo') ? ' '.json_encode($exception->errorInfo[0] ?? null) : ''));
    exit(1);
}

echo json_encode($outcome);
