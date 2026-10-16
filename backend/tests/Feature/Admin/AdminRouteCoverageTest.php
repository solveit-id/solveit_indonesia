<?php

namespace Tests\Feature\Admin;

use Illuminate\Routing\Route;
use Illuminate\Support\Facades\Route as Router;
use Tests\TestCase;

/**
 * Every admin route is reviewed into exactly one tier, and each tier carries its
 * protections. A new route fails here until it is listed with its tier.
 */
class AdminRouteCoverageTest extends TestCase
{
    /**
     * Tier 1: reachable without an account. Reviewed allowlist.
     */
    private const PUBLIC_AUTH = [
        'GET api/v1/admin/auth/csrf-cookie',
        'POST api/v1/admin/auth/login',
        'POST api/v1/admin/auth/two-factor-challenge',
    ];

    /**
     * Tier 2: pre-activation, reachable without an account, grants no permission.
     */
    private const PRE_ACTIVATION = [
        'POST api/v1/admin/access-links/inspect',
        'POST api/v1/admin/access-links/redeem',
        'POST api/v1/admin/access-links/confirm',
    ];

    /**
     * Tier 3: signed in, active, inside the session limit, with a permission.
     */
    private const AUTHENTICATED = [
        'POST api/v1/admin/auth/logout',
        'POST api/v1/admin/auth/confirm-password',
        'GET api/v1/admin/me',
        'PUT api/v1/admin/me/password',
        'POST api/v1/admin/me/two-factor-recovery-codes',
        'GET api/v1/admin/me/sessions',
        'DELETE api/v1/admin/me/sessions',
        'DELETE api/v1/admin/me/sessions/{session}',
    ];

    /**
     * Middleware every admin route has, in this order, before anything else.
     */
    private const ADMIN_GROUP = 'admin';

    public function test_every_admin_route_is_classified_exactly_once(): void
    {
        $classified = [...self::PUBLIC_AUTH, ...self::PRE_ACTIVATION, ...self::AUTHENTICATED];

        $this->assertSame(count($classified), count(array_unique($classified)));
        $this->assertEqualsCanonicalizing($classified, array_keys($this->adminRoutes()));
    }

    public function test_every_admin_route_uses_the_admin_group_and_a_rate_limit(): void
    {
        foreach ($this->adminRoutes() as $key => $route) {
            $middleware = $route->gatherMiddleware();

            $this->assertSame(self::ADMIN_GROUP, $middleware[0] ?? null, "{$key} must start with the admin group");
            $this->assertNotEmpty(preg_grep('/^throttle:admin-/', $middleware), "{$key} has no admin rate limit");
            $this->assertNotContains('web', $middleware, "{$key} must not use the web group");
            $this->assertNotContains('api', $middleware, "{$key} must not use the stateless api group");
        }
    }

    public function test_unauthenticated_tiers_are_guest_only_except_the_csrf_cookie(): void
    {
        foreach ([...self::PUBLIC_AUTH, ...self::PRE_ACTIVATION] as $key) {
            $middleware = $this->adminRoutes()[$key]->gatherMiddleware();

            $this->assertEmpty(preg_grep('/^(auth|can:)/', $middleware), "{$key} must not look like a privileged route");

            if ($key !== 'GET api/v1/admin/auth/csrf-cookie') {
                $this->assertContains('admin.guest', $middleware, "{$key} must refuse a signed-in session");
            }
        }

        $this->assertContains('admin.login-challenge', $this->adminRoutes()['POST api/v1/admin/auth/two-factor-challenge']->gatherMiddleware());
    }

    public function test_authenticated_routes_carry_the_full_protection_and_a_permission(): void
    {
        foreach (self::AUTHENTICATED as $key) {
            $middleware = $this->adminRoutes()[$key]->gatherMiddleware();

            foreach (['auth:web', 'auth.session', 'admin.active', 'admin.session-lifetime', 'throttle:admin-account'] as $required) {
                $this->assertContains($required, $middleware, "{$key} lacks {$required}");
            }

            $this->assertNotEmpty(preg_grep('/^can:/', $middleware), "{$key} has no permission check");
            $this->assertNotContains('admin.guest', $middleware);
        }

        $this->assertContains('password.confirm', $this->adminRoutes()['POST api/v1/admin/me/two-factor-recovery-codes']->gatherMiddleware());
    }

    public function test_no_other_route_starts_a_session(): void
    {
        foreach (Router::getRoutes()->getRoutes() as $route) {
            if (str_starts_with($route->uri(), 'api/v1/admin')) {
                continue;
            }

            $middleware = $route->gatherMiddleware();
            $this->assertNotContains('web', $middleware, "{$route->uri()} uses the session-backed web group");
            $this->assertNotContains(self::ADMIN_GROUP, $middleware, "{$route->uri()} uses the admin group outside /api/v1/admin");
        }
    }

    /**
     * @return array<string, Route>
     */
    private function adminRoutes(): array
    {
        $routes = [];

        foreach (Router::getRoutes()->getRoutes() as $route) {
            if (! str_starts_with($route->uri(), 'api/v1/admin')) {
                continue;
            }

            foreach (array_diff($route->methods(), ['HEAD']) as $method) {
                $routes["{$method} {$route->uri()}"] = $route;
            }
        }

        return $routes;
    }
}
