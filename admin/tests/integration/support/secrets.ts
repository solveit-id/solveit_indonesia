import type { BrowserContext, Page } from "@playwright/test";

/**
 * Assertions about secrets that never print them. A normal `expect(x).not.toContain(secret)`
 * would write both values into the failure message and the CI log; these name the place only.
 */
export function assertAbsent(haystack: string, secrets: string[], where: string): void {
  if (secrets.some((secret) => secret !== "" && haystack.includes(secret))) {
    throw new Error(`A secret value was found in ${where}. (Values withheld from this message.)`);
  }
}

/** Browser storage, readable cookies, address, and history state of a page. */
export async function browserSurfaces(page: Page) {
  return page.evaluate(async () => {
    const databases =
      typeof indexedDB.databases === "function" ? (await indexedDB.databases()).length : 0;
    const caches_ = typeof caches === "undefined" ? 0 : (await caches.keys()).length;

    return {
      localKeys: Object.keys(localStorage),
      sessionKeys: Object.keys(sessionStorage),
      all: JSON.stringify({
        local: { ...localStorage },
        session: { ...sessionStorage },
        cookie: document.cookie,
        href: location.href,
        history: history.state,
      }),
      databases,
      caches: caches_,
    };
  });
}

/** Fails, without printing values, if any secret is in storage, cookies, URL, or history. */
export async function assertNoSecretsStored(
  page: Page,
  context: BrowserContext,
  secrets: string[],
): Promise<void> {
  const surfaces = await browserSurfaces(page);

  assertAbsent(surfaces.all, secrets, "browser storage, readable cookies, URL, or history state");
  // Cookie values the page cannot read (HttpOnly) are Laravel's own encrypted session.
  assertAbsent(
    JSON.stringify((await context.cookies()).map((cookie) => cookie.value)),
    secrets,
    "cookies",
  );

  const unexpected = surfaces.localKeys.filter(
    (key) => key !== "solveit-admin-theme" && key !== "solveit-admin-locale",
  );

  if (
    unexpected.length > 0 ||
    surfaces.sessionKeys.length > 0 ||
    surfaces.databases > 0 ||
    surfaces.caches > 0
  ) {
    throw new Error(
      `Browser storage holds more than the two display preferences: local ${unexpected.join(", ")}, session ${surfaces.sessionKeys.length}, IndexedDB ${surfaces.databases}, caches ${surfaces.caches}.`,
    );
  }
}

/** page.goto for a URL holding a secret: a failure reports the path only. */
export async function gotoWithSecret(page: Page, url: string): Promise<void> {
  try {
    await page.goto(url);
  } catch {
    throw new Error(`Navigation to ${new URL(url).pathname} failed (the full URL is withheld).`);
  }
}
