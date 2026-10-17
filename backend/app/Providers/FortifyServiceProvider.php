<?php

namespace App\Providers;

use App\Actions\Admin\AuthenticateAdmin;
use App\Services\ReplaySafeTwoFactorAuthenticationProvider;
use Illuminate\Contracts\Cache\Repository;
use Illuminate\Http\Request;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\ValidationException;
use Laravel\Fortify\Actions\CanonicalizeUsername;
use Laravel\Fortify\Contracts\RedirectsIfTwoFactorAuthenticatable;
use Laravel\Fortify\Contracts\TwoFactorAuthenticationProvider as TwoFactorAuthenticationProviderContract;
use Laravel\Fortify\Fortify;
use PragmaRX\Google2FA\Google2FA;

/**
 * Fortify as a headless library for the admin API (config/fortify.php).
 */
class FortifyServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        // Only the routes in routes/admin.php exist; Fortify's own (registration, password
        // reset, disabling two-factor authentication, passkeys) are never registered.
        Fortify::ignoreRoutes();

        // TOTP check whose replay cache remembers the step a code matched (Fortify's caches
        // the current step, so a next-step code could be used twice). Registered after
        // Fortify's own provider, so this binding replaces its singleton.
        $this->app->singleton(
            TwoFactorAuthenticationProviderContract::class,
            fn ($app): ReplaySafeTwoFactorAuthenticationProvider => new ReplaySafeTwoFactorAuthenticationProvider(
                $app->make(Google2FA::class),
                $app->make(Repository::class),
            ),
        );
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Fortify::authenticateUsing(fn (Request $request) => app(AuthenticateAdmin::class)($request));

        // Sign-in always ends at the TOTP challenge: AuthenticateAdmin admits only accounts
        // with a confirmed authenticator. "Remember me" is never honoured.
        Fortify::authenticateThrough(fn (): array => [
            CanonicalizeUsername::class,
            function (Request $request, callable $next) {
                $request->merge(['remember' => false]);

                return $next($request);
            },
            RedirectsIfTwoFactorAuthenticatable::class,
            function (): never {
                throw ValidationException::withMessages([Fortify::username() => [trans('auth.failed')]]);
            },
        ]);
    }
}
