<?php

namespace Tests\Support;

use Illuminate\Contracts\Foundation\Application;
use Illuminate\Database\ConnectionInterface;
use RuntimeException;

/**
 * Proves that tests talk to the disposable MySQL testing database before RefreshDatabase
 * drops its tables: the environment, the configured connection, the database the server
 * actually selected, and the privileges of the connected user.
 */
final class TestDatabaseGuard
{
    public const DATABASE = 'solveit_indonesia_testing';

    /**
     * Connections already verified in this process, so the server is asked once per run.
     *
     * @var array<string, true>
     */
    private static array $verified = [];

    public static function verify(Application $app): void
    {
        if (! $app->environment('testing')) {
            throw new RuntimeException('Tests only run with APP_ENV=testing.');
        }

        $config = $app['config'];
        $name = $config->get('database.default');
        $connection = (array) $config->get("database.connections.{$name}", []);

        if ($name !== 'mysql' || ($connection['driver'] ?? null) !== 'mysql') {
            throw new RuntimeException('Tests only run on the "mysql" connection with the mysql driver.');
        }

        if (($connection['database'] ?? null) !== self::DATABASE || ! empty($connection['url'])) {
            throw new RuntimeException('Tests only run against the database "'.self::DATABASE.'", configured without DB_URL.');
        }

        $key = implode('|', [$connection['host'] ?? '', $connection['port'] ?? '', $connection['unix_socket'] ?? '', $connection['username'] ?? '']);

        if (isset(self::$verified[$key])) {
            return;
        }

        $database = $app['db']->connection($name);
        self::assertSelectedDatabase($database);
        self::assertGrantsAreLimitedToTheTestingDatabase(self::grantsOf($database));

        self::$verified[$key] = true;
    }

    /**
     * The server, not the configuration, decides which database the session uses.
     */
    public static function assertSelectedDatabase(ConnectionInterface $connection): void
    {
        $selected = $connection->selectOne('select database() as selected')?->selected;

        if ($selected !== self::DATABASE) {
            throw new RuntimeException('The test connection selected "'.($selected ?? 'no database').'" instead of "'.self::DATABASE.'".');
        }
    }

    /**
     * Only `USAGE` globally and privileges on exactly the testing database. The underscores
     * must be escaped in the grant: in MySQL `_` is a wildcard in database-level grants.
     *
     * @param  list<string>  $grants  Lines of `SHOW GRANTS FOR CURRENT_USER()`.
     */
    public static function assertGrantsAreLimitedToTheTestingDatabase(array $grants): void
    {
        $testingDatabase = '`'.str_replace('_', '\\_', self::DATABASE).'`.*';

        foreach ($grants as $grant) {
            $allowed = preg_match('/^GRANT USAGE ON \*\.\* TO /', $grant) === 1
                || (str_contains($grant, ' ON '.$testingDatabase.' TO ') && preg_match('/^GRANT .+ ON /', $grant) === 1);

            if (! $allowed) {
                $target = preg_match('/ ON (\S+) TO /', $grant, $match) === 1 ? $match[1] : 'a role or proxy';

                throw new RuntimeException("The test database user may only hold privileges on {$testingDatabase}; it also holds privileges on {$target}.");
            }
        }
    }

    /**
     * @return list<string>
     */
    private static function grantsOf(ConnectionInterface $connection): array
    {
        return array_map(
            fn (object $row): string => (string) array_values((array) $row)[0],
            $connection->select('show grants for current_user()'),
        );
    }
}
