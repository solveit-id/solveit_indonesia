<?php

namespace App\Services;

use Laravel\Fortify\TwoFactorAuthenticationProvider;

/**
 * Fortify's TOTP check with a replay cache that holds.
 *
 * Fortify asks google2fa for "a code newer than the last one used", passing null when the
 * code was never used. google2fa then answers `true` instead of the step the code matched,
 * and Fortify caches the current step. A code from the next step, which the window accepts
 * for clock drift, is thereby cached one step too early and is accepted a second time, in
 * another session, while it is still inside the window. Its cache entry also lived 60
 * seconds, shorter than the 90 seconds such a code stays valid.
 *
 * Here the oldest possible timestamp (0) is passed instead of null, so google2fa always
 * returns the matched step and that is what is cached, for the code's whole validity span.
 * Found by the admin real-browser tests (B3.2b); regression test in
 * tests/Feature/Admin/AdminSignInTest.php.
 */
class ReplaySafeTwoFactorAuthenticationProvider extends TwoFactorAuthenticationProvider
{
    /**
     * @param  string  $secret
     * @param  string  $code
     */
    public function verify(#[\SensitiveParameter] $secret, #[\SensitiveParameter] $code): bool
    {
        if (is_int($customWindow = config('fortify-options.two-factor-authentication.window'))) {
            $this->engine->setWindow($customWindow);
        }

        $key = 'fortify.2fa_codes.'.md5($code);
        $lastUsedStep = $this->cache?->get($key);

        $matchedStep = $this->engine->verifyKeyNewer($secret, $code, is_int($lastUsedStep) ? $lastUsedStep : 0);

        if (! is_int($matchedStep)) {
            return false;
        }

        // A code is accepted from (current - window) to (current + window): keep it that long.
        $window = $this->engine->getWindow() ?? 1;
        $this->cache?->put($key, $matchedStep, (2 * $window + 1) * $this->engine->getKeyRegeneration());

        return true;
    }
}
