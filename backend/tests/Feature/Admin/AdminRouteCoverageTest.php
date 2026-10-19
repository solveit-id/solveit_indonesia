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
        ...self::OWNER_READS,
        ...self::OWNER_WRITES,
        ...self::INQUIRY_READS,
        ...self::INQUIRY_WRITES,
        ...self::INQUIRY_CONTACT,
    ];

    /**
     * Tier 3 routes of user administration and audit reading (B3.1b), with the exact
     * permission each must ask for. Only the owner role holds these permissions.
     */
    private const OWNER_READS = [
        'GET api/v1/admin/users' => 'users.view',
        'GET api/v1/admin/users/{user}' => 'users.view',
        'GET api/v1/admin/invitations' => 'users.view',
        'GET api/v1/admin/invitations/{invitation}' => 'users.view',
        'GET api/v1/admin/audit-events' => 'audit.view-all',
    ];

    /**
     * Owner writes: their permission, then a fresh password confirmation, and their own limit.
     */
    private const OWNER_WRITES = [
        'POST api/v1/admin/invitations' => 'users.invite',
        'DELETE api/v1/admin/invitations/{invitation}' => 'users.invite',
        'PUT api/v1/admin/users/{user}/role' => 'users.change-role',
        'POST api/v1/admin/users/{user}/suspension' => 'users.suspend',
        'DELETE api/v1/admin/users/{user}/suspension' => 'users.suspend',
        'POST api/v1/admin/users/{user}/credential-reset' => 'users.reset-credentials',
    ];

    /**
     * Tier 3 routes of inquiry management (B4a), with the exact permission each asks for.
     * Reads show contacts masked.
     */
    private const INQUIRY_READS = [
        'GET api/v1/admin/inquiries' => 'inquiries.view',
        'GET api/v1/admin/inquiries/{inquiry}' => 'inquiries.view',
        'GET api/v1/admin/inquiries/{inquiry}/status-changes' => 'inquiries.view',
        'GET api/v1/admin/inquiries/{inquiry}/notes' => 'inquiries.view',
    ];

    /**
     * Inquiry workflow writes: their permission and their own limit.
     */
    private const INQUIRY_WRITES = [
        'PUT api/v1/admin/inquiries/{inquiry}/status' => 'inquiries.change-status',
        'POST api/v1/admin/inquiries/{inquiry}/notes' => 'inquiries.add-note',
    ];

    /**
     * Opening a full contact: its permission, then a fresh password confirmation, and the
     * contact limit.
     */
    private const INQUIRY_CONTACT = [
        'POST api/v1/admin/inquiries/{inquiry}/contact-reveal' => 'inquiries.reveal-contact',
    ];

    /**
     * Middleware every admin route has, in this order, before anything else.
     */
    private const ADMIN_GROUP = 'admin';

    public function test_every_admin_route_is_classified_exactly_once(): void
    {
        $classified = [...self::PUBLIC_AUTH, ...self::PRE_ACTIVATION, ...self::authenticated()];

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
        foreach (self::authenticated() as $key) {
            $middleware = $this->adminRoutes()[$key]->gatherMiddleware();

            foreach (['auth:web', 'auth.session', 'admin.active', 'admin.session-lifetime', 'throttle:admin-account'] as $required) {
                $this->assertContains($required, $middleware, "{$key} lacks {$required}");
            }

            $this->assertNotEmpty(preg_grep('/^can:/', $middleware), "{$key} has no permission check");
            $this->assertNotContains('admin.guest', $middleware);
        }

        $this->assertContains('password.confirm', $this->adminRoutes()['POST api/v1/admin/me/two-factor-recovery-codes']->gatherMiddleware());
    }

    public function test_owner_routes_ask_for_their_exact_permission_and_writes_for_a_fresh_password(): void
    {
        foreach ([...self::OWNER_READS, ...self::OWNER_WRITES] as $key => $permission) {
            $middleware = $this->adminRoutes()[$key]->gatherMiddleware();

            $this->assertSame(["can:{$permission}"], array_values(preg_grep('/^can:/', $middleware)), "{$key} must ask for exactly {$permission}");
            $this->assertNotContains('can:account.manage-own', $middleware);
        }

        foreach (array_keys(self::OWNER_WRITES) as $key) {
            $middleware = $this->adminRoutes()[$key]->gatherMiddleware();

            $this->assertContains('throttle:admin-administration', $middleware, "{$key} lacks the administration limit");
            $this->assertContains('password.confirm', $middleware, "{$key} lacks password confirmation");
            $this->assertLessThan(
                array_search('password.confirm', $middleware, true),
                array_search('can:'.self::OWNER_WRITES[$key], $middleware, true),
                "{$key} must check the permission before asking for a password",
            );
        }

        foreach (array_keys(self::OWNER_READS) as $key) {
            $this->assertNotContains('password.confirm', $this->adminRoutes()[$key]->gatherMiddleware());
        }
    }

    public function test_inquiry_routes_ask_for_their_exact_permission_and_contacts_for_a_fresh_password(): void
    {
        foreach ([...self::INQUIRY_READS, ...self::INQUIRY_WRITES, ...self::INQUIRY_CONTACT] as $key => $permission) {
            $middleware = $this->adminRoutes()[$key]->gatherMiddleware();

            $this->assertSame(["can:{$permission}"], array_values(preg_grep('/^can:/', $middleware)), "{$key} must ask for exactly {$permission}");
        }

        foreach (array_keys(self::INQUIRY_READS) as $key) {
            $middleware = $this->adminRoutes()[$key]->gatherMiddleware();

            $this->assertNotContains('password.confirm', $middleware, "{$key} is a read");
            $this->assertEmpty(preg_grep('/^throttle:admin-inquiry-/', $middleware), "{$key} is a read");
        }

        foreach (array_keys(self::INQUIRY_WRITES) as $key) {
            $this->assertContains('throttle:admin-inquiry-write', $this->adminRoutes()[$key]->gatherMiddleware(), "{$key} lacks the inquiry write limit");
        }

        foreach (self::INQUIRY_CONTACT as $key => $permission) {
            $middleware = $this->adminRoutes()[$key]->gatherMiddleware();

            $this->assertContains('throttle:admin-inquiry-contact', $middleware, "{$key} lacks the contact limit");
            $this->assertContains('password.confirm', $middleware, "{$key} lacks password confirmation");
            $this->assertLessThan(
                array_search('password.confirm', $middleware, true),
                array_search("can:{$permission}", $middleware, true),
                "{$key} must check the permission before asking for a password",
            );
        }
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
     * @return list<string>
     */
    private static function authenticated(): array
    {
        return array_map(
            fn (int|string $key, string $value): string => is_string($key) ? $key : $value,
            array_keys(self::AUTHENTICATED),
            self::AUTHENTICATED,
        );
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
