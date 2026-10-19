import { type Page, expect, test } from "@playwright/test";
import { bootstrapOwner, resetBackend } from "./support/backend";
import { LARAVEL_ORIGIN } from "./support/env.mjs";
import {
  type AdminApi,
  type Person,
  activateThroughApi,
  cspViolations,
  inviteThroughApi,
  newPerson,
  openNavigation,
  signInThroughUi,
  watchCsp,
} from "./support/flows";
import { assertAbsent, assertNoSecretsStored } from "./support/secrets";

/**
 * B4b against real Laravel on the MySQL testing database: the inquiry console on the B4a API,
 * nothing mocked. Inquiries are synthetic (example.test contacts) and created only through the
 * real public endpoint, `POST /api/v1/inquiries`, as the website would send them. Accounts are
 * created through the real commands and API. Contacts are compared without printing them.
 */
let owner: Person & { api: AdminApi };

test.beforeEach(async ({ page }) => {
  resetBackend();
  const person = newPerson("owner");
  owner = await activateThroughApi(bootstrapOwner(person.email), person, "Owner Utama");
  await watchCsp(page);
});

test.afterEach(async () => {
  await owner.api.dispose();
});

interface Submitted {
  id: number;
  reference: string;
  contact: string;
}

let sequence = 0;

/** One inquiry through the public endpoint; its internal ID read back by the owner API. */
async function submitInquiry(
  fields: { name?: string; service?: string; contact?: string } = {},
): Promise<Submitted> {
  sequence += 1;
  const contact = fields.contact ?? `pengirim.${sequence}@example.test`;
  const response = await fetch(`${LARAVEL_ORIGIN}/api/v1/inquiries`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "Idempotency-Key": crypto.randomUUID(),
    },
    body: JSON.stringify({
      name: fields.name ?? `Pengirim Uji ${sequence}`,
      organization: "Organisasi Uji",
      contact,
      service: fields.service ?? "sistem-informasi",
      budget: "10-50jt",
      timeline: "1-3-bulan",
      message: "Pesan uji sintetis untuk konsol inquiry, cukup panjang untuk diterima.",
    }),
  });
  expect(response.status).toBe(201);
  const body = (await response.json()) as { id?: string; data?: { id: string } };
  const reference = body.data?.id ?? body.id!;

  const listed = await owner.api.get(`inquiries?reference=${reference}`);
  expect(listed.status()).toBe(200);
  const id = ((await listed.json()) as { data: { id: number }[] }).data[0]!.id;

  return { id, reference, contact };
}

async function goToInquiries(page: Page) {
  await (await openNavigation(page)).getByRole("link", { name: "Inquiry" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Inquiry" })).toBeVisible();
}

/** The reveal flow up to the 423 step, then the password and the deliberate second press. */
async function revealContact(page: Page, password: string) {
  await page.getByRole("button", { name: "Buka kontak lengkap" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("checkbox").check();
  await dialog.getByRole("button", { name: "Buka kontak lengkap" }).click();
  await expect(dialog.getByRole("heading", { name: "Konfirmasi kata sandi" })).toBeVisible();
  await expect(dialog.getByText(/Kontak belum dibuka dan belum ada yang dicatat/)).toBeVisible();
  await dialog.getByLabel("Kata sandi Anda").fill(password);
  await dialog.getByRole("button", { name: "Konfirmasi kata sandi" }).click();
  await expect(dialog.getByRole("heading", { name: "Kata sandi dikonfirmasi" })).toBeVisible();
  await dialog.getByRole("button", { name: "Buka kontak lengkap" }).click();
  await expect(dialog).toHaveCount(0);
}

async function auditFor(inquiryId: number) {
  const response = await owner.api.get(`audit-events?subject_inquiry_id=${inquiryId}`);
  expect(response.status()).toBe(200);

  return (
    (await response.json()) as {
      data: { action: string; actor: { user_id: number | null }; metadata: unknown }[];
    }
  ).data;
}

test("an owner finds, moves, and notes an inquiry; filters run on Laravel", async ({ page }) => {
  const first = await submitInquiry({ name: "Pengirim Pertama" });
  const second = await submitInquiry({ name: "Pengirim Kedua", service: "website" });
  await signInThroughUi(page, owner);

  await goToInquiries(page);
  const table = page.getByRole("table", { name: "Daftar inquiry" });
  // Newest first.
  await expect(table.getByRole("row").nth(1)).toContainText("Pengirim Kedua");
  await expect(table.getByRole("row").nth(2)).toContainText("Pengirim Pertama");
  assertAbsent(await page.content(), [first.contact, second.contact], "the inquiry list");

  await page.getByLabel("Layanan").selectOption("website");
  await expect(table.getByRole("row")).toHaveCount(2);
  await expect(table).toContainText("Pengirim Kedua");
  await page.getByRole("button", { name: "Hapus filter" }).click();

  await page.getByLabel("Nomor referensi").fill(first.reference.toLowerCase());
  await page.getByRole("button", { name: "Cari" }).click();
  await expect(table.getByRole("row")).toHaveCount(2);
  await table.getByRole("link", { name: "Pengirim Pertama" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Pengirim Pertama" })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/inquiry/${first.id}$`));
  await expect(page.getByText(first.reference).first()).toBeVisible();
  assertAbsent(await page.content(), [first.contact], "the inquiry detail before a reveal");

  // Status: one deliberate press, compare and set on what the screen showed.
  await page.getByRole("button", { name: "Tandai ditinjau" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Tandai ditinjau" }).click();
  await expect(page.getByText("Status inquiry sekarang Ditinjau.")).toBeVisible();
  const history = page.getByRole("region", { name: "Riwayat status" });
  await expect(history.getByText("Baru ke Ditinjau")).toBeVisible();
  await expect(history.getByText("Anda")).toBeVisible();

  // A note, append-only.
  await page.getByLabel("Catatan baru").fill("Catatan uji: telepon setelah jam 16.00.");
  await page.getByRole("button", { name: "Tambah catatan" }).click();
  await expect(page.getByText("Catatan ditambahkan.")).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "Catatan internal" })
      .getByText("Catatan uji: telepon setelah jam 16.00."),
  ).toBeVisible();

  // Laravel holds both, and the audit log names them without the note's text.
  const events = await auditFor(first.id);
  expect(events.map((event) => event.action).sort()).toEqual([
    "inquiry.note-added",
    "inquiry.status-changed",
  ]);
  assertAbsent(JSON.stringify(events), ["telepon setelah jam 16.00"], "the audit events");

  // The owner's audit screen names them in words and links back to the inquiry.
  await page.getByRole("link", { name: /Lihat kejadiannya di audit log/ }).click();
  await expect(page.getByRole("heading", { name: "Status inquiry diubah" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Catatan inquiry ditambahkan" })).toBeVisible();
  await expect(page.getByText("Status: Baru ke Ditinjau")).toBeVisible();
  expect(await cspViolations(page)).toEqual([]);
});

test("a status changed behind the screen is a 409: the screen shows the current one, nothing is overwritten", async ({
  page,
}) => {
  const inquiry = await submitInquiry();
  // A second operator: a real admin account with its own session.
  const person = newPerson("admin");
  const other = await activateThroughApi(
    await inviteThroughApi(owner, person.email),
    person,
    "Operator Kedua",
  );
  await signInThroughUi(page, owner);
  await page.goto(`/inquiry/${inquiry.id}`);
  await expect(page.getByRole("button", { name: "Tandai ditinjau" })).toBeVisible();

  // The other operator moves it after this screen read it.
  const behind = await other.api.write("PUT", `inquiries/${inquiry.id}/status`, {
    status: "contacted",
    expected_status: "received",
  });
  expect(behind.status()).toBe(200);
  await other.api.dispose();

  await page.getByRole("button", { name: "Tandai ditinjau" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Tandai ditinjau" }).click();
  await expect(dialog.getByText(/sudah diubah sejak Anda membukanya/)).toBeVisible();
  await dialog.getByRole("button", { name: "Tutup" }).click();
  await expect(page.getByText(/Status dimuat ulang dari server: sekarang Dihubungi/)).toBeVisible();
  // The history names who moved it; this screen wrote nothing.
  const history = page.getByRole("region", { name: "Riwayat status" });
  await expect(history.getByText("Baru ke Dihubungi")).toBeVisible();
  await expect(history.getByText("Operator Kedua")).toBeVisible();

  const now = (await (await owner.api.get(`inquiries/${inquiry.id}`)).json()) as {
    data: { status: string; status_changes_count: number };
  };
  expect(now.data).toMatchObject({ status: "contacted", status_changes_count: 1 });
  expect(
    (await auditFor(inquiry.id)).filter((event) => event.action === "inquiry.status-changed"),
  ).toHaveLength(1);
});

test("an admin handles inquiries: the contact opens only deliberately, after the password, recorded", async ({
  page,
  context,
}) => {
  const inquiry = await submitInquiry({ name: "Pengirim Rahasia" });
  const person = newPerson("admin");
  const admin = await activateThroughApi(
    await inviteThroughApi(owner, person.email),
    person,
    "Admin Inquiry",
  );
  expect((await admin.api.write("POST", "auth/logout")).status()).toBe(204);
  await admin.api.dispose();

  await signInThroughUi(page, admin);
  const nav = await openNavigation(page);
  await expect(nav.getByRole("link", { name: "Pengguna" })).toHaveCount(0);
  await nav.getByRole("link", { name: "Inquiry" }).click();
  await page.getByRole("link", { name: "Pengirim Rahasia" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Pengirim Rahasia" })).toBeVisible();
  // An admin cannot read the audit log, so no link to it.
  await expect(page.getByRole("link", { name: /audit log/ })).toHaveCount(0);

  // Cancelling sends nothing and records nothing.
  await page.getByRole("button", { name: "Buka kontak lengkap" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Batal" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await auditFor(inquiry.id)).toEqual([]);

  await revealContact(page, admin.password);
  await expect(page.getByText(/dibuka dan dicatat di audit log/)).toBeVisible();
  // The full value is on screen, compared without printing it.
  const shown = await page.locator(".secret-value").innerText();
  if (shown !== inquiry.contact) {
    throw new Error("The revealed contact differs from the submitted one (values withheld).");
  }
  await assertNoSecretsStored(page, context, [inquiry.contact]);

  const events = await auditFor(inquiry.id);
  expect(events).toHaveLength(1);
  expect(events[0]).toMatchObject({ action: "inquiry.contact-revealed", metadata: null });
  assertAbsent(JSON.stringify(events), [inquiry.contact], "the audit events");

  // Leaving the tab drops it; coming back never reveals it again by itself.
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.getByText(/disembunyikan karena tab ini ditinggalkan/)).toBeVisible();
  assertAbsent(await page.content(), [inquiry.contact], "the page after the tab was left");

  // A new look is a new deliberate opening (the password confirmation is still fresh, so no
  // 423 step), recorded as a second event.
  await page.getByRole("button", { name: "Buka kontak lengkap" }).click();
  await page.getByRole("dialog").getByRole("checkbox").check();
  await page.getByRole("dialog").getByRole("button", { name: "Buka kontak lengkap" }).click();
  await expect(page.locator(".secret-value")).toBeVisible();
  expect(
    (await auditFor(inquiry.id)).filter((event) => event.action === "inquiry.contact-revealed"),
  ).toHaveLength(2);

  // Hidden again, and gone from the page.
  await page.getByRole("button", { name: "Sembunyikan" }).click();
  assertAbsent(await page.content(), [inquiry.contact], "the page after hiding the contact");
  expect(await cspViolations(page)).toEqual([]);
});

test("a session that ended meanwhile sends the person to sign-in and writes nothing", async ({
  page,
}) => {
  const inquiry = await submitInquiry();
  await signInThroughUi(page, owner);
  await page.goto(`/inquiry/${inquiry.id}`);
  await page.getByLabel("Catatan baru").fill("Catatan yang tidak boleh tersimpan.");

  // The same owner ends every other session from another client (the API one): the browser's
  // session is gone on Laravel, deterministically (a moved clock would let session garbage
  // collection remove the API client's session too, now and then).
  const ended = await owner.api.write("DELETE", "me/sessions");
  expect(ended.status()).toBe(200);
  await page.getByRole("button", { name: "Tambah catatan" }).click();

  await expect(page).toHaveURL(/\/masuk\?/);
  expect(new URL(page.url()).searchParams.get("kembali")).toBe(`/inquiry/${inquiry.id}`);
  assertAbsent(await page.content(), ["Catatan yang tidak boleh tersimpan."], "the sign-in page");

  const notes = (await (await owner.api.get(`inquiries/${inquiry.id}/notes`)).json()) as {
    data: unknown[];
  };
  expect(notes.data).toEqual([]);
});

test("the reveal limit is Laravel's: a reveal past it counts down and records nothing", async ({
  page,
}) => {
  const inquiry = await submitInquiry();

  // Use up the per-account limit (10 per minute, admin-inquiries.md) on the isolated testing
  // stack, through the owner's API session.
  expect(
    (await owner.api.write("POST", "auth/confirm-password", { password: owner.password })).status(),
  ).toBe(201);
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const response = await owner.api.write("POST", `inquiries/${inquiry.id}/contact-reveal`, {
      acknowledge_personal_data: true,
    });
    expect(response.status()).toBe(200);
  }

  await signInThroughUi(page, owner);
  await page.goto(`/inquiry/${inquiry.id}`);
  await page.getByRole("button", { name: "Buka kontak lengkap" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("checkbox").check();
  await dialog.getByRole("button", { name: "Buka kontak lengkap" }).click();

  await expect(dialog.getByText(/Coba lagi dalam \d+ detik/)).toBeVisible();
  // Pressing during the countdown sends nothing; nothing was revealed or recorded.
  await dialog.getByRole("button", { name: "Buka kontak lengkap" }).click();
  assertAbsent(await page.content(), [inquiry.contact], "the page after a refused reveal");
  expect(
    (await auditFor(inquiry.id)).filter((event) => event.action === "inquiry.contact-revealed"),
  ).toHaveLength(10);
});
