<?php

/*
|--------------------------------------------------------------------------
| Router of the PHP built-in server for the real-browser tests
|--------------------------------------------------------------------------
|
| php -S 127.0.0.1:8100 -t public tests/E2E/server.php  (started by admin/tests/integration)
|
| Every request first passes the safety gate (tests/E2E/bootstrap.php) on a throwaway
| application instance; only then is it handled the way public/index.php handles it.
| A request that fails the gate gets 503 and touches nothing. The test clock applies to both.
|
*/

use Illuminate\Foundation\Application;
use Illuminate\Http\Request;

require_once __DIR__.'/bootstrap.php';

try {
    solveit_e2e_verified_application();
} catch (Throwable $exception) {
    http_response_code(503);
    header('Content-Type: text/plain; charset=utf-8');
    header('Cache-Control: no-store');
    echo "E2E safety gate refused this request.\n";
    file_put_contents('php://stderr', 'E2E safety gate: '.$exception->getMessage()."\n");

    return true;
}

solveit_e2e_apply_clock();

// From here on what public/index.php does, with a second, fresh application instance (the one
// above was booted for the gate only). index.php itself cannot be required: its require_once
// of bootstrap/app.php would return true, since the gate already loaded that file.
$_SERVER['SCRIPT_FILENAME'] = SOLVEIT_E2E_BASE.'/public/index.php';
$_SERVER['SCRIPT_NAME'] = '/index.php';

define('LARAVEL_START', microtime(true));

/** @var Application $app */
$app = require SOLVEIT_E2E_BASE.'/bootstrap/app.php';

$app->handleRequest(Request::capture());

return true;
