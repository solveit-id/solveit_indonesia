import { projects } from "../../src/data/projects";
import { expect, type Page, test } from "./fixtures";

/*
 * Round 6: logo morph integrity, glass header, slicing calls to action, the
 * editorial link, About storytelling and ecosystem roadmap, the shared FAQ,
 * the responsive case study preview, the problem card, and the inquiry
 * selects and send buttons.
 */

const scrollTo = (page: Page, y: number) => page.evaluate((top) => window.scrollTo(0, top), y);
const css = (page: Page, selector: string, property: string, pseudo?: string) =>
  page
    .locator(selector)
    .first()
    .evaluate((el, [prop, pse]) => getComputedStyle(el, pse || null).getPropertyValue(prop!), [
      property,
      pseudo ?? "",
    ] as const);
const finePointer = (page: Page) =>
  page.evaluate(() => matchMedia("(hover: hover) and (pointer: fine)").matches);
const caseUrl = (project: (typeof projects)[number], locale: "id" | "en") =>
  locale === "id" ? `/portofolio/${project.slugs.id}` : `/en/portfolio/${project.slugs.en}`;

test.describe("logo morph", () => {
  test("no intermediate frame clips a word or lifts it over the mark", async ({ page }) => {
    await page.goto("/layanan");
    await scrollTo(page, 600);
    const header = page.locator("header.site-header");
    // Drive both directions, then sample every running transition at fixed
    // points by pausing it: the words may fade and drift, never be clipped.
    for (const to of ["true", "false", "true"]) {
      const frames = await page.evaluate(async (state) => {
        const el = document.querySelector<HTMLElement>("header.site-header")!;
        el.dataset.compact = state;
        const animations = document.getAnimations();
        animations.forEach((animation) => animation.pause());
        const seen: { clip: string; markZ: string; wordZ: string }[] = [];
        for (const ms of [0, 80, 160, 240, 320, 420, 560, 700]) {
          animations.forEach((animation) => (animation.currentTime = ms));
          const word = getComputedStyle(document.querySelector(".lockup-word")!);
          const desc = getComputedStyle(document.querySelector(".lockup-desc")!);
          seen.push({
            clip: `${word.clipPath}|${desc.clipPath}`,
            markZ: getComputedStyle(document.querySelector(".lockup-mark")!).zIndex,
            wordZ: word.zIndex,
          });
        }
        animations.forEach((animation) => animation.finish());
        return seen;
      }, to);
      for (const frame of frames) {
        expect(frame.clip).toBe("none|none");
        expect(Number(frame.markZ)).toBeGreaterThan(
          Number(frame.wordZ === "auto" ? 0 : frame.wordZ),
        );
      }
      await expect(header).toHaveAttribute("data-compact", to);
    }
  });

  test("rapid reversals settle in the state the scroll position calls for", async ({ page }) => {
    await page.goto("/");
    const header = page.locator("header.site-header");
    for (const y of [800, 0, 800, 30, 800, 0]) {
      await scrollTo(page, y);
      await page.waitForTimeout(60);
    }
    await expect(header).toHaveAttribute("data-compact", "false");
    await expect.poll(() => css(page, ".lockup-word", "opacity")).toBe("1");
    await expect.poll(() => css(page, ".lockup-mark", "transform")).toBe("none");
  });

  test("a page opened mid-scroll starts compact without replaying the morph", async ({ page }) => {
    // A deep link is scrolled by the browser during load, before hydration:
    // the same situation as a restored scroll position, but deterministic in
    // every engine. Any lockup transition that starts would be a replay.
    await page.addInitScript(() => {
      const runs: string[] = [];
      (window as Window & { __lockupRuns?: string[] }).__lockupRuns = runs;
      document.addEventListener("transitionrun", (event) => {
        if ((event.target as Element).classList?.contains("lockup-layer"))
          runs.push(`${(event.target as Element).getAttribute("class")}:${event.propertyName}`);
      });
    });
    await page.goto("/layanan#services-faq");
    const header = page.locator("header.site-header");
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(96);
    await expect(header).toHaveAttribute("data-compact", "true");
    await expect(header).not.toHaveAttribute("data-instant", /.*/);
    expect(await css(page, ".lockup-word", "opacity")).toBe("0");
    await page.waitForTimeout(800);
    expect(
      await page.evaluate(() => (window as Window & { __lockupRuns?: string[] }).__lockupRuns),
    ).toEqual([]);
  });

  test("navigating while compact lands on an expanded header at the top", async ({ page }) => {
    await page.goto("/layanan");
    await scrollTo(page, 1200);
    const header = page.locator("header.site-header");
    await expect(header).toHaveAttribute("data-compact", "true");
    await page.locator(".logo-hit").click();
    await expect(page).toHaveURL(/\/$/);
    await expect(header).toHaveAttribute("data-compact", "false");
    await expect.poll(() => css(page, ".lockup-word", "opacity")).toBe("1");
  });
});

test.describe("glass header", () => {
  test("the capsule blurs what is behind it, with a nearly opaque fallback", async ({ page }) => {
    await page.goto("/");
    await scrollTo(page, 900);
    await expect(page.locator("header.site-header")).toHaveAttribute("data-compact", "true");
    await page.waitForTimeout(800);
    const filter = await css(page, ".header-plate", "backdrop-filter");
    expect(filter).toMatch(/blur\(20px\)/);
    expect(await css(page, ".header-plate", "background-image")).toContain("linear-gradient");
  });
});

test.describe("calls to action", () => {
  test("the header consultation link slices without moving its label", async ({
    page,
    viewport,
  }) => {
    test.skip((viewport?.width ?? 0) < 768, "The header link shows from 768px.");
    await page.goto("/");
    const cta = page.locator("header .btn-nav.btn-slice").first();
    await expect(cta).toHaveAttribute("href", "/kontak");
    const before = (await cta.boundingBox())!;
    await cta.hover();
    await page.waitForTimeout(800);
    const offset = await cta.evaluate((el) => getComputedStyle(el, "::after").transform);
    const tx = Number(offset.match(/-?[\d.]+/g)?.[4] ?? 0);
    if (await finePointer(page)) expect(Math.abs(tx)).toBeLessThan(1);
    const after = (await cta.boundingBox())!;
    expect(after.width).toBeCloseTo(before.width, 0);
    expect(after.height).toBeCloseTo(before.height, 0);
  });

  test("'Kenali kami' is a real link that draws its line on hover and focus", async ({ page }) => {
    await page.goto("/");
    const link = page.getByRole("link", { name: "Kenali kami" });
    await expect(link).toHaveAttribute("href", "/tentang");
    await expect(link).toHaveClass(/link-editorial/);
    expect(await css(page, ".link-editorial", "transform", "::after")).toMatch(/matrix\(0\.16/);
    await link.focus();
    await expect
      .poll(() => css(page, ".link-editorial", "transform", "::after"))
      .toMatch(/matrix\(1, 0, 0, 1/);
    await link.click();
    await expect(page).toHaveURL(/\/tentang$/);
  });

  test("the process call to action slices and keeps its rail", async ({ page }) => {
    await page.goto("/");
    const cta = page.locator('a.btn-slice[href="/proses"]');
    await expect(cta).toHaveCount(1);
    await expect(page.locator("[data-rail] [data-step]")).toHaveCount(7);
  });
});

test.describe("about storytelling", () => {
  test("the vision keeps its exact text and the values keep term and description", async ({
    page,
  }) => {
    await page.goto("/tentang");
    const vision = page.locator(".vision-text");
    await expect(vision).toHaveText(
      "Membangun ekosistem layanan digital yang saling terhubung untuk mendampingi pelanggan dari konsultasi dan perencanaan hingga pengembangan, pengelolaan proyek, serta pemeliharaan berkelanjutan.",
    );
    await expect(page.locator(".values .value-row dt")).toHaveCount(4);
    await expect(page.locator(".values .value-row dd")).toHaveCount(4);
    // Statements, not controls.
    await expect(page.locator(".values button, .values a")).toHaveCount(0);
    await page.goto("/en/about");
    await expect(page.locator(".vision-text")).toHaveText(
      "To build a connected ecosystem of digital services that supports clients from consultation and planning through development, project management, and ongoing maintenance.",
    );
  });

  test("vision and values run forward and back with the scroll, never hiding text", async ({
    page,
  }) => {
    await page.goto("/tentang");
    const phrases = page.locator("[data-phrase]");
    await page.locator(".vision-text").evaluate((el) => el.scrollIntoView({ block: "end" }));
    await page.waitForTimeout(900);
    const early = await phrases.last().evaluate((el) => getComputedStyle(el).color);
    await page.locator(".vision-text").evaluate((el) => el.scrollIntoView({ block: "start" }));
    await page.waitForTimeout(900);
    const late = await phrases.last().evaluate((el) => getComputedStyle(el).color);
    expect(late).not.toBe(early);
    await page.locator(".vision-text").evaluate((el) => el.scrollIntoView({ block: "end" }));
    await page.waitForTimeout(900);
    expect(await phrases.last().evaluate((el) => getComputedStyle(el).color)).toBe(early);
    // Colour only: every phrase stays fully opaque at every point.
    for (const opacity of await phrases.evaluateAll((els) =>
      els.map((el) => getComputedStyle(el).opacity),
    ))
      expect(opacity).toBe("1");
  });

  test("the roadmap labels every part and shows nothing as available", async ({ page }) => {
    for (const [path, statuses] of [
      ["/tentang", ["Sedang berjalan", "Sedang dirancang", "Direncanakan"]],
      ["/en/about", ["In progress", "In design", "Planned"]],
    ] as const) {
      await page.goto(path);
      const eco = page.locator(".eco");
      await expect(eco.locator(".eco-card")).toHaveCount(8);
      await expect(eco.locator('.eco-status[data-status="current"]')).toHaveCount(1);
      await expect(eco.locator('.eco-status[data-status="design"]')).toHaveCount(1);
      await expect(eco.locator('.eco-status[data-status="planned"]')).toHaveCount(6);
      await expect(eco.locator('.eco-status[data-status="current"]')).toHaveText(statuses[0]);
      await expect(eco.locator('.eco-status[data-status="design"]')).toHaveText(statuses[1]);
      await expect(eco.locator('.eco-status[data-status="planned"]').first()).toHaveText(
        statuses[2],
      );
      await expect(eco.getByText("Solveit OpsHub", { exact: true })).toBeVisible();
      await expect(eco).not.toContainText(/tersedia sekarang|available now|diluncurkan|launched/i);
    }
  });

  test("the roadmap markers run back when scrolling up", async ({ page }) => {
    await page.goto("/tentang");
    const eco = page.locator(".eco");
    await expect(eco).toHaveAttribute("data-armed", "true");
    await page.locator(".eco-modules").evaluate((el) => el.scrollIntoView({ block: "center" }));
    await expect(page.locator(".eco-tier.is-passed")).toHaveCount(3);
    await scrollTo(page, 0);
    await expect(page.locator(".eco-tier.is-passed")).toHaveCount(0);
    // The cards themselves stay visible throughout.
    await page.locator(".eco-modules").evaluate((el) => el.scrollIntoView({ block: "center" }));
    await page.waitForTimeout(1200);
    for (const opacity of await page
      .locator("[data-eco-module]")
      .evaluateAll((els) => els.map((el) => getComputedStyle(el).opacity)))
      expect(opacity).toBe("1");
  });
});

test.describe("shared FAQ", () => {
  for (const path of ["/layanan", "/proses", "/en/services", "/en/process"]) {
    test(`${path}: opens and closes by pointer and keyboard and stays put`, async ({ page }) => {
      await page.goto(path);
      const items = page.locator(".faq .faq-item");
      expect(await items.count()).toBeGreaterThan(2);
      const first = items.first();
      const summary = first.locator("summary");
      await summary.click();
      await expect(first).toHaveAttribute("open", "");
      // Rapid toggles leave a consistent state and keep focus on the control.
      for (let index = 0; index < 5; index++) await summary.click();
      await expect(first).not.toHaveAttribute("open", /.*/);
      await summary.focus();
      await page.keyboard.press("Enter");
      await expect(first).toHaveAttribute("open", "");
      await expect(summary).toBeFocused();
      await page.keyboard.press("Space");
      await expect(first).not.toHaveAttribute("open", /.*/);
      // An open answer survives scrolling away and back.
      await page.keyboard.press("Enter");
      await scrollTo(page, 0);
      await page.waitForTimeout(300);
      await summary.scrollIntoViewIfNeeded();
      await expect(first).toHaveAttribute("open", "");
      await expect(first.locator(".faq-answer")).toBeVisible();
      await expect.poll(() => css(page, ".faq-item[open] .faq-answer", "opacity")).toBe("1");
    });
  }

  test("one FAQ system serves both pages", async ({ page }) => {
    for (const path of ["/layanan", "/proses"]) {
      await page.goto(path);
      const section = page.locator("section:has(.faq)");
      await expect(section.locator("details")).toHaveCount(
        await section.locator(".faq-item").count(),
      );
      await expect(section.locator(".faq")).toHaveCount(1);
    }
  });
});

test.describe("responsive preview", () => {
  for (const project of projects)
    for (const locale of ["id", "en"] as const)
      test(`${caseUrl(project, locale)}: labelled as an illustration`, async ({ page }) => {
        await page.goto(caseUrl(project, locale));
        const preview = page.locator("#preview .preview");
        await expect(preview.locator(".preview-caption")).toContainText(
          locale === "id" ? "Ilustrasi konsep responsif" : "Illustrative responsive concept",
        );
        await expect(preview.locator(".preview-caption")).not.toContainText(
          locale === "id" ? "Pratinjau aplikasi nyata" : "Live application preview",
        );
        await expect(preview.locator('[role="img"]')).toHaveAttribute(
          "aria-label",
          new RegExp(locale === "id" ? "Ilustrasi tata letak" : "Illustrative layout"),
        );
      });

  test("switching device resizes the frame and reflows the illustration", async ({ page }) => {
    await page.goto(caseUrl(projects[0], "id"));
    const preview = page.locator("#preview .preview");
    await preview.scrollIntoViewIfNeeded();
    const frame = preview.locator(".preview-frame");
    const screen = preview.locator(".preview-screen");
    const width = () => screen.evaluate((el) => el.getBoundingClientRect().width);
    await expect(frame).toHaveAttribute("data-device", "desktop");
    await expect(preview.locator(".cs-side")).toBeVisible();
    await preview.getByRole("radio", { name: "Ponsel" }).click();
    await expect(frame).toHaveAttribute("data-device", "mobile");
    await expect(preview.locator(".preview-readout")).toContainText("390 × 844");
    await expect(preview.locator(".cs-side")).toBeHidden();
    await expect(preview.locator(".cs-menu")).toBeVisible();
    const phone = await width();
    await preview.getByRole("radio", { name: "Tablet" }).click();
    await expect(frame).toHaveAttribute("data-device", "tablet");
    await expect(preview.locator(".preview-readout")).toContainText("768 × 1024");
    await page.waitForTimeout(600);
    expect(await width()).not.toBeCloseTo(phone, 0);
    // The selected mode is the checked radio.
    await expect(preview.locator('input[value="tablet"]')).toBeChecked();
  });

  test("the width can be set from the keyboard", async ({ page }) => {
    await page.goto(caseUrl(projects[0], "id"));
    const range = page.locator(".preview-range input");
    await range.focus();
    await page.keyboard.press("Home");
    await expect(page.locator(".preview-readout")).toContainText("320 ×");
    await expect(page.locator(".preview-frame")).toHaveAttribute("data-device", "mobile");
    await expect(range).toHaveAttribute("aria-valuetext", "320 piksel");
    for (let index = 0; index < 50; index++) await page.keyboard.press("ArrowRight");
    await expect(page.locator(".preview-readout")).toContainText("820 ×");
    await expect(page.locator(".preview-frame")).toHaveAttribute("data-device", "tablet");
  });

  test("the frame edge can be dragged", async ({ page, viewport }) => {
    test.skip((viewport?.width ?? 0) < 1024, "Drag is checked on the wide layout.");
    await page.goto(caseUrl(projects[0], "id"));
    const handle = page.locator(".preview-handle");
    await handle.scrollIntoViewIfNeeded();
    const box = (await handle.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x - 150, box.y + box.height / 2, { steps: 8 });
    await page.mouse.up();
    const text = await page.locator(".preview-readout").innerText();
    expect(Number(text.match(/^(\d+)/)?.[1])).toBeLessThan(1280);
  });

  test("a wide frame never makes the page scroll sideways", async ({ page }) => {
    await page.goto(caseUrl(projects[0], "en"));
    await page.locator("#preview").scrollIntoViewIfNeeded();
    await page.locator(".preview-range input").fill("1440");
    await page.waitForTimeout(300);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    const frame = (await page.locator(".preview-frame").boundingBox())!;
    expect(frame.x + frame.width).toBeLessThanOrEqual((page.viewportSize()?.width ?? 0) + 1);
  });

  test("the problem card stands apart from the context card", async ({ page }) => {
    for (const theme of ["light", "dark"] as const) {
      await page.addInitScript((value) => localStorage.setItem("solveit-theme", value), theme);
      await page.goto(caseUrl(projects[1], "id"));
      const [context, problem] = await Promise.all([
        css(page, "#context", "background-color"),
        css(page, "#problem", "background-color"),
      ]);
      expect(problem).not.toBe(context);
      expect(problem).not.toBe("rgba(0, 0, 0, 0)");
      expect(await css(page, "#problem", "border-top-style")).toBe("dashed");
    }
  });
});

test.describe("inquiry form", () => {
  test("selects keep their values and native keyboard behaviour", async ({ page }) => {
    await page.goto("/kontak");
    const budget = page.getByLabel("Perkiraan anggaran");
    const timeline = page.getByLabel("Target waktu");
    await budget.selectOption("10-50jt");
    await timeline.selectOption("segera");
    await expect(budget).toHaveValue("10-50jt");
    await expect(timeline).toHaveValue("segera");
    await expect(page.locator(".select-caret")).toHaveCount(2);
    // The caret well is decoration and never takes the click.
    expect(await css(page, ".select-caret", "pointer-events")).toBe("none");
  });

  test("both send buttons slice and still only open the visitor's own app", async ({ page }) => {
    await page.goto("/kontak");
    const whatsapp = page.getByRole("button", { name: "Kirim lewat WhatsApp" });
    const email = page.getByRole("button", { name: "Kirim lewat email" });
    await expect(whatsapp).toHaveClass(/btn-slice/);
    await expect(email).toHaveClass(/btn-slice/);
    await expect(whatsapp).toHaveAttribute("type", "submit");
    await expect(email).toHaveAttribute("type", "submit");
    // An incomplete form is reported, never "sent".
    await email.click();
    await expect(page.getByRole("alert")).toContainText("kolom yang perlu dilengkapi");
    await expect(page.locator("body")).not.toContainText(/terkirim ke Solveit|berhasil dikirim/i);
  });
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("round 6 sections rest fully drawn and readable", async ({ page }) => {
    await page.goto("/tentang");
    await expect(page.locator(".eco")).toHaveAttribute("data-armed", "false");
    for (const opacity of await page
      .locator("[data-phrase], [data-eco-module], .value-row")
      .evaluateAll((els) => els.map((el) => getComputedStyle(el).opacity)))
      expect(opacity).toBe("1");
    expect(await css(page, "[data-value-rule]", "transform")).toBe("none");
  });
});
