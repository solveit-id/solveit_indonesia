<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     *
     * Deliberately creates no user: an account with a known password would become a
     * sign-in to the admin API. The first account comes only from
     * `php artisan admin:bootstrap-owner` (backend/README.md); tests use factories.
     */
    public function run(): void
    {
        //
    }
}
