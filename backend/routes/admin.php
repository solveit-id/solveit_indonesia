<?php

use App\Http\Controllers\Api\V1\Admin\AccessLinkController;
use App\Http\Controllers\Api\V1\Admin\AccountController;
use App\Http\Controllers\Api\V1\Admin\CsrfCookieController;
use App\Http\Controllers\Api\V1\Admin\SessionController;
use Illuminate\Support\Facades\Route;
use Laravel\Fortify\Http\Controllers\AuthenticatedSessionController;
use Laravel\Fortify\Http\Controllers\ConfirmablePasswordController;
use Laravel\Fortify\Http\Controllers\TwoFactorAuthenticatedSessionController;

// Admin API (B3.1a), loaded by bootstrap/app.php under /api/v1/admin with the "admin"
// middleware group: host and origin boundary, encrypted cookies, database session,
// request-forgery check. Contract: docs/api/admin-auth.md.
//
// Every route belongs to exactly one tier below; tests/Feature/Admin/AdminRouteCoverageTest.php
// fails for a route that is not listed there with its tier.

// Tier 1, public authentication: no account, each route rate limited on its own.
Route::get('auth/csrf-cookie', CsrfCookieController::class)
    ->middleware('throttle:admin-csrf')
    ->name('auth.csrf-cookie');

Route::middleware('admin.guest')->group(function (): void {
    Route::post('auth/login', [AuthenticatedSessionController::class, 'store'])
        ->middleware('throttle:admin-login')
        ->name('auth.login');

    Route::post('auth/two-factor-challenge', [TwoFactorAuthenticatedSessionController::class, 'store'])
        ->middleware(['throttle:admin-two-factor', 'admin.login-challenge'])
        ->name('auth.two-factor-challenge');

    // Tier 2, pre-activation: an access link, then the first TOTP code. Grants no
    // permission; the account is signed in only after the code is confirmed.
    Route::post('access-links/inspect', [AccessLinkController::class, 'inspect'])
        ->middleware('throttle:admin-access-link')
        ->name('access-links.inspect');

    Route::post('access-links/redeem', [AccessLinkController::class, 'redeem'])
        ->middleware('throttle:admin-access-link')
        ->name('access-links.redeem');

    Route::post('access-links/confirm', [AccessLinkController::class, 'confirm'])
        ->middleware('throttle:admin-enrollment')
        ->name('access-links.confirm');
});

// Tier 3, authenticated and authorized: signed in with password and TOTP, account still
// active, inside the absolute session limit, and holding the route's permission.
Route::middleware(['auth:web', 'auth.session', 'admin.active', 'admin.session-lifetime', 'throttle:admin-account'])->group(function (): void {
    Route::middleware('can:account.manage-own')->group(function (): void {
        Route::post('auth/logout', [AuthenticatedSessionController::class, 'destroy'])->name('auth.logout');

        Route::post('auth/confirm-password', [ConfirmablePasswordController::class, 'store'])
            ->middleware('throttle:admin-password-confirm')
            ->name('auth.confirm-password');

        Route::get('me', [AccountController::class, 'show'])->name('me.show');
        Route::put('me/password', [AccountController::class, 'updatePassword'])->name('me.password.update');
        Route::post('me/two-factor-recovery-codes', [AccountController::class, 'regenerateRecoveryCodes'])
            ->middleware('password.confirm')
            ->name('me.recovery-codes.store');

        Route::get('me/sessions', [SessionController::class, 'index'])->name('me.sessions.index');
        Route::delete('me/sessions', [SessionController::class, 'destroyOthers'])->name('me.sessions.destroy-others');
        Route::delete('me/sessions/{session}', [SessionController::class, 'destroy'])
            ->whereAlphaNumeric('session')
            ->name('me.sessions.destroy');
    });
});
