<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Tests\Support\TestDatabaseGuard;

abstract class TestCase extends BaseTestCase
{
    /**
     * Refuse to run before RefreshDatabase drops every table, unless the connection is the
     * verified testing database (tests/Support/TestDatabaseGuard.php). Protects development,
     * shared, and production data from a stray environment variable or .env file.
     *
     * @return array<class-string, class-string>
     */
    protected function setUpTraits(): array
    {
        TestDatabaseGuard::verify($this->app);

        return parent::setUpTraits();
    }
}
