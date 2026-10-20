import { test, expect, type Page } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
const directory = path.resolve("outputs/private-beta-e2e-data");
const db = async () =>
  JSON.parse(await readFile(path.join(directory, "marketingpilot.json"), "utf8"));
async function go(page: Page, url: string) {
  await page.waitForLoadState("networkidle");
  const target = new URL(url, "http://127.0.0.1:8088");
  const link = page
    .locator(`a[href="${target.pathname}${target.search}"]`)
    .filter({ visible: true })
    .first();
  // Follow real navigation where available; do not cancel an in-flight page with a forced reload.
  if (page.url().startsWith(target.origin) && (await link.isVisible())) {
    await link.click();
    await expect(page).toHaveURL(target.href);
  } else await page.goto(url);
  await expect(page.locator("html")).toHaveAttribute("data-app-ready", "true");
  await page.waitForLoadState("networkidle");
}
test("invited beta: signup, four steps, complete simple flow, detailed mode, reset without email service and responsive UI", async ({
  page,
  browser,
}, info) => {
  test.skip(
    process.env.PRIVATE_BETA_E2E !== "1",
    "Run with playwright.private.config.ts; exclusively synthetic isolated data.",
  );
  test.setTimeout(900000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  if (info.project.name === "chromium")
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  const email = `private-${info.project.name}-${Date.now()}@example.invalid`,
    password = "Synthetic-Private-Beta-2026!";
  await page.setViewportSize({ width: 390, height: 844 });
  await go(page, "/signup");
  await page.getByLabel("Neved", { exact: true }).fill("Példa");
  await page.getByLabel("Vállalkozás neve", { exact: true }).fill("Példa Pékség");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Jelszó (legalább 8 karakter)", { exact: true }).fill(password);
  await page.getByLabel("Van meghívókódod?", { exact: true }).fill("wrong");
  await page.getByRole("button", { name: "Regisztráció", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("meghívókód nem megfelelő");
  expect((await db()).users.some((u: { email: string }) => u.email === email)).toBe(false);
  await page
    .getByLabel("Van meghívókódod?", { exact: true })
    .fill("synthetic-private-beta-invitation");
  await page.getByRole("button", { name: "Regisztráció", exact: true }).click();
  await expect(page).toHaveURL(/\/onboarding$/);
  const user = (await db()).users.find((u: { email: string }) => u.email === email);
  expect(user.auth.emailVerifiedAt).toBeNull();
  expect(user.auth.betaInvitedAt).toBeTruthy();
  expect(user.auth.verification).toBeUndefined();
  await page.getByRole("button", { name: /Pékség/ }).click();
  await page.getByRole("button", { name: "Tovább", exact: true }).click();
  await expect(page.getByLabel("Cég neve *", { exact: true })).toHaveValue("Példa Pékség");
  await page.getByLabel(/Fő termékek/).fill("Kovászos kenyér, kakaós csiga, sajtos pogácsa");
  await page.getByLabel(/Város \/ régió/).fill("Csíkszereda");
  await page.getByRole("button", { name: "Tovább", exact: true }).click();
  await page.getByRole("button", { name: "Tovább", exact: true }).click();
  await page.getByRole("button", { name: "Első poszt elkészítése", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/posts\/new/);
  await expect(page.locator("html")).toHaveAttribute("data-app-ready", "true");
  await page.waitForLoadState("networkidle");
  // Three actions: idea chip, create, copy. No platform or voice decision.
  await page.locator("form").getByRole("button").first().click();
  await page.getByRole("button", { name: "Poszt készítése", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/posts\/post_/);
  const postUrl = page.url();
  await page.getByRole("button", { name: "Másolás", exact: true }).click();
  await expect(page.getByText("A szöveget kimásoltuk.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Szerkesztés", exact: true }).click();
  await page
    .getByLabel("Poszt szövege", { exact: true })
    .fill("Kenyér és kakaós csiga Csíkszeredában. Cím: [cím].\n\nÍrj nekünk!");
  await page.getByRole("button", { name: "Szerkesztés kész", exact: true }).click();
  await page.getByLabel("[cím]", { exact: true }).fill("Példa utca 1. (kitalált cím)");
  await page.getByRole("button", { name: "Beillesztés", exact: true }).click();
  await expect(page.getByText("Ezt még egészítsd ki:", { exact: true })).toHaveCount(0);
  for (const label of ["Másik változat", "Rövidebb", "Barátságosabb"]) {
    await page.getByRole("button", { name: label, exact: true }).click();
    await expect(page.getByRole("button", { name: label, exact: true })).toBeEnabled();
  }
  await page.getByRole("button", { name: "Instagram", exact: true }).click();
  await expect(
    page
      .getByText(/#pékség/)
      .filter({ visible: true })
      .first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Másolás", exact: true }).click();
  await page
    .getByRole("button", { name: "Előző szöveg visszaállítása", exact: true })
    .click();
  await expect(page.getByRole("button", { name: "Facebook", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: "Közzétettem", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Közzétéve · kézzel jelölve", exact: true }),
  ).toBeVisible();
  await go(page, "/app/posts");
  await expect(page.getByRole("heading", { name: "Posztjaim", exact: true })).toBeVisible();
  await go(page, "/app/weekly");
  await page.getByRole("button", { name: "Készíts tervet a hétre", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Megnyitás és szerkesztés", exact: true }),
  ).toHaveCount(4, { timeout: 180000 });
  const workspaceId = (await db()).memberships.find(
    (m: { userId: string }) => m.userId === user.id,
  ).workspaceId;
  const postCount = (await db()).posts.filter(
    (p: { workspaceId: string }) => p.workspaceId === workspaceId,
  ).length;
  await mkdir("docs/qa/screens", { recursive: true });
  for (const mode of ["simple", "detailed"] as const) {
    await go(page, "/app/brand");
    await page
      .getByRole("button", { name: mode === "simple" ? /^Egyszerű/ : /^Részletes/ })
      .first()
      .click();
    await expect(page.locator("[data-ui-mode]")).toHaveAttribute("data-ui-mode", mode);
    for (const width of [320, 360, 390, 768, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      for (const url of [
        "/app",
        "/app/posts",
        "/app/weekly",
        "/app/brand",
        ...(mode === "detailed"
          ? ["/app/calendar", "/app/media", "/app/channels", "/app/analytics"]
          : []),
      ]) {
        await go(page, url);
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
          `${url} ${width}`,
        ).toBe(true);
        const nav = page.getByRole("navigation", { name: "Mobil navigáció", exact: true });
        if (await nav.isVisible())
          expect(
            (await nav.getByRole("link").count()) + (await nav.getByRole("button").count()),
          ).toBeLessThanOrEqual(5);
        await page.screenshot({
          path: `docs/qa/screens/${info.project.name}-private-${mode}-${width}-${url.split("/").at(-1) || "home"}.png`,
          fullPage: true,
          timeout: 90000,
          animations: "disabled",
        });
      }
    }
    await go(page, "/app");
    const axe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      axe.violations.map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) })),
    ).toEqual([]);
  }
  await go(page, "/app/brand");
  await page
    .getByRole("button", { name: /^Egyszerű/ })
    .first()
    .click();
  await go(page, "/app/calendar"); // Hidden direct link still works.
  await expect(page.getByRole("heading", { name: /naptár/i }).first()).toBeVisible();
  await go(page, postUrl);
  await expect(
    page.getByRole("button", { name: "Közzétéve · kézzel jelölve", exact: true }),
  ).toBeVisible();
  expect(
    (await db()).posts.filter((p: { workspaceId: string }) => p.workspaceId === workspaceId).length,
  ).toBe(postCount);
  const second = await browser.newContext();
  const fresh = await second.newPage();
  await go(fresh, "/login");
  await fresh.getByLabel("Email", { exact: true }).fill(email);
  await fresh.getByLabel("Jelszó", { exact: true }).fill(password);
  await fresh.getByRole("button", { name: "Bejelentkezés", exact: true }).click();
  await expect(fresh).toHaveURL(/\/app\/?$/);
  await expect(fresh.locator("[data-ui-mode]")).toHaveAttribute("data-ui-mode", "simple");
  await go(fresh, "/forgot-password");
  await fresh.getByLabel("E-mail-cím", { exact: true }).fill(email);
  await fresh.getByRole("button", { name: "Hivatkozás küldése", exact: true }).click();
  await expect(
    fresh.getByRole("status").filter({ hasText: "Valódi levelet nem küldtünk" }),
  ).toBeVisible();
  const messages = (
    await readFile(path.join(directory, "development-outbox/messages.jsonl"), "utf8")
  )
    .trim()
    .split("\n")
    .map((line: string) => JSON.parse(line));
  const mail = messages.reverse().find((m) => m.to === email);
  const reset = mail.text.match(/http:\/\/[^\s]+/)[0];
  await go(fresh, reset);
  await fresh
    .getByLabel(/Új jelszó/)
    .first()
    .fill("Changed-Synthetic-Beta-2026!");
  await fresh.getByRole("button", { name: "Új jelszó mentése", exact: true }).click();
  await expect(fresh.getByRole("status")).toContainText("Elmentettük az új jelszavad");
  await second.close();
  expect(errors).toEqual([]);
});
