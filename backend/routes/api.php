<?php

use App\Http\Controllers\Api\V1\InquiryController;
use App\Http\Middleware\LimitRequestBodySize;
use Illuminate\Support\Facades\Route;

// Laravel adds the /api prefix and the stateless "api" middleware group.
// Contracts: docs/api/README.md.

Route::prefix('v1')->name('api.v1.')->group(function (): void {
    // Write-only on purpose: inquiries contain personal data and have no public read endpoint.
    Route::post('inquiries', [InquiryController::class, 'store'])
        ->middleware(['throttle:inquiries', LimitRequestBodySize::class])
        ->name('inquiries.store');
});
