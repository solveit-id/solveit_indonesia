<?php

namespace Tests\Feature\Database;

use Illuminate\Cache\RateLimiter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * MySQL is the project database (docs/architecture/architecture-overview.md). These tests
 * prove the suite really runs on it, with the settings the application relies on.
 */
class MySqlDatabaseTest extends TestCase
{
    use RefreshDatabase;

    public function test_tests_run_against_a_dedicated_mysql_8_4_or_newer_testing_database(): void
    {
        $server = DB::selectOne('select version() as version, @@version_comment as comment');

        $this->assertSame('mysql', DB::connection()->getDriverName());
        $this->assertStringContainsString('_testing', DB::connection()->getDatabaseName());
        $this->assertStringNotContainsStringIgnoringCase('mariadb', $server->version.' '.$server->comment);
        $this->assertTrue(version_compare($server->version, '8.4.0', '>='), "MySQL {$server->version} is older than the 8.4 LTS baseline.");
    }

    public function test_connection_is_strict_and_tables_use_utf8mb4(): void
    {
        $session = DB::selectOne('select @@session.sql_mode as sql_mode, @@character_set_connection as charset');
        $table = DB::selectOne(
            'select table_collation as collation, engine as engine from information_schema.tables where table_schema = database() and table_name = ?',
            ['inquiries'],
        );

        $this->assertStringContainsString('STRICT_TRANS_TABLES', $session->sql_mode);
        $this->assertSame('utf8mb4', $session->charset);
        $this->assertSame('utf8mb4_unicode_ci', $table->collation);
        $this->assertSame('InnoDB', $table->engine);
    }

    /**
     * Production keeps rate-limit counters in the database cache store (CACHE_STORE=database).
     */
    public function test_rate_limit_counters_work_in_the_database_cache_store(): void
    {
        $limiter = new RateLimiter(Cache::store('database'));

        $limiter->hit('inquiries-minute|203.0.113.1', 60);
        $limiter->hit('inquiries-minute|203.0.113.1', 60);

        $this->assertSame(2, $limiter->attempts('inquiries-minute|203.0.113.1'));
        $this->assertTrue($limiter->tooManyAttempts('inquiries-minute|203.0.113.1', 2));
        $this->assertFalse($limiter->tooManyAttempts('inquiries-minute|203.0.113.2', 2));
        $this->assertGreaterThan(0, DB::table('cache')->count());
    }
}
