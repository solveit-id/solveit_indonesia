<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;

/**
 * First middleware of the "admin" group: decides whether a request may reach the admin
 * API at all, before a session is started.
 *
 * - Host must be the admin origin's host (config('admin.url')): on any other host, such
 *   as the public website, the admin API does not exist (404). The gateway refuses these
 *   paths on the public listener too; this check does not depend on it.
 * - The browser boundary is same-origin. A request whose Origin is another origin, or
 *   whose Sec-Fetch-Site is cross-site or same-site (the public website is same-site),
 *   gets 403. Every write must carry the admin Origin: browsers send it on all non-GET
 *   requests, unless the page sets Referrer-Policy: no-referrer, which the admin
 *   application must not (use same-origin).
 * - Responses are JSON and never cached.
 * - Without the database session driver the admin API refuses to run (503): session
 *   revocation (suspension, role change, credential reset, sign-out elsewhere) would
 *   otherwise silently do nothing. config/session.php fixes the driver; this check
 *   catches a runtime override.
 */
class AdminRequestBoundary
{
    /**
     * @param  Closure(Request): Response  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        if (config('session.driver') !== 'database') {
            Log::critical('Admin API refused a request: the session driver is not "database".');

            return $this->noStore(new JsonResponse(['message' => 'The admin API is unavailable.'], 503));
        }

        if (! $this->isAdminHost($request)) {
            return $this->noStore(new JsonResponse(['message' => 'Not Found.'], 404));
        }

        if (! $this->isSameOrigin($request)) {
            return $this->noStore(new JsonResponse(['message' => 'Cross-origin requests to the admin API are not allowed.'], 403));
        }

        $request->headers->set('Accept', 'application/json');

        return $this->noStore($next($request));
    }

    private function isAdminHost(Request $request): bool
    {
        return strcasecmp($request->getHttpHost(), $this->adminAuthority()) === 0;
    }

    private function isSameOrigin(Request $request): bool
    {
        $fetchSite = $request->headers->get('Sec-Fetch-Site');

        if ($fetchSite !== null && ! in_array($fetchSite, ['same-origin', 'none'], true)) {
            return false;
        }

        $origin = $request->headers->get('Origin');

        if ($origin !== null) {
            return strcasecmp($origin, $this->adminOrigin()) === 0;
        }

        return $request->isMethodSafe();
    }

    /**
     * The admin origin as browsers serialize it in the Origin header.
     */
    private function adminOrigin(): string
    {
        return (parse_url((string) config('admin.url'), PHP_URL_SCHEME) ?? 'http').'://'.$this->adminAuthority();
    }

    /**
     * host[:port] of the admin origin, without the default port of its scheme.
     */
    private function adminAuthority(): string
    {
        $url = parse_url((string) config('admin.url'));
        $host = $url['host'] ?? '';
        $port = $url['port'] ?? null;
        $defaultPort = ($url['scheme'] ?? 'http') === 'https' ? 443 : 80;

        return $port === null || $port === $defaultPort ? $host : $host.':'.$port;
    }

    private function noStore(Response $response): Response
    {
        $response->headers->set('Cache-Control', 'no-store, private');

        return $response;
    }
}
