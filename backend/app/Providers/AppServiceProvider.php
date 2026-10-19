<?php

namespace App\Providers;

use App\Enums\AdminPermission;
use App\Listeners\RecordAdminAuthenticationEvents;
use App\Models\User;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        RateLimiter::for('inquiries', fn (Request $request): array => [
            Limit::perMinute(config('inquiries.rate_limit.per_minute'))->by('inquiries-minute|'.$request->ip()),
            Limit::perHour(config('inquiries.rate_limit.per_hour'))->by('inquiries-hour|'.$request->ip()),
        ]);

        $this->configureAdminRateLimits();
        $this->configureAdminAuthorization();

        // Admin passwords: at least 12 characters (and at most 72 bytes, App\Rules\MaxBytes).
        // No breached-password lookup: the production backend has no internet access.
        Password::defaults(fn (): Password => Password::min(12));

        Event::subscribe(RecordAdminAuthenticationEvents::class);
    }

    /**
     * Limits of the admin API (routes/admin.php). Sign-in is limited per address and
     * client, and per client overall; nothing locks an account, so nobody can lock an
     * owner out by failing on purpose.
     */
    private function configureAdminRateLimits(): void
    {
        RateLimiter::for('admin-csrf', fn (Request $request): Limit => Limit::perMinute(30)->by('admin-csrf|'.$request->ip()));

        RateLimiter::for('admin-login', fn (Request $request): array => [
            Limit::perMinute(5)->by('admin-login|'.mb_strtolower(trim((string) $request->input('email'))).'|'.$request->ip()),
            Limit::perHour(20)->by('admin-login-client|'.$request->ip()),
        ]);

        RateLimiter::for('admin-two-factor', fn (Request $request): Limit => Limit::perMinute(5)->by('admin-two-factor|'.$request->session()->getId()));

        RateLimiter::for('admin-access-link', fn (Request $request): Limit => Limit::perMinute(10)->by('admin-access-link|'.$request->ip()));

        RateLimiter::for('admin-enrollment', fn (Request $request): Limit => Limit::perMinute(5)->by('admin-enrollment|'.$request->session()->getId()));

        RateLimiter::for('admin-password-confirm', fn (Request $request): Limit => Limit::perMinute(5)->by('admin-password-confirm|'.$request->user()?->getAuthIdentifier()));

        RateLimiter::for('admin-account', fn (Request $request): Limit => Limit::perMinute(120)->by('admin-account|'.$request->user()?->getAuthIdentifier()));

        // Owner writes of user administration (invitations, roles, suspension, resets).
        RateLimiter::for('admin-administration', fn (Request $request): Limit => Limit::perMinute(20)->by('admin-administration|'.$request->user()?->getAuthIdentifier()));

        // Inquiry status changes and notes (B4a).
        RateLimiter::for('admin-inquiry-write', fn (Request $request): Limit => Limit::perMinute(60)->by('admin-inquiry-write|'.$request->user()?->getAuthIdentifier()));

        // Full inquiry contacts (B4a): each reveal is deliberate and recorded, so the limit
        // is low and also hourly, which bounds how many contacts one session can collect.
        RateLimiter::for('admin-inquiry-contact', fn (Request $request): array => [
            Limit::perMinute(10)->by('admin-inquiry-contact-minute|'.$request->user()?->getAuthIdentifier()),
            Limit::perHour(60)->by('admin-inquiry-contact-hour|'.$request->user()?->getAuthIdentifier()),
        ]);
    }

    /**
     * One Gate per admin permission. Abilities that are not defined are denied, so a new
     * route without a matching permission cannot be reached by anyone.
     */
    private function configureAdminAuthorization(): void
    {
        foreach (AdminPermission::cases() as $permission) {
            Gate::define($permission->value, fn (User $user): bool => $user->hasAdminPermission($permission));
        }
    }
}
