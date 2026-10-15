<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use RuntimeException;

abstract class TestCase extends BaseTestCase
{
    /**
     * Refuse to run before RefreshDatabase drops every table, unless the connection points
     * at a disposable testing database. Protects development and production data from a
     * stray DB_DATABASE in the shell or in .env.
     *
     * @return array<class-string, class-string>
     */
    protected function setUpTraits(): array
    {
        $connection = config('database.default');
        $database = (string) config("database.connections.{$connection}.database");

        if (! str_contains($database, '_testing')) {
            throw new RuntimeException("Tests only run against a disposable database whose name contains \"_testing\"; got \"{$database}\".");
        }

        return parent::setUpTraits();
    }
}
