<?php

namespace App\Services;

use Illuminate\Cache\DatabaseStore;
use Illuminate\Cache\RedisStore;
use Illuminate\Cache\Repository;
use InvalidArgumentException;
use Laravel\Fortify\TwoFactorAuthenticationProvider;
use PragmaRX\Google2FA\Google2FA;

/**
 * Fortify's TOTP check with a one-time claim per authenticator and time step.
 *
 * Fortify keeps "codes already used" under md5(code) with a read, then a verify, then a
 * write. Found by the admin real-browser tests and the B3.2b security review:
 *
 * - a code from the next step, accepted for clock drift, was cached one step too early and
 *   could be used a second time in another session (google2fa answers `true` instead of the
 *   matched step when no earlier use is passed);
 * - the key was the six digits alone, so another account's use of the same digits rejected
 *   a person's own valid code;
 * - read and write were separate, so two simultaneous requests both saw "unused" and both
 *   signed in (reproduced in two PHP processes on MySQL in 20 of 20 rounds).
 *
 * Here a code is accepted only by claiming (authenticator, matched step) with one atomic
 * `add` on a shared store. The key is an HMAC of the secret and the step, keyed from the
 * application key, so the cache holds no code, secret, or account data, and a replaced
 * authenticator (new secret) starts with no claims. A claim outlives the code: a code is
 * accepted from (step - window) to (step + window), at most 90 s with the approved window of
 * one step, and the claim lasts 120 s. The drift window itself is unchanged.
 *
 * Only a store whose `add` is atomic across processes is accepted (MySQL INSERT IGNORE on
 * the cache key, or Redis); anything else, such as the per-process array store, is refused
 * when the provider is built, so the check fails closed instead of silently weakening.
 * Regression tests: tests/Feature/Admin/TotpReplayProtectionTest.php and
 * tests/Feature/Admin/TotpReplayConcurrencyTest.php.
 */
class ReplaySafeTwoFactorAuthenticationProvider extends TwoFactorAuthenticationProvider
{
    /** Cache key prefix of the claims (the store adds its own prefix). */
    public const CLAIM_PREFIX = 'admin.totp-claim.';

    private readonly string $claimKey;

    public function __construct(Google2FA $engine, Repository $cache, string $applicationKey)
    {
        $store = $cache->getStore();

        if (! $store instanceof DatabaseStore && ! $store instanceof RedisStore) {
            throw new InvalidArgumentException('TOTP replay protection needs a shared cache store with an atomic add (database or redis).');
        }

        if ($applicationKey === '') {
            throw new InvalidArgumentException('TOTP replay protection needs the application key.');
        }

        parent::__construct($engine, $cache);

        // A key used for nothing else, so the claim keys reveal nothing about APP_KEY.
        $this->claimKey = hash_hmac('sha256', 'admin-totp-replay-claim', $applicationKey, true);
    }

    /**
     * @param  string  $secret
     * @param  string  $code
     */
    public function verify(#[\SensitiveParameter] $secret, #[\SensitiveParameter] $code): bool
    {
        if (is_int($customWindow = config('fortify-options.two-factor-authentication.window'))) {
            $this->engine->setWindow($customWindow);
        }

        $window = (int) $this->engine->getWindow();
        $currentStep = (int) $this->engine->getTimestamp();

        for ($step = $currentStep - $window; $step <= $currentStep + $window; $step++) {
            if (hash_equals($this->engine->oathTotp($secret, $step), (string) $code) && $this->claim($secret, $step)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Take the one-time claim on (authenticator, step). True for exactly one caller.
     */
    private function claim(#[\SensitiveParameter] string $secret, int $step): bool
    {
        $lifetime = (2 * (int) $this->engine->getWindow() + 2) * (int) $this->engine->getKeyRegeneration();

        return $this->cache->add(self::CLAIM_PREFIX.hash_hmac('sha256', $secret.'|'.$step, $this->claimKey), true, $lifetime);
    }
}
