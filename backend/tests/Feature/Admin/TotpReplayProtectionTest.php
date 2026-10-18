<?php

namespace Tests\Feature\Admin;

use App\Services\ReplaySafeTwoFactorAuthenticationProvider;
use Illuminate\Cache\DatabaseStore;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;
use Laravel\Fortify\Contracts\TwoFactorAuthenticationProvider;
use PHPUnit\Framework\Attributes\DataProvider;
use PragmaRX\Google2FA\Google2FA;
use ReflectionProperty;
use Tests\TestCase;

/**
 * The one-time TOTP claim (App\Services\ReplaySafeTwoFactorAuthenticationProvider) with a
 * google2fa engine pinned to chosen 30-second steps, on the real database cache store of the
 * MySQL testing database. Nothing depends on the wall clock, so step boundaries are exact.
 */
class TotpReplayProtectionTest extends TestCase
{
    use RefreshDatabase;

    /** A step where the two synthetic secrets below both produce 910432 (found by search). */
    private const COLLISION_STEP = 60135638;

    private const COLLISION_CODE = '910432';

    private const SECRET_A = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';

    private const SECRET_B = 'KRSXG5CTMVRXEZLUKRSXG5CTMVRXEZLU';

    protected function tearDown(): void
    {
        Carbon::setTestNow();

        parent::tearDown();
    }

    /**
     * @return array<string, array{int}>
     */
    public static function stepsInsideTheWindow(): array
    {
        return ['previous step' => [-1], 'current step' => [0], 'next step' => [1]];
    }

    #[DataProvider('stepsInsideTheWindow')]
    public function test_a_code_inside_the_drift_window_is_accepted_exactly_once(int $offset): void
    {
        $step = self::COLLISION_STEP;
        $code = $this->code(self::SECRET_A, $step + $offset);

        $this->assertTrue($this->providerAt($step)->verify(self::SECRET_A, $code));
        $this->assertFalse($this->providerAt($step)->verify(self::SECRET_A, $code));
    }

    public function test_codes_outside_the_window_are_refused_at_exact_step_boundaries(): void
    {
        $step = self::COLLISION_STEP;
        $code = $this->code(self::SECRET_A, $step);

        // Accepted from step - 1 to step + 1, refused one step outside on either side.
        $this->assertFalse($this->providerAt($step - 2)->verify(self::SECRET_A, $code));
        $this->assertFalse($this->providerAt($step + 2)->verify(self::SECRET_A, $code));
        $this->assertTrue($this->providerAt($step - 1)->verify(self::SECRET_A, $code));
    }

    public function test_a_next_step_code_stays_claimed_for_its_whole_validity(): void
    {
        $step = self::COLLISION_STEP;
        $code = $this->code(self::SECRET_A, $step + 1);

        // First use at the earliest moment the window accepts it: the start of `step`.
        Carbon::setTestNow(Carbon::createFromTimestamp($step * 30));
        $this->assertTrue($this->providerAt($step)->verify(self::SECRET_A, $code));

        // It stays valid until the last second of step + 2; the claim must outlive that.
        $lastValidSecond = ($step + 3) * 30 - 1;
        $expiration = (int) DB::table('cache')->where('key', 'like', '%'.ReplaySafeTwoFactorAuthenticationProvider::CLAIM_PREFIX.'%')->value('expiration');
        $this->assertGreaterThan($lastValidSecond, $expiration);

        Carbon::setTestNow(Carbon::createFromTimestamp($lastValidSecond));
        $this->assertFalse($this->providerAt($step + 1)->verify(self::SECRET_A, $code));
        $this->assertFalse($this->providerAt($step + 2)->verify(self::SECRET_A, $code));
    }

    /**
     * Before the fix the claim was keyed by the six digits alone, so another account's use
     * of the same digits rejected a person's own valid code. The same holds for a replaced
     * authenticator: a new secret starts with no claims, whatever digits the old one used.
     */
    public function test_two_authenticators_with_the_same_digits_do_not_interfere(): void
    {
        $step = self::COLLISION_STEP;
        $this->assertSame(self::COLLISION_CODE, $this->code(self::SECRET_A, $step));
        $this->assertSame(self::COLLISION_CODE, $this->code(self::SECRET_B, $step));

        $this->assertTrue($this->providerAt($step)->verify(self::SECRET_A, self::COLLISION_CODE));
        $this->assertTrue($this->providerAt($step)->verify(self::SECRET_B, self::COLLISION_CODE));

        $this->assertFalse($this->providerAt($step)->verify(self::SECRET_A, self::COLLISION_CODE));
        $this->assertFalse($this->providerAt($step)->verify(self::SECRET_B, self::COLLISION_CODE));
    }

    public function test_claims_hold_no_code_secret_or_account_data(): void
    {
        $step = self::COLLISION_STEP;
        $this->providerAt($step)->verify(self::SECRET_A, self::COLLISION_CODE);

        $rows = DB::table('cache')->get(['key', 'value']);
        $this->assertCount(1, $rows);
        $this->assertMatchesRegularExpression('/'.preg_quote(ReplaySafeTwoFactorAuthenticationProvider::CLAIM_PREFIX, '/').'[0-9a-f]{64}$/', $rows[0]->key);

        // Prefix plus 64 hex characters: no room for the code or the step except by chance
        // inside the HMAC, which is why they are not searched for. The base32 secret cannot
        // appear in hex at all, and the value is a bare flag.
        $this->assertStringNotContainsString(self::SECRET_A, $rows[0]->key);
        $this->assertSame(serialize(true), $rows[0]->value);
    }

    public function test_a_store_without_an_atomic_shared_add_is_refused(): void
    {
        $this->expectException(InvalidArgumentException::class);

        new ReplaySafeTwoFactorAuthenticationProvider(new Google2FA, Cache::store('array'), 'key');
    }

    public function test_a_missing_application_key_is_refused(): void
    {
        $this->expectException(InvalidArgumentException::class);

        new ReplaySafeTwoFactorAuthenticationProvider(new Google2FA, Cache::store('database'), '');
    }

    public function test_the_bound_provider_claims_on_the_database_store_whatever_cache_store_says(): void
    {
        // phpunit.xml sets CACHE_STORE=array, which is per process.
        $this->assertSame('array', config('cache.default'));

        $provider = $this->app->make(TwoFactorAuthenticationProvider::class);
        $cache = (new ReflectionProperty($provider, 'cache'))->getValue($provider);

        $this->assertInstanceOf(ReplaySafeTwoFactorAuthenticationProvider::class, $provider);
        $this->assertInstanceOf(DatabaseStore::class, $cache->getStore());
    }

    private function code(string $secret, int $step): string
    {
        return (new Google2FA)->oathTotp($secret, $step);
    }

    private function providerAt(int $step): ReplaySafeTwoFactorAuthenticationProvider
    {
        $engine = new class($step) extends Google2FA
        {
            public function __construct(private readonly int $pinnedStep) {}

            public function getTimestamp(): int
            {
                return $this->pinnedStep;
            }
        };

        return new ReplaySafeTwoFactorAuthenticationProvider($engine, Cache::store('database'), (string) config('app.key'));
    }
}
