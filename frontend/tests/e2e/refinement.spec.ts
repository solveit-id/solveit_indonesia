import { projects } from "../../src/data/projects";
import { expect, type Page, test } from "./fixtures";

const scrollTo = (page: Page, y: number) => page.evaluate((top) => window.scrollTo(0, top), y);
const bootState = (page: Page) =>
  page.evaluate(() => document.documentElement.dataset.boot ?? "none");
const style = (page: Page, selector: string, property: string) =>
  page
    .locator(selector)
    .first()
    .evaluate((el, prop) => getComputedStyle(el).getPropertyValue(prop), property);

test.describe("branded load sequence", () => {
  test.use({ bootLoader: true });

  test("covers the first paint, assembles, then leaves for the ready page", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    // Timestamps from inside the page: first frame of the entrance, exit, done.
    await page.addInitScript(() => {
      const marks: Record<string, number> = {};
      (window as Window & { __boot?: Record<string, number> }).__boot = marks;
      document.addEventListener(
        "animationstart",
        (event) => {
          if (event.animationName.startsWith("boot-")) marks.start ??= performance.now();
        },
        true,
      );
      // <html> may not exist yet when init scripts run: watch the document.
      new MutationObserver(() => {
        const state = document.documentElement?.dataset.boot;
        if (state) marks[state] ??= performance.now();
      }).observe(document, { attributes: true, attributeFilter: ["data-boot"], subtree: true });
    });
    await page.goto("/", { waitUntil: "commit" });
    const loader = page.locator(".boot-loader");
    // Armed before first paint and drawn fullscreen above the page.
    // Sampled in one read while the overlay is up (the whole sequence is
    // about 1.3 s, shorter than a few separate round trips).
    const shown = await page.waitForFunction(() => {
      const el = document.querySelector<HTMLElement>(".boot-loader");
      if (document.documentElement.dataset.boot !== "intro" || !el) return null;
      const rect = el.getBoundingClientRect();
      const css = getComputedStyle(el);
      if (css.display === "none" || rect.width === 0) return null;
      return {
        width: rect.width,
        height: rect.height,
        pointerEvents: css.pointerEvents,
        headline: !!document.querySelector("h1"),
        viewport: { width: innerWidth, height: innerHeight },
      };
    });
    const sample = (await shown.jsonValue())!;
    expect(sample.width).toBeCloseTo(sample.viewport.width, 0);
    expect(sample.height).toBeCloseTo(sample.viewport.height, 0);
    // The page underneath is complete and never blocked: no pointer capture.
    expect(sample.pointerEvents).toBe("none");
    expect(sample.headline).toBe(true);
    // Exit, then gone. Contract: exit no later than 2.6 s after the entrance's
    // first frame (plus a frame of slack), and gone after the 0.64 s wipe.
    await expect(page.locator("html")).toHaveAttribute("data-boot", "done", { timeout: 15_000 });
    await expect(loader).toBeHidden();
    const marks = await page.evaluate(
      () => (window as Window & { __boot?: Record<string, number> }).__boot!,
    );
    expect(marks.exit! - marks.start!).toBeLessThanOrEqual(2600 + 50);
    expect(marks.exit! - marks.start!).toBeGreaterThan(400);
    expect(marks.done! - marks.exit!).toBeLessThan(1200);
    await page.locator("html[data-hydrated]").waitFor({ state: "attached" });
    expect(errors).toEqual([]);
  });

  test("full sequence on a tab's first load, short on a reload, full again in a new tab", async ({
    page,
    context,
  }) => {
    const timeline = () =>
      page.waitForFunction(() => {
        const marks = (window as Window & { __boot?: Record<string, number> }).__boot;
        return marks?.done ? marks : null;
      });
    await page.addInitScript(() => {
      const marks: Record<string, number> = {};
      (window as Window & { __boot?: Record<string, number> }).__boot = marks;
      document.addEventListener(
        "animationstart",
        (event) => {
          if (event.animationName.startsWith("boot-")) marks.start ??= performance.now();
        },
        true,
      );
      new MutationObserver(() => {
        const state = document.documentElement?.dataset.boot;
        if (state) marks[state] ??= performance.now();
      }).observe(document, { attributes: true, attributeFilter: ["data-boot"], subtree: true });
    });
    await page.goto("/portofolio", { waitUntil: "commit" });
    await expect(page.locator("html")).toHaveAttribute("data-boot-mode", "full");
    const full = (await (await timeline()).jsonValue())!;
    await page.reload({ waitUntil: "commit" });
    await expect(page.locator("html")).toHaveAttribute("data-boot-mode", "short");
    const short = (await (await timeline()).jsonValue())!;
    // Short: the same beats, wiping as soon as the capsules lock (~0.6 s in all).
    expect(short.exit! - short.start!).toBeLessThan(full.exit! - full.start!);
    expect(short.done! - short.start!).toBeLessThan(1000);
    // Session storage is per tab: a new tab gets the full sequence again.
    const other = await context.newPage();
    await other.goto("/portofolio", { waitUntil: "commit" });
    await expect(other.locator("html")).toHaveAttribute("data-boot-mode", "full");
    await other.close();
  });

  test("plays once per document: client navigation never shows it", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-boot", "done", { timeout: 5000 });
    await page.getByRole("contentinfo").getByRole("link", { name: "Layanan", exact: true }).click();
    await expect(page).toHaveURL(/\/layanan$/);
    expect(await bootState(page)).toBe("done");
    await expect(page.locator(".boot-loader")).toBeHidden();
  });

  test("uses the chosen theme from the first frame, on English routes too", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("solveit-theme", "dark"));
    await page.goto("/en/portfolio", { waitUntil: "commit" });
    await expect(page.locator("html")).toHaveAttribute("data-boot", "intro");
    await expect(page.locator(".boot-loader")).toBeVisible();
    // The sheet is the dark paper, never a light flash.
    expect(await style(page, ".boot-sheet:not(.boot-sheet-accent)", "background-color")).toBe(
      "rgb(5, 15, 34)",
    );
    await expect(page.locator("html")).toHaveAttribute("data-boot", "done", { timeout: 5000 });
  });

  test("under reduced motion it is a still mark and a short fade", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.goto("/", { waitUntil: "commit" });
    await expect(page.locator("html")).toHaveAttribute("data-boot", /intro|exit|done/);
    await expect(page.locator("html")).toHaveAttribute("data-boot", "done", { timeout: 15_000 });
    // No spatial movement: the capsules never run their arrival.
    const moved = await page.evaluate(() =>
      document.getAnimations().some((a) => (a as CSSAnimation).animationName === "boot-capsule-in"),
    );
    expect(moved).toBe(false);
    await expect(page.locator(".boot-loader")).toBeHidden();
    await context.close();
  });

  test("never appears without JavaScript", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto("/portofolio/sistem-antrean-klinik");
    await expect(page.locator(".boot-loader")).toBeHidden();
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Teknologi yang diusulkan." })).toBeVisible();
    await context.close();
  });

  test("still shows and still leaves on a slow connection", async ({ page, browserName }) => {
    test.skip(
      browserName !== "chromium",
      "Network throttling uses the Chromium DevTools protocol.",
    );
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 300,
      downloadThroughput: (700 * 1024) / 8,
      uploadThroughput: (300 * 1024) / 8,
    });
    await page.goto("/kontak", { waitUntil: "commit" });
    await expect(page.locator("html")).toHaveAttribute("data-boot", "intro");
    await expect(page.locator(".boot-loader")).toBeVisible({ timeout: 10_000 });
    await expect(page.locator("html")).toHaveAttribute("data-boot", "done", { timeout: 15_000 });
    await expect(page.locator("h1")).toBeVisible();
  });
});

test.describe("preference switches", () => {
  test("the theme icons roll through the button and it answers above the sweep", async ({
    page,
  }) => {
    await page.goto("/");
    const toggle = page.getByRole("button", { name: "Tema gelap" });
    expect(await style(page, ".theme-toggle", "view-transition-name")).toBe("theme-toggle");
    expect(await style(page, ".theme-toggle", "cursor")).toBe("pointer");
    await toggle.click();
    // Mid-roll the sun is on its way out: translated, not just faded.
    const moving = await toggle
      .locator(".theme-icon-sun")
      .evaluate((el) => getComputedStyle(el).transform);
    expect(moving).not.toBe("none");
    await expect
      .poll(() => toggle.locator(".theme-icon-moon").evaluate((el) => getComputedStyle(el).opacity))
      .toBe("1");
    // At rest (pointer away) the moon sits upright in the centre.
    await page.mouse.move(5, 400);
    await expect
      .poll(() =>
        toggle.locator(".theme-icon-moon").evaluate((el) => getComputedStyle(el).transform),
      )
      .toMatch(/^(none|matrix\(1, 0, 0, 1, 0, 0\))$/);
  });

  test("language labels roll in opposite directions on a switch", async ({ page, viewport }) => {
    test.skip((viewport?.width ?? 0) < 640, "The segmented switch is shown from 640px.");
    await page.goto("/layanan");
    const switcher = page.getByRole("banner").getByRole("navigation", { name: "Bahasa" });
    expect(await style(page, ".lang-option", "cursor")).toBe("pointer");
    // Record animations as they start: they finish in about half a second.
    await page.evaluate(() => {
      const seen: string[] = [];
      (window as Window & { __rolls?: string[] }).__rolls = seen;
      document.addEventListener("animationstart", (event) => seen.push(event.animationName));
    });
    await switcher.getByRole("link", { name: "English" }).click();
    const english = page.getByRole("banner").getByRole("navigation", { name: "Language" });
    await expect(english).toHaveAttribute("data-moved", "true");
    await expect
      .poll(() => page.evaluate(() => (window as Window & { __rolls?: string[] }).__rolls))
      .toEqual(expect.arrayContaining(["roll-up", "roll-down"]));
    await expect(page).toHaveURL(/\/en\/services$/);
  });

  test("the phone language toggle rolls the next label up into view", async ({
    page,
    viewport,
  }) => {
    test.skip((viewport?.width ?? 0) >= 640, "The single toggle is shown below 640px.");
    await page.goto("/layanan");
    const toggle = page.getByRole("banner").locator(".lang-toggle");
    await toggle.click();
    await expect(toggle).toHaveAttribute("data-moved", "true");
    await expect(page).toHaveURL(/\/en\/services$/);
    await expect(toggle.locator('[data-label="id"]')).toHaveCSS("opacity", "1");
  });
});

/** inset() edges as numbers, rounded to 0.1, so engines' float noise is ignored. */
const insetOf = async (page: Page, selector: string) =>
  (await style(page, selector, "clip-path"))
    .match(/-?[\d.]+/g)
    ?.map((value) => Math.round(Number(value) * 10) / 10)
    .join(" ");

test.describe("adaptive header", () => {
  test("folds the wordmark into the mark and back", async ({ page, viewport }) => {
    await page.goto("/");
    const header = page.locator("header.site-header");
    await expect(header).toHaveAttribute("data-compact", "false");
    expect(await insetOf(page, ".lockup-word")).toBe("0 0 0 28.6");
    await scrollTo(page, 700);
    await expect(header).toHaveAttribute("data-compact", "true");
    await expect
      .poll(() => style(page, ".lockup-word", "opacity"))
      .toBe((viewport?.width ?? 0) >= 768 ? "1" : "0");
    await expect
      .poll(() => insetOf(page, ".lockup-word"))
      .toBe((viewport?.width ?? 0) >= 768 ? "0 0 0 100" : "0 71.4 0 28.6");
    // The logo link still leads home from its condensed mark.
    const hit = (await page.locator(".logo-hit").boundingBox())!;
    expect(hit.width).toBeLessThan(80);
    await scrollTo(page, 0);
    await expect(header).toHaveAttribute("data-compact", "false");
    await expect.poll(() => insetOf(page, ".lockup-word")).toBe("0 0 0 28.6");
  });

  test("outside the floating capsule the page stays clickable", async ({ page, viewport }) => {
    test.skip((viewport?.width ?? 0) < 768, "The floating capsule starts at 768px.");
    await page.goto("/");
    await scrollTo(page, 700);
    await expect(page.locator("header.site-header")).toHaveAttribute("data-compact", "true");
    await page.waitForTimeout(700);
    // Where the wordmark used to be is now outside the capsule.
    const logo = (await page.locator(".header-logo").boundingBox())!;
    const target = await page.evaluate(
      ({ x, y }) => document.elementFromPoint(x, y)?.closest("header") === null,
      { x: logo.x + 8, y: logo.y + logo.height / 2 },
    );
    expect(target).toBe(true);
  });
});

test.describe("floating controls", () => {
  test("back-to-top sits beside the launcher and stays usable with the assistant open", async ({
    page,
    viewport,
  }) => {
    test.skip((viewport?.width ?? 0) < 640, "Phones get the modal bottom sheet instead.");
    await page.goto("/layanan");
    await scrollTo(page, 2400);
    const top = page.getByRole("button", { name: "Kembali ke atas" });
    await expect(top).toBeVisible();
    expect(await style(page, ".dock-top", "cursor")).toBe("pointer");
    await page.getByRole("button", { name: "Tanya Solveit" }).click();
    const dialog = page.getByRole("dialog", { name: "Asisten Solveit" });
    await expect(dialog).toBeVisible();
    await page.waitForTimeout(600);
    const topBox = (await top.boundingBox())!;
    const panelBox = (await dialog.boundingBox())!;
    // Never covered: entirely below the panel, and the topmost element at its centre.
    expect(topBox.y).toBeGreaterThanOrEqual(panelBox.y + panelBox.height);
    const own = await page.evaluate(
      ({ x, y }) => !!document.elementFromPoint(x, y)?.closest(".dock-top"),
      { x: topBox.x + topBox.width / 2, y: topBox.y + topBox.height / 2 },
    );
    expect(own).toBe(true);
    // The open launcher trims its empty tail ("Tutup" is shorter).
    const trim = await page
      .locator(".floating-dock")
      .evaluate((el) => parseFloat(getComputedStyle(el).getPropertyValue("--launcher-trim")));
    expect(trim).toBeGreaterThan(10);
    await top.click();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(5);
  });

  test("close controls answer with the danger colour, other controls with pointers", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Tanya Solveit" }).click();
    const dialog = page.getByRole("dialog", { name: "Asisten Solveit" });
    const close = dialog.getByRole("button", { name: "Tutup asisten" });
    await expect(close).toBeVisible();
    expect(await close.evaluate((el) => getComputedStyle(el).cursor)).toBe("pointer");
    await close.hover();
    await expect
      .poll(() => close.evaluate((el) => getComputedStyle(el).color))
      .toBe("rgb(180, 35, 24)");
    const restart = dialog.getByRole("button", { name: "Mulai ulang" });
    expect(await restart.evaluate((el) => getComputedStyle(el).cursor)).toBe("pointer");
    const send = dialog.getByRole("button", { name: "Kirim pertanyaan" });
    await expect(send).toBeDisabled();
    expect(await send.evaluate((el) => getComputedStyle(el).cursor)).toBe("not-allowed");
    const input = dialog.getByLabel("Tulis pertanyaan");
    expect(await input.evaluate((el) => getComputedStyle(el).cursor)).toBe("text");
  });
});

test.describe("case studies", () => {
  for (const project of projects) {
    for (const locale of ["id", "en"] as const) {
      const url =
        locale === "id" ? `/portofolio/${project.slugs.id}` : `/en/portfolio/${project.slugs.en}`;
      test(`${url} shows every proposed technology with its mark and name`, async ({ page }) => {
        await page.goto(url);
        const heading = locale === "id" ? "Teknologi yang diusulkan." : "Proposed technology.";
        const section = page.locator("section#technology");
        await expect(section.getByRole("heading", { name: heading })).toBeVisible();
        for (const name of project.technologies) {
          const badge = section.locator("[data-tech-badge]", { hasText: name });
          await expect(badge).toHaveCount(1);
          await expect(badge.locator("svg")).toHaveCount(1);
          expect(await badge.evaluate((el) => getComputedStyle(el).cursor)).toBe("auto");
        }
        // Badges inform; they are never links or buttons.
        await expect(section.locator("a, button")).toHaveCount(0);
        await expect(
          page.getByText(/Konsep demonstrasi|Demonstration concept/).first(),
        ).toBeVisible();
      });
    }
  }

  test("the chapter rail follows the reader and jumps to a chapter", async ({ page, viewport }) => {
    test.skip((viewport?.width ?? 0) < 1024, "The rail is shown from 1024px.");
    await page.goto("/portofolio/inventori-gudang-distribusi");
    const rail = page.getByRole("navigation", { name: "Bab studi kasus" });
    await rail.getByRole("link", { name: /Teknologi/ }).click();
    await expect(page).toHaveURL(/#technology$/);
    await expect(page.locator("section#technology")).toBeFocused();
    await expect(rail.getByRole("link", { name: /Teknologi/ })).toHaveAttribute(
      "aria-current",
      "location",
    );
    // Order of the story: context, problem, solution, system, flow, features, technology, measure.
    await expect(rail.getByRole("link")).toHaveText([
      /Konteks/,
      /Permasalahan/,
      /Solusi/,
      /Peta sistem/,
      /Alur utama/,
      /Fitur inti/,
      /Teknologi/,
      /Pengukuran/,
    ]);
  });
});
