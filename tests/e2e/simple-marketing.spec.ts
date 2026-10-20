import { test, expect, type Page } from "@playwright/test";
import { readFile, mkdir } from "node:fs/promises";
import { createHmac } from "node:crypto";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";

const directory = path.resolve("outputs/beta-e2e-data");
const db = () => readFile(path.join(directory, "marketingpilot.json"), "utf8").then(JSON.parse);
async function go(page: Page, url: string) {
  await page.goto(url);
  if (url === "/")
    await expect(page.locator(".mp-landing")).toHaveAttribute("data-landing-ready", "true");
  await expect(page.locator("html")).toHaveAttribute("data-app-ready", "true");
  await page.waitForLoadState("networkidle");
}
async function selectMode(page: Page, mode: "Egyszerű" | "Részletes") {
  const choice = page.getByRole("button", { name: new RegExp(`^${mode}`) }).first();
  await choice.click();
  await expect(choice).toHaveAttribute("aria-pressed", "true");
}
test("landing: industry and language demo, image lightbox, FAQ and responsive layout", async ({
  page,
}, info) => {
  test.setTimeout(240000);
  await mkdir("outputs/ranktim-screens", { recursive: true });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const width of [360, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    await go(page, "/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      /Egy mondatból.*kész poszt.*Percek alatt/,
    );
    await expect(page.locator("main > section")).toHaveCount(6);
    await expect(page.locator(".mp-benefits article")).toHaveCount(4);
    await expect(page.locator(".mp-example-post")).toContainText("Példa Pékség");
    await expect(page.locator(".mp-example-post")).not.toContainText("TESZT");
    const professionTabs = page.getByRole("tablist", {
      name: "Válassz vállalkozástípust a bemutatóhoz",
    });
    await expect(professionTabs.getByRole("tab", { name: /Pékség/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.locator(".mp-demo-result")).toContainText("Kenyér vagy kakaós csiga?");
    await page
      .getByRole("group", { name: "A bemutató nyelve" })
      .getByRole("button", { name: "RO" })
      .click();
    await expect(page.locator(".mp-demo-result")).toContainText("Pâine caldă sau melc cu cacao?");
    await page.getByRole("tab", { name: /Autószerviz/ }).click();
    await expect(page.locator(".mp-example-post")).toContainText("Példa Autószerviz");
    await expect(page.locator(".mp-demo-result")).toContainText("De săptămâna viitoare");
    await page
      .getByRole("group", { name: "A bemutató nyelve" })
      .getByRole("button", { name: "HU" })
      .click();
    await expect(page.locator(".mp-demo-result")).toContainText("Itt a hűvös reggelek ideje!");
    await page.getByRole("tab", { name: /Szépségszalon/ }).click();
    await expect(page.locator(".mp-demo-result")).toContainText("Last minute szabad időpont!");
    await page.getByRole("tab", { name: /Pékség/ }).click();
    await expect(page.locator(".mp-example-post")).toContainText("Példa Pékség");
    await expect(page.locator("main")).not.toContainText("hétfő reggel");
    for (const link of await page.locator("a.mp-button").all())
      await expect(link).toHaveAttribute("href", "/signup");
    if (width < 768) {
      await page.getByRole("button", { name: "Menü megnyitása", exact: true }).click();
      await expect(page.getByRole("navigation", { name: "Mobil navigáció" })).toBeVisible();
      await page
        .getByRole("navigation", { name: "Mobil navigáció" })
        .getByText("Így működik", { exact: true })
        .click();
      await expect(page.getByRole("navigation", { name: "Mobil navigáció" })).toHaveCount(0);
    }
    for (const label of ["Kész poszt", "Kezdőlap", "Naptár"]) {
      await page.getByRole("tab", { name: label, exact: true }).click();
      await expect(page.getByRole("tab", { name: label, exact: true })).toHaveAttribute(
        "aria-selected",
        "true",
      );
      await expect
        .poll(() =>
          page
            .locator("#product-preview-panel img")
            .evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth > 0),
        )
        .toBe(true);
    }
    await expect(page.locator(".mp-preview-mode")).toContainText("Részletes módban");
    await page.getByRole("tab", { name: "Kész poszt", exact: true }).click();
    const openPreview = page.getByRole("button", {
      name: "Kész poszt képernyőkép nagyítása",
    });
    await openPreview.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("dialog").getByRole("img")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await openPreview.click();
    await page.getByRole("button", { name: "Bezárás" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.getByText("Fel kell kötnöm a Facebookot?", { exact: true }).click();
    await expect(page.locator("details[open]")).toContainText("Kapcsolat nélkül is használható");
    await page.getByText("Kitalál tényeket?", { exact: true }).click();
    await expect(
      page.locator("details[open]").filter({ hasText: "Kitalál tényeket?" }),
    ).toContainText("Az AI így is hibázhat");
    await page.getByText("Hová kerülnek az adataim?", { exact: true }).click();
    const privacyAnswer = page
      .locator("details[open]")
      .filter({ hasText: "Hová kerülnek az adataim?" });
    await expect(privacyAnswer).toContainText("az adataidat nem adjuk el");
    await expect(privacyAnswer).toContainText("Adatvédelmi tájékoztató");
    await expect(
      privacyAnswer.getByRole("link", { name: /Adatvédelmi tájékoztató/ }),
    ).toHaveAttribute("href", "/privacy");
    await expect(privacyAnswer).not.toContainText(/Neon|Vercel|OpenRouter/);
    const deletionAnswer = page
      .locator("details")
      .filter({ hasText: "Megszüntethetem a fiókomat?" });
    await deletionAnswer.locator("summary").click();
    await expect(deletionAnswer).toContainText("Beállításokban");
    await expect(
      page.getByRole("heading", { name: "Helyi vállalkozóknak, helyi fejlesztőtől" }),
    ).toBeVisible();
    await expect(
      page.locator(".mp-about").getByRole("link", { name: /Kapcsolat/ }),
    ).toHaveAttribute("href", "/contact");
    const accessibility = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      accessibility.violations.map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) })),
    ).toEqual([]);
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
      "content",
      /Egy mondatból/,
    );
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      "content",
      new URL("/images/marketingpilot-share.png", page.url()).href,
    );
    const image = await page.request.get("/images/marketingpilot-share.png");
    expect(image.status()).toBe(200);
    expect(image.headers()["content-type"]).toContain("image/png");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    ).toBe(true);
    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    });
    await page.screenshot({
      path: `outputs/ranktim-screens/${info.project.name}-landing-${width}.png`,
      fullPage: true,
    });
    if (width === 390 || width === 1280)
      await page
        .locator(".mp-hero")
        .screenshot({ path: `outputs/ranktim-screens/${info.project.name}-hero-${width}.png` });
  }
  expect(errors).toEqual([]);
  await go(page, "/signup");
  await expect(page.getByRole("button", { name: "Regisztráció", exact: true })).toBeVisible();
});
test("signup, reminder persistence/unsubscribe, weekly post preview and calendar drag saving", async ({
  page,
}, info) => {
  test.skip(
    !!process.env.BASE_URL,
    "Uses explicitly isolated local fixtures; remote real mail is not sent.",
  );
  test.setTimeout(420000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const email = `simple-marketing-${info.project.name}-${Date.now()}@example.invalid`;
  await go(page, "/onboarding");
  await page.getByRole("button", { name: /Pékség/ }).click();
  await page.getByRole("button", { name: "Tovább", exact: true }).click();
  await page
    .getByLabel("Cég neve *", { exact: true })
    .fill(`TESZT Műhely Pékség ${info.project.name}`);
  await page.getByLabel(/Fő termékek/).fill("Kenyér, kakaós csiga");
  await page.getByRole("button", { name: "Tovább", exact: true }).click();
  await page.getByRole("button", { name: "Tovább", exact: true }).click();
  await page.getByLabel("Neved", { exact: true }).fill("TESZT Marketing");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page
    .getByLabel("Jelszó (legalább 8 karakter)", { exact: true })
    .fill("Only-Test-Password-2026!");
  await page.getByRole("button", { name: "Regisztráció", exact: true }).click();
  await expect(page).toHaveURL(/verify-email/);
  let verify = "";
  await expect
    .poll(async () => {
      const mail = (await readFile(path.join(directory, "outbox.jsonl"), "utf8"))
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line))
        .reverse()
        .find((m) => m.to.includes(email));
      verify = mail?.text.match(/http:\/\/127\.0\.0\.1:8087\/[^\s]+/)?.[0] || "";
      return !!verify;
    })
    .toBe(true);
  await go(page, verify);
  await expect(page.getByText("Az e-mail-címedet megerősítetted.", { exact: false })).toBeVisible();
  await go(page, "/app/brand");
  const reminder = page.getByRole("checkbox", { name: "Kérek hétfői emlékeztetőt", exact: true });
  await expect(reminder).not.toBeChecked();
  // The controlled input changes only after the server confirms persistence.
  await reminder.click();
  await expect(page.getByText("Bekapcsoltuk a heti emlékeztetőt.")).toBeVisible();
  await go(page, "/app/brand");
  await expect(reminder).toBeChecked();
  const owner = (await db()).users.find((u: { email: string }) => u.email === email);
  const payload = Buffer.from(
    JSON.stringify({ userId: owner.id, subscriptionId: owner.auth.weeklyReminder.subscriptionId }),
  ).toString("base64url");
  const signature = createHmac("sha256", "marketingpilot-isolated-e2e-session-secret-only")
    .update(`weekly-reminder:${payload}`)
    .digest("base64url");
  await go(page, `/weekly-reminder#${payload}.${signature}`);
  await expect(page).toHaveURL(/\/weekly-reminder$/);
  await page.getByRole("button", { name: "Leiratkozom az emlékeztetőről", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Leiratkoztál");
  await go(page, "/app/brand");
  await expect(reminder).not.toBeChecked();
  await selectMode(page, "Részletes");
  await go(page, "/app/weekly");
  await page.getByRole("button", { name: "Készíts tervet a hétre", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Megnyitás és szerkesztés", exact: true }),
  ).toHaveCount(4, { timeout: 120000 });
  const data = await db(),
    workspaceId = data.memberships.find(
      (m: { userId: string }) => m.userId === owner.id,
    ).workspaceId;
  const item = data.planItems.find(
    (i: { workspaceId: string; postId: string }) => i.workspaceId === workspaceId && i.postId,
  );
  const variant = data.postVariants.find(
    (v: { postId: string; platform: string }) =>
      v.postId === item.postId && v.platform === item.platform,
  );
  expect(variant.content.length).toBeGreaterThan(10);
  await go(page, "/app/brand");
  await selectMode(page, "Egyszerű");
  await go(page, `/app/posts/${item.postId}`);
  await page.getByText("Kép hozzáadása", { exact: true }).click();
  await page.getByLabel("Kép kiválasztása", { exact: true }).setInputFiles({
    name: "TESZT-kenyer.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await expect(page.getByText("Kép hozzáadva.", { exact: true })).toBeVisible();
  const imageId = (await db()).posts.find((p: { id: string }) => p.id === item.postId)
    .mediaAssetIds[0];
  expect(imageId).toBeTruthy();
  await go(page, "/app/brand");
  await selectMode(page, "Részletes");
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    await go(page, "/app/calendar");
    for (const mode of ["Hónap", "Hét", "Nap"]) {
      await page.getByRole("button", { name: mode, exact: true }).click();
      await expect(page.getByRole("button", { name: mode, exact: true })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    }
    await page.getByRole("button", { name: "Hét", exact: true }).click();
    const entry = page.locator(`[data-plan-item="${item.id}"]`).first();
    await expect(entry).toContainText(variant.content);
    await entry.locator('a[href="#calendar-selected-day"]').click();
    await expect(page.locator(`[data-calendar-detail="${item.id}"]`)).toContainText(
      variant.content,
    );
    const image = page.locator(`[data-calendar-detail="${item.id}"] img`);
    await expect(image).toHaveAttribute("src", `/api/media/${imageId}`);
    await expect
      .poll(() =>
        image.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth > 0),
      )
      .toBe(true);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    ).toBe(true);
    await page.screenshot({
      path: `outputs/ranktim-screens/${info.project.name}-calendar-${width}.png`,
      fullPage: true,
    });
  }
  const moved = new Date(`${item.date}T12:00:00Z`);
  moved.setUTCDate(moved.getUTCDate() + (moved.getUTCDay() === 0 ? -1 : 1));
  const movedDate = moved.toISOString().slice(0, 10);
  const transfer = await page.evaluateHandle(() => new DataTransfer());
  await page
    .locator(`[data-plan-item="${item.id}"]`)
    .first()
    .dispatchEvent("dragstart", { dataTransfer: transfer });
  await page
    .locator(`[data-calendar-date="${movedDate}"]`)
    .locator(".border-dashed")
    .dispatchEvent("drop", { dataTransfer: transfer });
  await expect
    .poll(async () => (await db()).planItems.find((i: { id: string }) => i.id === item.id).date)
    .toBe(movedDate);
  await transfer.dispose();
  await go(page, "/app/planner");
  await expect(page.locator("main")).toContainText(movedDate);
  expect(errors).toEqual([]);
});
