import { projects } from "../../src/data/projects";
import { expect, type Page, test } from "./fixtures";

/*
 * Round 5: compact header surface, demo label, case study layout and
 * chapter scrollspy, chapter motion, principles composition, and the
 * slicing calls to action.
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
const wide = (width: number | undefined) => (width ?? 0) >= 1024;
const caseUrl = (project: (typeof projects)[number], locale: "id" | "en") =>
  locale === "id" ? `/portofolio/${project.slugs.id}` : `/en/portfolio/${project.slugs.en}`;

const chapterOrder = [
  "context",
  "problem",
  "solution",
  "system",
  "flow",
  "features",
  "technology",
  "measure",
];

/** Rail links currently marked, in order. */
const activeChapters = (page: Page) =>
  page
    .locator("a[data-chapter-link][aria-current]")
    .evaluateAll((links) => links.map((link) => (link as HTMLElement).dataset.chapterLink));

/** Resolves once the scroll position has stopped changing. */
const settle = async (page: Page) => {
  let last = -1;
  await expect
    .poll(
      async () => {
        const y = await page.evaluate(() => Math.round(window.scrollY));
        const still = y === last;
        last = y;
        return still;
      },
      { intervals: [150] },
    )
    .toBe(true);
};

/** The chapter whose top last crossed the reading line, measured independently. */
const chapterAtLine = (page: Page) =>
  page.evaluate(() => {
    const header = document.querySelector<HTMLElement>(".site-header")!.offsetHeight;
    const line = header + (innerHeight - header) * 0.22;
    let current = "";
    for (const section of document.querySelectorAll<HTMLElement>("[data-chapter]"))
      if (section.getBoundingClientRect().top <= line) current = section.dataset.chapter!;
    return current;
  });

/** Scrolls so a chapter's top sits a little above the reading line. */
const readChapter = (page: Page, id: string) =>
  page.evaluate((chapter) => {
    const el = document.getElementById(chapter)!;
    let top = 0;
    for (let node: HTMLElement | null = el; node; node = node.offsetParent as HTMLElement | null)
      top += node.offsetTop;
    const header = document.querySelector<HTMLElement>(".site-header")!.offsetHeight;
    const line = header + (innerHeight - header) * 0.22;
    window.scrollTo(0, top - line + 40);
  }, id);

test.describe("compact header surface", () => {
  for (const theme of ["light", "dark"] as const) {
    test(`the floating capsule has an outline, a raised fill, and lift (${theme})`, async ({
      page,
      viewport,
    }) => {
      await page.addInitScript((value) => localStorage.setItem("solveit-theme", value), theme);
      await page.goto("/");
      const header = page.locator("header.site-header");
      await scrollTo(page, 900);
      await expect(header).toHaveAttribute("data-compact", "true");
      await page.waitForTimeout(900);
      // Outline: the rim layer shows, in the firmer capsule tone.
      expect(await css(page, ".header-rim", "opacity")).toBe("1");
      const rim = await css(page, ".header-rim", "background-color");
      expect(rim).toBe(theme === "light" ? "rgba(8, 42, 86, 0.2)" : "rgba(233, 239, 250, 0.2)");
      // Fill: raised porcelain, nearly opaque, so it never melts into the page.
      const fill = await css(page, ".header-plate", "background-color");
      expect(fill).toMatch(/0\.94\)$/);
      if ((viewport?.width ?? 0) >= 768) {
        expect(await css(page, ".header-rim", "clip-path")).toContain("round 30px");
        expect(await css(page, ".header-lift", "opacity")).toBe("1");
        // The plate sits exactly 1px inside the rim: a hairline, not a frame.
        const [rimClip, plateClip] = await Promise.all([
          css(page, ".header-rim", "clip-path"),
          css(page, ".header-plate", "clip-path"),
        ]);
        const top = (clip: string) => parseFloat(clip.replace("inset(", ""));
        expect(top(plateClip) - top(rimClip)).toBeCloseTo(1, 1);
      }
      // Back at the top the capsule opens into the full-bleed bar again.
      await scrollTo(page, 0);
      await expect(header).toHaveAttribute("data-compact", "false");
      await expect.poll(() => css(page, ".header-lift", "opacity")).toBe("0");
    });
  }

  test("a fast pass over the threshold reverses smoothly and settles", async ({ page }) => {
    await page.goto("/");
    const header = page.locator("header.site-header");
    for (const y of [700, 20, 700, 20, 700]) {
      await scrollTo(page, y);
      await page.waitForTimeout(120);
    }
    await expect(header).toHaveAttribute("data-compact", "true");
    await scrollTo(page, 0);
    await expect(header).toHaveAttribute("data-compact", "false");
    await expect
      .poll(() => css(page, ".header-plate", "clip-path"))
      .toMatch(/^inset\(0px 0px 1px( 0px)?\)$/);
  });

  test("the condensed logo and controls stay focusable and usable", async ({ page }) => {
    await page.goto("/layanan");
    await scrollTo(page, 900);
    await expect(page.locator("header.site-header")).toHaveAttribute("data-compact", "true");
    const home = page.getByRole("link", { name: "Solveit Indonesia, ke beranda" });
    await home.focus();
    await expect(home).toBeFocused();
    await page.waitForTimeout(800);
    await page.locator(".logo-hit").click();
    await expect(page).toHaveURL(/\/$/);
  });
});

test.describe("demo label", () => {
  for (const locale of ["id", "en"] as const) {
    test(`reads as a status on the list, the case study, and its neighbours (${locale})`, async ({
      page,
      viewport,
    }) => {
      const text =
        locale === "id"
          ? "Konsep demonstrasi, bukan proyek klien"
          : "Demonstration concept, not client work";
      await page.goto(locale === "id" ? "/portofolio" : "/en/portfolio");
      const cards = page.locator("[data-project-card] .demo-label");
      await expect(cards).toHaveCount(projects.length);
      await page.goto(caseUrl(projects[0]!, locale));
      const labels = page.locator(".demo-label");
      // Under the title, and on both neighbours.
      await expect(labels).toHaveCount(3);
      for (const label of await labels.all()) {
        await label.scrollIntoViewIfNeeded();
        await expect(label).toHaveText(text);
        await expect(label).toBeVisible();
        // A status, not a control: default cursor, no button role, inside the viewport.
        expect(await label.evaluate((el) => getComputedStyle(el).cursor)).toBe("default");
        expect(await label.evaluate((el) => el.closest("button"))).toBeNull();
        const box = (await label.boundingBox())!;
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(viewport!.width);
        // Wraps inside its container, never past it: one line on wide screens,
        // a few balanced lines in the narrowest card column.
        const parent = (await label.evaluate((el) => {
          const r = el.parentElement!.getBoundingClientRect();
          return { left: r.left, right: r.right };
        }))!;
        expect(box.x).toBeGreaterThanOrEqual(parent.left - 1);
        expect(box.x + box.width).toBeLessThanOrEqual(parent.right + 1);
        if (wide(viewport?.width)) expect(box.height).toBeLessThan(40);
      }
    });
  }
});

test.describe("case study chapters", () => {
  test("context and problem read one under the other, never side by side", async ({ page }) => {
    await page.goto(caseUrl(projects[0]!, "id"));
    const context = (await page.locator("section#context").boundingBox())!;
    const problem = (await page.locator("section#problem").boundingBox())!;
    expect(problem.y).toBeGreaterThanOrEqual(context.y + context.height);
    expect(Math.abs(problem.x - context.x)).toBeLessThan(2);
  });

  for (const project of projects) {
    for (const locale of ["id", "en"] as const) {
      test(`${caseUrl(project, locale)}: scrolling marks one chapter at a time, in order`, async ({
        page,
        viewport,
      }) => {
        test.skip(!wide(viewport?.width), "The rail is shown from 1024px.");
        await page.goto(caseUrl(project, locale));
        for (const id of chapterOrder) {
          await readChapter(page, id);
          await expect.poll(() => activeChapters(page)).toEqual([id]);
        }
        for (const id of [...chapterOrder].reverse()) {
          await readChapter(page, id);
          await expect.poll(() => activeChapters(page)).toEqual([id]);
        }
        // Above the first chapter nothing is current.
        await scrollTo(page, 0);
        await expect.poll(() => activeChapters(page)).toEqual([]);
      });
    }
  }

  test("a slow scroll never shows two chapters or flickers", async ({ page, viewport }) => {
    test.skip(!wide(viewport?.width), "The rail is shown from 1024px.");
    // Dozens of real wheel steps: slower engines need more than the default budget.
    test.setTimeout(90_000);
    await page.goto(caseUrl(projects[2]!, "id"));
    await page.evaluate(() => {
      const seen: string[][] = [];
      (window as Window & { __railLog?: string[][] }).__railLog = seen;
      const rail = document.querySelector(".case-rail")!;
      new MutationObserver(() =>
        seen.push(
          [...rail.querySelectorAll<HTMLElement>("[aria-current]")].map(
            (link) => link.dataset.chapterLink!,
          ),
        ),
      ).observe(rail, { subtree: true, attributes: true, attributeFilter: ["aria-current"] });
    });
    const start = await page.evaluate(() => document.getElementById("context")!.offsetTop);
    const end = await page.evaluate(
      () => document.getElementById("measure")!.getBoundingClientRect().top + scrollY,
    );
    for (let y = start; y < end; y += 90) {
      await page.mouse.wheel(0, 90);
      await page.waitForTimeout(16);
    }
    await page.waitForTimeout(300);
    const log = await page.evaluate(
      () => (window as Window & { __railLog?: string[][] }).__railLog ?? [],
    );
    const states = log.map((ids) => ids.join(","));
    // Never two at once; and forward reading only ever moves forward.
    expect(log.every((ids) => ids.length <= 1)).toBe(true);
    const order = states.filter(Boolean).map((id) => chapterOrder.indexOf(id));
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  test("rail clicks, a direct hash, Back and Forward, and a language switch keep one chapter", async ({
    page,
    viewport,
  }) => {
    test.skip(!wide(viewport?.width), "The rail is shown from 1024px.");
    const rail = page.getByRole("navigation", { name: "Bab studi kasus" });
    await page.goto(caseUrl(projects[1]!, "id"));
    for (const [id, name] of [
      ["problem", /Permasalahan/],
      ["flow", /Alur utama/],
      ["measure", /Pengukuran/],
      ["context", /Konteks/],
    ] as const) {
      await rail.getByRole("link", { name }).click();
      await expect(page).toHaveURL(new RegExp(`#${id}$`));
      await expect(page.locator(`section#${id}`)).toBeFocused();
      await expect.poll(() => activeChapters(page)).toEqual([id]);
      // Once the smooth scroll settles the chapter sits under the header and stays current.
      await settle(page);
      await expect.poll(() => activeChapters(page)).toEqual([id]);
    }
    // Arriving with a hash, as a new document load.
    await page.goto("/portofolio");
    await page.goto(`${caseUrl(projects[1]!, "id")}#technology`);
    await expect.poll(() => activeChapters(page)).toEqual(["technology"]);
    // Leave, come Back to the restored position, go Forward and Back again.
    await readChapter(page, "features");
    await expect.poll(() => activeChapters(page)).toEqual(["features"]);
    await page
      .getByRole("navigation", { name: "Studi kasus lain" })
      .getByRole("link")
      .last()
      .click();
    await expect(page).toHaveURL(new RegExp(`/portofolio/${projects[2]!.slugs.id}$`));
    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`/portofolio/${projects[1]!.slugs.id}`));
    await settle(page);
    // Back restores where the reader left (the link at the end of the page).
    await expect.poll(async () => activeChapters(page)).toEqual([await chapterAtLine(page)]);
    await page.goForward();
    await expect(page).toHaveURL(new RegExp(`/portofolio/${projects[2]!.slugs.id}$`));
    await page.goBack();
    await settle(page);
    // Whatever position Back restores, the rail names the chapter at the line.
    await expect.poll(async () => activeChapters(page)).toEqual([await chapterAtLine(page)]);
    // Switching language keeps the place, and the one current chapter is the
    // one at the reading line of the new page.
    await page
      .getByRole("banner")
      .getByRole("navigation", { name: "Bahasa" })
      .getByRole("link", { name: "English" })
      .click();
    await expect(page).toHaveURL(/\/en\/portfolio\//);
    await page.waitForTimeout(600);
    const expected = await chapterAtLine(page);
    expect(expected).not.toBe("");
    await expect.poll(() => activeChapters(page)).toEqual([expected]);
  });

  test("works on a short desktop viewport too", async ({ page, viewport }) => {
    test.skip(!wide(viewport?.width), "The rail is shown from 1024px.");
    await page.setViewportSize({ width: viewport!.width, height: 620 });
    await page.goto(caseUrl(projects[3]!, "en"));
    for (const id of chapterOrder) {
      await readChapter(page, id);
      await expect.poll(() => activeChapters(page)).toEqual([id]);
    }
  });
});

test.describe("chapter motion", () => {
  test("the system map, flow, and measures stage what is already there", async ({ page }) => {
    await page.goto(caseUrl(projects[0]!, "id"));
    // Staged before they are reached.
    await expect
      .poll(() => css(page, "[data-system-capsule]", "clip-path"))
      .toContain("inset(0% 100%");
    await expect(page.locator("[data-flow]")).toHaveAttribute("data-armed", "true");
    await expect(page.locator("[data-flow-step].is-passed")).toHaveCount(0);

    // System map: every part extends, the signals and rings come to rest hidden.
    await page.locator("[data-system-map]").scrollIntoViewIfNeeded();
    await page.waitForTimeout(3000);
    for (const capsule of await page.locator("[data-system-capsule]").all())
      expect(await capsule.evaluate((el) => getComputedStyle(el).clipPath)).toBe("none");
    for (const signal of await page.locator("[data-system-signal], [data-system-ring]").all())
      expect(await signal.evaluate((el) => getComputedStyle(el).opacity)).toBe("0");

    // Flow: progress follows the reader both ways; every label stays readable.
    const flowTop = await page.evaluate(
      () => document.querySelector("[data-flow]")!.getBoundingClientRect().top + scrollY,
    );
    // Past the end of the flow (its bottom above the reading area) every step is lit.
    const flowEnd = await page.evaluate(() => {
      const box = document.querySelector("[data-flow]")!.getBoundingClientRect();
      return box.bottom + scrollY - innerHeight * 0.3;
    });
    await scrollTo(page, Math.max(flowTop - 200, flowEnd));
    await expect.poll(() => page.locator("[data-flow-step].is-passed").count()).toBe(5);
    for (const label of await page.locator(".flow-label").all()) await expect(label).toBeVisible();
    await scrollTo(page, flowTop - 2000);
    await expect.poll(() => page.locator("[data-flow-step].is-passed").count()).toBe(0);
    await expect(page.locator(".flow-label").first()).toHaveCSS("opacity", "1");

    // Measures: the rule draws and the slot settles; never a number or a percentage.
    await page.locator("[data-metrics]").scrollIntoViewIfNeeded();
    await page.waitForTimeout(1800);
    expect(await css(page, "[data-metric-rule]", "transform")).toMatch(/^(none|matrix\(1, 0)/);
    await expect(page.locator("[data-metric-note]").first()).toHaveCSS("opacity", "1");
    expect(await page.locator("[data-metrics]").innerText()).not.toMatch(/\d|%/);
  });

  test("under reduced motion everything is shown, lit, and still", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.addInitScript(() => {
      (window as Window & { __solveitBoot?: string }).__solveitBoot = "off";
    });
    await page.goto(caseUrl(projects[0]!, "en"));
    await page.locator("html[data-hydrated]").waitFor({ state: "attached" });
    await page.waitForTimeout(800);
    await expect(page.locator("[data-flow]")).not.toHaveAttribute("data-armed", "true");
    expect(await css(page, "[data-system-capsule]", "clip-path")).toBe("none");
    expect(await css(page, "[data-metric-rule]", "transform")).toBe("none");
    const marker = await css(page, ".flow-marker", "background-color");
    expect(marker).toBe("rgb(20, 82, 237)");
    await context.close();
  });
});

test.describe("principles", () => {
  test("arrive as one composition and answer hover without posing as links", async ({
    page,
    viewport,
  }) => {
    await page.goto("/");
    const tiles = page.locator("[data-tile]");
    await expect(tiles).toHaveCount(4);
    // Staged until reached.
    await expect.poll(() => css(page, "[data-tile]", "clip-path")).toContain("polygon");
    await page.locator("#principles-title").scrollIntoViewIfNeeded();
    await page.locator("[data-principles]").scrollIntoViewIfNeeded();
    await page.waitForTimeout(2600);
    for (const tile of await tiles.all()) {
      await tile.scrollIntoViewIfNeeded();
      await page.waitForTimeout(wide(viewport?.width) ? 0 : 1300);
      expect(await tile.evaluate((el) => getComputedStyle(el).clipPath)).toBe("none");
      expect(await tile.evaluate((el) => getComputedStyle(el).cursor)).toBe("auto");
      await expect(tile.locator("h3")).toHaveCSS("opacity", "1");
      expect(await tile.locator("a, button").count()).toBe(0);
    }
    const fine = await page.evaluate(
      () => matchMedia("(hover: hover) and (pointer: fine)").matches,
    );
    const portal = page.locator(".principle-portal");
    await portal.hover();
    const animation = await css(page, ".principle-stage", "animation-name");
    expect(animation).toBe(fine ? "stage-pass" : "none");
    // Hover never lifts the tile itself.
    expect(await portal.evaluate((el) => getComputedStyle(el).transform)).toBe("none");
  });
});

test.describe("slicing calls to action", () => {
  test("only the chosen calls to action slice, and the label stays put", async ({ page }) => {
    await page.goto("/");
    const slices = page.locator(".btn-slice");
    await expect(slices).toHaveCount(3);
    // Never on header controls, forms, switches, or close buttons.
    await expect(page.locator("header .btn-slice, [data-close-control].btn-slice")).toHaveCount(0);
    await expect(page.locator(".theme-toggle.btn-slice, .lang-switch .btn-slice")).toHaveCount(0);

    const fine = await page.evaluate(
      () => matchMedia("(hover: hover) and (pointer: fine)").matches,
    );
    const hero = page.locator("form .btn-slice");
    const before = (await hero.boundingBox())!;
    const offset = () => css(page, "form .btn-slice", "transform", "::after");
    const tx = (matrix: string) => Number(matrix.match(/-?[\d.]+/g)?.[4] ?? 0);
    expect(tx(await offset())).toBeLessThan(-before.width);
    await hero.hover();
    await page.waitForTimeout(900);
    if (fine) expect(Math.abs(tx(await offset()))).toBeLessThan(1);
    else expect(tx(await offset())).toBeLessThan(-before.width);
    const after = (await hero.boundingBox())!;
    expect(after.width).toBeCloseTo(before.width, 0);
    expect(after.height).toBeCloseTo(before.height, 0);
    await expect(hero).toHaveCSS("color", "rgb(246, 249, 255)");
  });

  test("keyboard focus slices too, with the focus ring", async ({ page, browserName }) => {
    test.skip(browserName === "webkit", "WebKit does not Tab to buttons by default.");
    await page.goto("/");
    await page.locator('form input[type="radio"]').last().focus();
    await page.keyboard.press("Tab");
    const hero = page.locator("form .btn-slice");
    await expect(hero).toBeFocused();
    await page.waitForTimeout(900);
    const matrix = await css(page, "form .btn-slice", "transform", "::after");
    expect(Math.abs(Number(matrix.match(/-?[\d.]+/g)?.[4] ?? 99))).toBeLessThan(1);
    expect(await css(page, "form .btn-slice", "outline-style")).toBe("solid");
  });
});
