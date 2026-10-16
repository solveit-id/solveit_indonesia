<?php

use App\Http\Controllers\HealthCheckController;
use App\Http\Middleware\AdminPreventRequestForgery;
use App\Http\Middleware\AdminRequestBoundary;
use App\Http\Middleware\EnforceAdminSessionLifetime;
use App\Http\Middleware\EnsureAdminAccountActive;
use App\Http\Middleware\EnsureAdminGuest;
use App\Http\Middleware\EnsureLoginChallengeIsValid;
use Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse;
use Illuminate\Cookie\Middleware\EncryptCookies;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Routing\Middleware\SubstituteBindings;
use Illuminate\Session\Middleware\StartSession;
use Illuminate\Support\Facades\Route;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        then: function (): void {
            // Outside the web group on purpose: no session, cookies, or database write per probe.
            Route::get('/up', HealthCheckController::class)->name('health');

            // Admin API (B3.1a): the only routes with a session. routes/api.php stays stateless.
            Route::middleware('admin')
                ->prefix('api/v1/admin')
                ->name('api.v1.admin.')
                ->group(__DIR__.'/../routes/admin.php');
        },
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Trusted proxies come from config/trustedproxy.php (TRUSTED_PROXIES).

        // Session-backed admin API, same origin as the admin application. The boundary
        // runs first, so a request for another host or from another origin never starts
        // a session (and never creates a session row).
        $middleware->group('admin', [
            AdminRequestBoundary::class,
            EncryptCookies::class,
            AddQueuedCookiesToResponse::class,
            StartSession::class,
            AdminPreventRequestForgery::class,
            SubstituteBindings::class,
        ]);

        $middleware->alias([
            'admin.guest' => EnsureAdminGuest::class,
            'admin.active' => EnsureAdminAccountActive::class,
            'admin.session-lifetime' => EnforceAdminSessionLifetime::class,
            'admin.login-challenge' => EnsureLoginChallengeIsValid::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );
    })->create();
