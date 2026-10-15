<?php

namespace App\Http\Controllers;

use Illuminate\Foundation\Events\DiagnosingHealth;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Event;
use Throwable;

/**
 * Uptime probe. Replaces the framework's HTML /up page so the response names
 * no framework, version, or environment. Listeners of DiagnosingHealth can
 * add checks (for example the database) by throwing when unhealthy.
 */
class HealthCheckController extends Controller
{
    public function __invoke(): JsonResponse
    {
        try {
            Event::dispatch(new DiagnosingHealth);
        } catch (Throwable $exception) {
            report($exception);

            return response()->json(['status' => 'down'], 503);
        }

        return response()->json(['status' => 'ok']);
    }
}
