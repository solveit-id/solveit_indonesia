import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "./fixtures";

const scrollTo = (page: Page, y: number) => page.evaluate((top) => window.scrollTo(0, top), y);
const scrollY = (page: Page) => page.evaluate(() => Math.round(window.scrollY));
const desktopOnly = (width: number | undefined) => (width ?? 0) < 1024;

test.describe("theme switch", () => {
  test("keeps its size and ends in the right state after rapid toggling", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/");
    const toggle = page.getByRole("button", { name: "Tema gelap" });
    const before = (await toggle.boundingBox())!;
    for (let i = 0; i < 5; i++) await toggle.click({ delay: 20 });
    // Odd number of presses: dark, and the moon is the visible icon.
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    const after = (await toggle.boundingBox())!;
    expect(after.width).toBeCloseTo(before.width, 0);
    expect(after.height).toBeCloseTo(before.height, 0);
    await expect
      .poll(() => toggle.locator(".theme-icon-moon").evaluate((el) => getComputedStyle(el).opacity))
      .toBe("1");
    await toggle.click();
    await expect(page.locator("html")).not.toHaveAttribute("data-theme", "dark");
    await expect
      .poll(() => toggle.locator(".theme-icon-sun").evaluate((el) => getComputedStyle(el).opacity))
      .toBe("1");
    expect(errors).toEqual([]);
  });
});

test.describe("language switch", () => {
  test("goes to the equivalent page, keeps scroll and focus, and survives history", async ({
    page,
    viewport,
  }) => {
    test.skip((viewport?.width ?? 0) < 640, "The segmented switch is shown from 640px.");
    await page.goto("/portofolio/sistem-antrean-klinik");
    await scrollTo(page, 600);
    const switcher = page.getByRole("banner").getByRole("navigation", { name: "Bahasa" });
    await switcher.getByRole("link", { name: "English" }).click();
    await expect(page).toHaveURL(/\/en\/portfolio\/clinic-queue-records-system$/);
    const english = page.getByRole("banner").getByRole("navigation", { name: "Language" });
    await expect(english).toHaveAttribute("data-active", "en");
    // Focus is not pulled to <main> as on a page change (WebKit does not focus
    // links on mouse click, so the switch itself is not asserted).
    await expect(page.locator("#main")).not.toBeFocused();
    expect(Math.abs((await scrollY(page)) - 600)).toBeLessThan(40);
    await page.goBack();
    await expect(page).toHaveURL(/\/portofolio\/sistem-antrean-klinik$/);
    await expect(
      page.getByRole("banner").getByRole("navigation", { name: "Bahasa" }),
    ).toHaveAttribute("data-active", "id");
  });

  test("the phone toggle names the other language and rolls to it", async ({ page, viewport }) => {
    test.skip((viewport?.width ?? 0) >= 640, "The single toggle is shown below 640px.");
    await page.goto("/layanan");
    const toggle = page.getByRole("banner").getByRole("link", { name: "English" });
    await expect(toggle).toHaveAttribute("data-shows", "en");
    await toggle.click();
    await expect(page).toHaveURL(/\/en\/services$/);
    await expect(
      page.getByRole("banner").getByRole("link", { name: "Bahasa Indonesia" }),
    ).toHaveAttribute("data-shows", "id");
  });
});

test.describe("loading feedback", () => {
  test("fast navigation shows no status; a slow one shows the runner and an announced status", async ({
    page,
    viewport,
  }) => {
    test.skip(desktopOnly(viewport?.width), "Uses the desktop navigation.");
    await page.goto("/");
    // First load never shows loading feedback: the page is complete HTML.
    await expect(page.locator(".route-bar")).toHaveAttribute("data-state", "idle");
    await expect(page.getByRole("status").filter({ hasText: "Memuat halaman" })).toHaveCount(0);

    await page.route("**/assets/process-*.js", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 2500));
      await route.continue();
    });
    const nav = page.getByRole("navigation", { name: "Navigasi utama" });
    await nav.getByRole("link", { name: "Proses Kerja" }).click();
    await expect(page.locator(".route-bar")).toHaveAttribute("data-state", "busy");
    await expect(page.getByRole("status").filter({ hasText: "Memuat halaman" })).toBeAttached();
    await expect(page.locator(".route-chip")).toHaveAttribute("data-state", "busy");
    await expect(page).toHaveURL(/\/proses$/, { timeout: 10_000 });
    await expect(page.locator(".route-bar")).toHaveAttribute("data-state", "idle");
    await expect(page.locator(".route-chip")).toHaveAttribute("data-state", "idle");
    await expect(page.getByRole("status").filter({ hasText: "Memuat halaman" })).toHaveCount(0);

    // A route whose code is already loaded switches with no visible status.
    await page.evaluate(() => {
      const chip = document.querySelector(".route-chip")!;
      new MutationObserver(() => {
        if (chip.getAttribute("data-state") === "busy")
          (window as unknown as { __chip: boolean }).__chip = true;
      }).observe(chip, { attributes: true });
    });
    await nav.getByRole("link", { name: "Beranda" }).click();
    await expect(page).toHaveURL(/\/$/);
    expect(await page.evaluate(() => (window as unknown as { __chip?: boolean }).__chip)).toBe(
      undefined,
    );
  });
});

test.describe("back to top", () => {
  test("appears after scrolling, returns to the top, and restores focus to the page", async ({
    page,
  }) => {
    await page.goto("/layanan");
    const button = page.getByRole("button", { name: "Kembali ke atas" });
    await expect(button).toBeHidden();
    await scrollTo(page, 2400);
    await expect(button).toBeVisible();
    await button.click();
    await expect.poll(() => scrollY(page)).toBeLessThan(5);
    await expect(page.locator("#main")).toBeFocused();
    await expect(button).toBeHidden();
  });

  test("Back restores the previous scroll position", async ({ page, viewport }) => {
    test.skip(desktopOnly(viewport?.width), "Uses the desktop navigation.");
    await page.goto("/");
    await scrollTo(page, 1800);
    await page.waitForTimeout(300);
    await page
      .getByRole("navigation", { name: "Navigasi utama" })
      .getByRole("link", { name: "Layanan" })
      .click();
    await expect(page).toHaveURL(/\/layanan$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/$/);
    await expect.poll(() => scrollY(page)).toBeGreaterThan(1700);
  });
});

test.describe("adaptive header", () => {
  test("condenses past a threshold and expands only near the top (hysteresis)", async ({
    page,
    viewport,
  }) => {
    await page.goto("/");
    const header = page.locator("header.site-header");
    await expect(header).toHaveAttribute("data-compact", "false");
    await scrollTo(page, 600);
    await expect(header).toHaveAttribute("data-compact", "true");
    await expect(header).toHaveAttribute("data-scrolled", "true");
    await scrollTo(page, 70);
    await page.waitForTimeout(200);
    await expect(header).toHaveAttribute("data-compact", "true");
    await scrollTo(page, 0);
    await expect(header).toHaveAttribute("data-compact", "false");
    await expect(header).toHaveAttribute("data-scrolled", "false");
    // The header box never changes height, so nothing below it moves: 88px
    // from 1024px, 76px below.
    const expected = (viewport?.width ?? 0) >= 1024 ? 88 : 76;
    expect((await header.boundingBox())!.height).toBeCloseTo(expected, 0);
  });
});

test.describe("Solveit Assistant", () => {
  test("answers from site content, falls back honestly, and closes with Escape", async ({
    page,
    isMobile,
  }) => {
    const external: string[] = [];
    page.on("request", (request) => {
      if (!request.url().startsWith("http://localhost")) external.push(request.url());
    });
    await page.goto("/");
    const launcher = page.locator(".dock-launcher");
    await page.getByRole("button", { name: "Tanya Solveit" }).click();
    await expect(launcher).toHaveAttribute("aria-expanded", "true");
    await expect(launcher).toHaveAccessibleName("Tutup");
    const dialog = page.getByRole("dialog", { name: "Asisten Solveit" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("Panduan otomatis, bukan AI atau staf");

    await dialog.getByRole("button", { name: "Layanan" }).click();
    const log = dialog.getByRole("log");
    await expect(log).toContainText("Pengembangan Website");
    await expect(log).toContainText("Dukungan Teknis");

    await dialog.getByLabel("Tulis pertanyaan").fill("Berapa lama prosesnya?");
    await dialog.getByRole("button", { name: "Kirim pertanyaan" }).click();
    await expect(log).toContainText("Durasi ditentukan oleh ruang lingkup");

    await dialog.getByLabel("Tulis pertanyaan").fill("bisa pakai blockchain kuantum?");
    await dialog.getByLabel("Tulis pertanyaan").press("Enter");
    await expect(log).toContainText("belum bisa saya jawab");
    const wa = log.locator('a[href^="https://wa.me/"]').last();
    await expect(wa).toHaveAttribute("href", /blockchain/);
    await expect(wa).toHaveAttribute("target", "_blank");

    // At the top of the page there is nothing to go back to.
    await expect(page.getByRole("button", { name: "Kembali ke atas" })).toBeHidden();
    if (isMobile) await expect(page.locator("#main")).toHaveAttribute("inert", "");

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("button", { name: "Tanya Solveit" })).toBeFocused();
    if (isMobile) await expect(page.locator("#main")).not.toHaveAttribute("inert", "");
    // Nothing left the page: no API, no analytics, no AI service.
    expect(external).toEqual([]);
  });

  test("scrolling inside the panel does not scroll the page", async ({ page, viewport }) => {
    test.skip(desktopOnly(viewport?.width), "Wheel input is a desktop concern.");
    await page.goto("/en");
    await page.getByRole("button", { name: "Ask Solveit" }).click();
    const dialog = page.getByRole("dialog", { name: "Solveit Assistant" });
    for (const topic of ["Services", "Portfolio", "Process"])
      await dialog.locator(".assistant-chip", { hasText: topic }).last().click();
    const log = dialog.getByRole("log");
    await log.evaluate((el) => (el.scrollTop = 0));
    const box = (await log.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, 300);
    await expect.poll(() => log.evaluate((el) => el.scrollTop)).toBeGreaterThan(100);
    expect(await scrollY(page)).toBe(0);
  });

  test("has no accessibility violations while open", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await page.getByRole("button", { name: "Tanya Solveit" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Kontak" }).click();
    const results = await new AxeBuilder({ page })
      .include("#assistant-panel")
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(results.violations.map((violation) => violation.id)).toEqual([]);
  });
});

test.describe("client stories", () => {
  test("home shows the permission pledge, never a quote or review markup", async ({ page }) => {
    for (const path of ["/", "/en"]) {
      await page.goto(path);
      const heading = page.getByRole("heading", {
        name:
          path === "/"
            ? "Cerita klien, hanya dengan izin tertulis."
            : "Client stories, only with written permission.",
      });
      await expect(heading).toBeVisible();
      await expect(page.locator("main blockquote")).toHaveCount(0);
      const jsonLd = await page
        .locator('script[type="application/ld+json"]')
        .evaluateAll((nodes) => nodes.map((node) => node.textContent ?? "").join(" "));
      expect(jsonLd).not.toMatch(/"Review"|AggregateRating|reviewRating/);
    }
  });

  test("the preview page is noindex, labelled, and keyboard navigable", async ({ page }) => {
    await page.goto("/pratinjau/testimoni");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await expect(page.getByText("Placeholder tata letak, bukan testimoni")).toBeVisible();
    const carousel = page.locator('[aria-roledescription="carousel"]');
    await expect(carousel.locator('[aria-roledescription="slide"]')).toHaveAttribute(
      "aria-label",
      "1 dari 3",
    );
    await carousel.getByRole("button", { name: "Testimoni berikutnya" }).click();
    await expect(carousel.locator('[aria-roledescription="slide"]')).toHaveAttribute(
      "aria-label",
      "2 dari 3",
    );
    await carousel.getByRole("button", { name: "Testimoni berikutnya" }).press("ArrowLeft");
    await expect(carousel.locator('[aria-roledescription="slide"]')).toHaveAttribute(
      "aria-label",
      "1 dari 3",
    );
    await expect(carousel).toContainText("Placeholder");
  });
});

test.describe("without JavaScript", () => {
  test("content and navigation work, and no dead floating controls render", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto("/");
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.locator(".floating-dock")).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Cerita klien, hanya dengan izin tertulis." }),
    ).toBeVisible();
    await page.locator('footer a[href="/proses"]').first().click();
    await expect(page).toHaveURL(/\/proses$/);
    await context.close();
  });
});
