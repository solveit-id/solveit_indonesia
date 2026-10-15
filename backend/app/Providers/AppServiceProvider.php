<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

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
    }
}
