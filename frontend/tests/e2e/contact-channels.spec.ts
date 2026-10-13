import { expect, test } from "./fixtures";

const NUMBERS = ["6287759641358", "6281230252499", "6282335501778"];

test("the WhatsApp menu offers all three numbers and works by keyboard", async ({
  page,
  isMobile,
}) => {
  test.skip(Boolean(isMobile), "Keyboard flow is verified on desktop and tablet.");
  await page.goto("/layanan");
  await page.locator("html[data-hydrated]").waitFor({ state: "attached" });
  const menu = page.locator("footer section [data-wa-menu]");
  const trigger = menu.locator("summary");
  await trigger.focus();
  await page.keyboard.press("Enter");
  await expect(menu).toHaveAttribute("open", "");
  const links = menu.getByRole("link");
  await expect(links).toHaveCount(3);
  for (const [index, number] of NUMBERS.entries()) {
    const link = links.nth(index);
    await expect(link).toHaveAttribute("href", new RegExp(`^https://wa\\.me/${number}\\?text=`));
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", /noopener/);
  }
  await page.keyboard.press("Escape");
  await expect(menu).not.toHaveAttribute("open", "");
  await expect(trigger).toBeFocused();
});

test("an outside click closes the WhatsApp menu", async ({ page }) => {
  await page.goto("/en/services");
  await page.locator("html[data-hydrated]").waitFor({ state: "attached" });
  const menu = page.locator("footer section [data-wa-menu]");
  await menu.locator("summary").click();
  await expect(menu).toHaveAttribute("open", "");
  await page.mouse.click(2, 2);
  await expect(menu).not.toHaveAttribute("open", "");
});

test("the contact page lists each number once, plus email and Instagram", async ({ page }) => {
  await page.goto("/kontak");
  const direct = page.getByRole("complementary", { name: "Kontak langsung" });
  for (const number of NUMBERS)
    await expect(direct.locator(`a[href^="https://wa.me/${number}"]`)).toHaveCount(1);
  await expect(direct.locator('a[href="mailto:solveit.team.id@gmail.com"]')).toHaveCount(1);
  const instagram = direct.getByRole("link", { name: /Instagram @solveit\.id/ });
  await expect(instagram).toHaveAttribute("href", "https://www.instagram.com/solveit.id/");
  await expect(instagram).toHaveAttribute("target", "_blank");
  await expect(instagram).toHaveAttribute("rel", "noopener noreferrer");
});

test("the footer links the official Instagram account on every page", async ({ page }) => {
  for (const path of ["/", "/en/portfolio"]) {
    await page.goto(path);
    const link = page.locator("footer").getByRole("link", { name: /Instagram @solveit\.id/ });
    await expect(link).toHaveAttribute("href", "https://www.instagram.com/solveit.id/");
    await expect(link).toHaveAttribute("rel", "noopener noreferrer");
  }
});
