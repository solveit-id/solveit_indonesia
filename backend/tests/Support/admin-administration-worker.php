<?php

/**
 * One owner administration operation (B3.1b) in its own PHP process with its own MySQL
 * connection, for tests/Feature/Admin/AdminAdministrationConcurrencyTest.php. Never run it
 * by hand.
 *
 * Usage: php tests/Support/admin-administration-worker.php <start-at-unix-time>
 * The operation comes as JSON on stdin; the outcome is printed as JSON on stdout. Access
 * link URLs and tokens are never printed, only the link ID.
 *
 * The environment is pinned like phpunit.xml and checked by the same TestDatabaseGuard
 * before any query, so a worker can only ever write to solveit_indonesia_testing. The
 * acting owner is loaded before the start signal, like an HTTP request that passed its
 * authorization check just before another request changed the account.
 */

use App\Actions\Admin\ChangeAdminRole;
use App\Actions\Admin\InviteAdminAccount;
use App\Actions\Admin\ResetAdminCredentials;
use App\Actions\Admin\SuspendAdminAccount;
use App\Enums\AdminActorType;
use App\Enums\AdminRole;
use App\Exceptions\AdminAccountStateException;
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
$target = isset($operation['target_id']) ? User::query()->findOrFail($operation['target_id']) : null;

// Every worker boots first, then all act at the same moment.
while (microtime(true) < (float) $startAt) {
    usleep(1000);
}

try {
    $id = match ($operation['operation']) {
        'invite' => $app->make(InviteAdminAccount::class)->handle($actor, $operation['email'], AdminRole::from($operation['role']))->link->getKey(),
        'change-role' => $app->make(ChangeAdminRole::class)->handle($actor, $target, AdminRole::from($operation['role']))->getKey(),
        'suspend' => $app->make(SuspendAdminAccount::class)->suspend($actor, $target)->getKey(),
        'reset' => $app->make(ResetAdminCredentials::class)->handle($target, AdminActorType::User, 60, $actor)->link->getKey(),
    };

    $outcome = ['outcome' => 'ok', 'id' => $id];
} catch (AdminAccountStateException $exception) {
    $outcome = ['outcome' => 'conflict', 'code' => $exception->reason];
} catch (AuthorizationException) {
    $outcome = ['outcome' => 'forbidden'];
} catch (Throwable $exception) {
    // Anything else (a deadlock that outlived the retries, a query error) fails the test.
    fwrite(STDERR, $exception::class.': '.$exception->getMessage());
    exit(1);
}

echo json_encode($outcome);
