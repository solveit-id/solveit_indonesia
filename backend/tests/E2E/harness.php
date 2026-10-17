<?php

/*
|--------------------------------------------------------------------------
| Real-browser test harness: database and synthetic accounts
|--------------------------------------------------------------------------
|
| php tests/E2E/harness.php gate                       prove the database is the testing one
| php tests/E2E/harness.php fresh                      migrate:fresh on the testing database
| php tests/E2E/harness.php reset                      empty its tables (between tests)
| php tests/E2E/harness.php bootstrap-owner <email>    the real shell command; its link as JSON
| php tests/E2E/harness.php reset-credentials <email>  the real shell command; its link as JSON
|
| Every command passes the safety gate first (tests/E2E/bootstrap.php). Output is one JSON
| line on stdout for the test runner, which keeps access links in memory and never logs them.
| Accounts come only from the application's own commands and API, with synthetic addresses
| on the reserved example.test domain; there is no default account or password anywhere.
|
*/

use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Tests\Support\TestDatabaseGuard;

require_once __DIR__.'/bootstrap.php';

/**
 * @param  array<string, mixed>  $payload
 */
function solveit_e2e_answer(array $payload, int $exitCode = 0): never
{
    fwrite(STDOUT, json_encode($payload, JSON_UNESCAPED_SLASHES)."\n");

    exit($exitCode);
}

$command = $argv[1] ?? '';
$argument = $argv[2] ?? '';

try {
    $app = solveit_e2e_verified_application();
} catch (Throwable $exception) {
    solveit_e2e_answer(['ok' => false, 'gate' => 'refused', 'reason' => $exception->getMessage()], 1);
}

solveit_e2e_apply_clock();

$synthetic = static fn (string $email): bool => preg_match('/^[a-z0-9.+-]+@example\.test$/', $email) === 1;

switch ($command) {
    case 'gate':
        solveit_e2e_answer([
            'ok' => true,
            'environment' => $app->environment(),
            'database' => DB::connection()->selectOne('select database() as selected')->selected,
            'mysql' => DB::connection()->selectOne('select version() as version')->version,
            'grants' => 'limited to '.TestDatabaseGuard::DATABASE,
        ]);

    case 'fresh':
        $exitCode = Artisan::call('migrate:fresh', ['--force' => true]);
        solveit_e2e_answer(['ok' => $exitCode === 0], $exitCode === 0 ? 0 : 1);

    case 'reset':
        // Between tests: empty every table of the testing database except the migration log,
        // which also clears sessions, rate limiters, and Fortify's used-code cache. TRUNCATE
        // bypasses the audit table's append-only triggers; that is acceptable only here.
        $tables = array_map(
            static fn (object $row): string => (string) array_values((array) $row)[0],
            DB::select('show full tables where Table_type = ?', ['BASE TABLE']),
        );

        DB::statement('set foreign_key_checks = 0');

        foreach ($tables as $table) {
            if ($table !== 'migrations') {
                DB::statement('truncate table `'.str_replace('`', '', $table).'`');
            }
        }

        DB::statement('set foreign_key_checks = 1');
        solveit_e2e_answer(['ok' => true, 'tables' => count($tables) - 1]);

    case 'bootstrap-owner':
    case 'reset-credentials':
        if (! $synthetic($argument)) {
            solveit_e2e_answer(['ok' => false, 'reason' => 'Only synthetic @example.test addresses.'], 1);
        }

        $exitCode = Artisan::call('admin:'.$command, ['email' => $argument]);

        if ($exitCode !== 0 || preg_match('#\S+/access\#token=[A-Za-z0-9_-]{43}#', Artisan::output(), $match) !== 1) {
            solveit_e2e_answer(['ok' => false, 'reason' => "admin:{$command} did not issue a link."], 1);
        }

        solveit_e2e_answer(['ok' => true, 'url' => $match[0]]);

    default:
        solveit_e2e_answer(['ok' => false, 'reason' => 'Unknown command.'], 1);
}
