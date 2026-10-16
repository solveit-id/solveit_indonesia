<?php

namespace Tests\Support;

use App\Enums\AdminRole;
use App\Models\User;
use Illuminate\Testing\TestResponse;
use Laravel\Fortify\Fortify;
use PragmaRX\Google2FA\Google2FA;

/**
 * Talks to the admin API the way the admin application in a browser will: one cookie jar
 * per client (browser), the admin Origin on every request, and the X-XSRF-TOKEN header
 * copied from the XSRF-TOKEN cookie. Nothing is faked: the real admin middleware group,
 * database sessions, request-forgery check, Fortify, and TOTP verification run.
 *
 * Laravel's test client keeps the auth guard and the session store in memory between
 * requests; a browser keeps only its cookies. Before each request that state is reset,
 * so a request is authenticated only by the cookies it carries.
 */
trait InteractsWithAdminApi
{
    /** @var array<string, array<string, string>> */
    private array $adminCookieJars = [];

    private string $adminClient = 'browser';

    /** @var array<int, int> Last TOTP time step used per account in this test. */
    private array $usedTotpSteps = [];

    protected const ADMIN_PASSWORD = 'correct horse battery staple';

    /**
     * Switch to another browser with its own cookies.
     */
    protected function usingAdminClient(string $client): static
    {
        $this->adminClient = $client;

        return $this;
    }

    /**
     * @param  array<string, mixed>  $data
     * @param  array<string, string|null>  $headers  null removes a default header
     */
    protected function adminRequest(string $method, string $path, array $data = [], array $headers = [], bool $sendXsrf = true): TestResponse
    {
        $this->app['auth']->forgetGuards();
        // The database session handler reads the user ID from this singleton.
        $this->app->forgetInstance('auth.driver');
        $this->app['session']->forgetDrivers();
        $this->app->forgetInstance('session.store');
        // Routes keep their controller instances, and Fortify's controllers hold the guard
        // (and through it the session store) they were built with.
        foreach ($this->app['router']->getRoutes() as $route) {
            $route->flushController();
        }

        $jar = $this->adminCookieJars[$this->adminClient] ?? [];

        $headers = ['Origin' => (string) config('admin.url'), ...$headers];

        if ($sendXsrf && isset($jar['XSRF-TOKEN'])) {
            $headers['X-XSRF-TOKEN'] ??= $jar['XSRF-TOKEN'];
        }

        $this->defaultCookies = [];
        $this->unencryptedCookies = $jar;

        $response = $this->withCredentials()->json(
            $method,
            '/api/v1/admin/'.ltrim($path, '/'),
            $data,
            array_filter($headers, fn (?string $value): bool => $value !== null),
        );

        foreach ($response->headers->getCookies() as $cookie) {
            $expires = $cookie->getExpiresTime();

            if ($expires !== 0 && $expires <= now()->getTimestamp()) {
                unset($jar[$cookie->getName()]);
            } else {
                $jar[$cookie->getName()] = (string) $cookie->getValue();
            }
        }

        $this->adminCookieJars[$this->adminClient] = $jar;

        return $response;
    }

    /**
     * @return array<string, string>
     */
    protected function adminCookies(): array
    {
        return $this->adminCookieJars[$this->adminClient] ?? [];
    }

    protected function forgetAdminCookie(string $name): void
    {
        unset($this->adminCookieJars[$this->adminClient][$name]);
    }

    protected function setAdminCookie(string $name, string $value): void
    {
        $this->adminCookieJars[$this->adminClient][$name] = $value;
    }

    /**
     * An activated account with a known password and a confirmed authenticator.
     */
    protected function createActiveAdmin(?AdminRole $role = null): User
    {
        $factory = User::factory()->withPassword(self::ADMIN_PASSWORD);

        return $role === null ? $factory->activeAdmin()->create() : $factory->activeAdmin($role)->create();
    }

    /**
     * A valid TOTP code that has not been used in this test: the current 30-second step,
     * or the next one when the current step was already used (the server accepts one step
     * of drift and refuses a code it has seen).
     */
    protected function freshTotpCode(User $user): string
    {
        $google2fa = new Google2FA;
        $step = max($google2fa->getTimestamp(), ($this->usedTotpSteps[$user->getKey()] ?? -1) + 1);
        $this->usedTotpSteps[$user->getKey()] = $step;

        return $google2fa->oathTotp($this->totpSecret($user), $step);
    }

    protected function totpSecret(User $user): string
    {
        return Fortify::currentEncrypter()->decrypt($user->fresh()->two_factor_secret);
    }

    /**
     * Full sign-in: CSRF cookie, password, TOTP.
     */
    protected function signIn(User $user, string $password = self::ADMIN_PASSWORD): TestResponse
    {
        $this->adminRequest('GET', 'auth/csrf-cookie')->assertNoContent();
        $this->adminRequest('POST', 'auth/login', ['email' => $user->email, 'password' => $password])
            ->assertOk()
            ->assertExactJson(['two_factor' => true]);

        return $this->adminRequest('POST', 'auth/two-factor-challenge', ['code' => $this->freshTotpCode($user)])->assertNoContent();
    }
}
