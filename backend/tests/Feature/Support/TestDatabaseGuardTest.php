<?php

namespace Tests\Feature\Support;

use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\DataProvider;
use RuntimeException;
use Tests\Support\TestDatabaseGuard;
use Tests\TestCase;

/**
 * The guard is the only thing between RefreshDatabase and a database that is not disposable.
 */
class TestDatabaseGuardTest extends TestCase
{
    public function test_the_suite_runs_on_the_verified_testing_database_with_scoped_privileges(): void
    {
        TestDatabaseGuard::verify($this->app);

        $this->assertSame('solveit_indonesia_testing', DB::selectOne('select database() as selected')->selected);
        $this->assertSame('testing', $this->app->environment());
    }

    /**
     * @param  array<string, mixed>  $config
     */
    #[DataProvider('unsafeConfigurations')]
    public function test_an_unsafe_configuration_is_refused_before_connecting(array $config, string $message): void
    {
        config($config);
        DB::purge('mysql');

        try {
            TestDatabaseGuard::verify($this->app);
            $this->fail('The guard accepted an unsafe configuration.');
        } catch (RuntimeException $exception) {
            $this->assertStringContainsString($message, $exception->getMessage());
        }
    }

    /**
     * @return array<string, array{array<string, mixed>, string}>
     */
    public static function unsafeConfigurations(): array
    {
        return [
            'development database' => [['database.connections.mysql.database' => 'solveit_indonesia'], 'Tests only run against the database'],
            'name that only contains _testing' => [['database.connections.mysql.database' => 'shop_testing_backup'], 'Tests only run against the database'],
            'database url override' => [['database.connections.mysql.url' => 'mysql://user@db.example/solveit_indonesia_testing'], 'configured without DB_URL'],
            'sqlite connection' => [['database.default' => 'sqlite'], 'Tests only run on the "mysql" connection'],
        ];
    }

    public function test_an_environment_other_than_testing_is_refused(): void
    {
        $this->app['env'] = 'local';

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('Tests only run with APP_ENV=testing.');

        TestDatabaseGuard::verify($this->app);
    }

    public function test_a_session_on_another_database_is_refused(): void
    {
        $connection = $this->mock(ConnectionInterface::class);
        $connection->shouldReceive('selectOne')->once()->andReturn((object) ['selected' => 'solveit_indonesia']);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('selected "solveit_indonesia" instead of "solveit_indonesia_testing"');

        TestDatabaseGuard::assertSelectedDatabase($connection);
    }

    public function test_privileges_on_exactly_the_testing_database_are_accepted(): void
    {
        TestDatabaseGuard::assertGrantsAreLimitedToTheTestingDatabase([
            'GRANT USAGE ON *.* TO `solveit_test`@`%`',
            'GRANT ALL PRIVILEGES ON `solveit\_indonesia\_testing`.* TO `solveit_test`@`%`',
        ]);

        $this->addToAssertionCount(1);
    }

    #[DataProvider('unsafeGrants')]
    public function test_privileges_beyond_the_testing_database_are_refused(string $grant): void
    {
        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('The test database user may only hold privileges on `solveit\_indonesia\_testing`.*');

        TestDatabaseGuard::assertGrantsAreLimitedToTheTestingDatabase([
            'GRANT USAGE ON *.* TO `solveit_test`@`%`',
            $grant,
        ]);
    }

    /**
     * @return array<string, array{string}>
     */
    public static function unsafeGrants(): array
    {
        return [
            'global privileges (root-like)' => ['GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, DROP ON *.* TO `root`@`localhost`'],
            'global dynamic privileges' => ['GRANT SYSTEM_USER,BACKUP_ADMIN ON *.* TO `solveit_test`@`%`'],
            'development database' => ['GRANT ALL PRIVILEGES ON `solveit\_indonesia`.* TO `solveit_test`@`%`'],
            'wildcard grant matching other databases' => ['GRANT ALL PRIVILEGES ON `solveit_indonesia_testing`.* TO `solveit_test`@`%`'],
            'pattern grant' => ['GRANT ALL PRIVILEGES ON `solveit%`.* TO `solveit_test`@`%`'],
            'granted role' => ['GRANT `app_admin`@`%` TO `solveit_test`@`%`'],
            'proxy' => ["GRANT PROXY ON ''@'' TO `solveit_test`@`%`"],
        ];
    }
}
