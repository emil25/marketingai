import { test, expect, type Page } from "@playwright/test";
import { readFile, mkdir, copyFile } from "node:fs/promises";
import path from "node:path";
import { LANDING_EXAMPLE } from "../../src/lib/landing-example";

// Actual UI screenshots with a fictional brand in the isolated local store.
// AI/mail are mocked by the existing e2e preload. The published example is
// explicitly labelled editorial, never a claimed live model response.
const directory = path.resolve("outputs/beta-e2e-data");
const captures = "outputs/landing-preview-assets";
async function go(page: Page, url: string) {
  await page.goto(url);
  await expect(page.locator("html")).toHaveAttribute("data-app-ready", "true");
  await page.waitForLoadState("networkidle");
}
async function edit(page: Page) {
  await page.getByRole("button", { name: "Szerkesztés", exact: true }).click();
  await page.getByLabel("Poszt szövege", { exact: true }).fill(LANDING_EXAMPLE.text);
  await page.getByRole("button", { name: "Szerkesztés kész", exact: true }).click();
  // The textarea already contains this text while the async save is pending.
  // Wait for the editor to close and the server acknowledgement before reload.
  await expect(page.getByLabel("Poszt szövege", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Automatikusan mentve", { exact: true })).toBeVisible();
  await expect(page.getByText(LANDING_EXAMPLE.text, { exact: true })).toBeVisible();
}
test("capture current simple-mode previews with a fictional example brand", async ({
  page,
}, info) => {
  test.skip(
    !!process.env.BASE_URL || info.project.name !== "chromium",
    "Local isolated preview capture only.",
  );
  test.setTimeout(420000);
  await mkdir(captures, { recursive: true });
  await page.setViewportSize({ width: 1200, height: 630 });
  await page.setContent(
    `<html><body style="margin:0">${await readFile("public/images/marketingpilot-share.svg", "utf8")}</body></html>`,
  );
  await page.screenshot({ path: `${captures}/marketingpilot-share.png` });
  await page.setViewportSize({ width: 1280, height: 900 });
  const email = `landing-preview-${Date.now()}@example.invalid`;
  await go(page, "/onboarding");
  await page.getByRole("button", { name: /Pékség/ }).click();
  await page.getByRole("button", { name: "Tovább", exact: true }).click();
  await page.getByLabel("Cég neve *", { exact: true }).fill(LANDING_EXAMPLE.brand);
  await page.getByLabel(/Fő termékek/).fill("Kenyér, kakaós csiga");
  await page.getByRole("button", { name: "Tovább", exact: true }).click();
  await page.getByRole("button", { name: "Tovább", exact: true }).click();
  await page.getByLabel("Neved", { exact: true }).fill("Példa");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Jelszó (legalább 8 karakter)", { exact: true }).fill("Preview-Only-2026!");
  await page.getByRole("button", { name: "Regisztráció", exact: true }).click();
  await expect(page).toHaveURL(/verify-email/);
  let verification = "";
  await expect
    .poll(async () => {
      const mail = (await readFile(path.join(directory, "outbox.jsonl"), "utf8"))
        .trim()
        .split("\n")
        .map((s) => JSON.parse(s))
        .reverse()
        .find((m) => m.to.includes(email));
      verification = mail?.text.match(/http:\/\/127\.0\.0\.1:8087\/[^\s]+/)?.[0] || "";
      return !!verification;
    })
    .toBe(true);
  await go(page, verification);
  await go(page, "/app");
  await expect(page.locator("[data-ui-mode]")).toHaveAttribute("data-ui-mode", "simple");
  await expect(page.getByLabel("Az ötleted vagy ajánlatod")).toBeVisible();
  await page.getByLabel("Az ötleted vagy ajánlatod").fill(LANDING_EXAMPLE.idea);
  await page.screenshot({
    path: `${captures}/marketingpilot-simple-home.jpg`,
    type: "jpeg",
    quality: 90,
  });
  await page.getByRole("button", { name: "Poszt készítése", exact: true }).click();
  await expect(page).toHaveURL(/app\/posts\/post_/, { timeout: 120000 });
  await edit(page);
  await page.reload();
  await page.waitForLoadState("networkidle");
  await expect(page.getByText(LANDING_EXAMPLE.text, { exact: true })).toBeVisible();
  await page.screenshot({
    path: `${captures}/marketingpilot-simple-result.jpg`,
    type: "jpeg",
    quality: 90,
  });
  await go(page, "/app/weekly");
  await page.getByRole("button", { name: "Készíts tervet a hétre", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Megnyitás és szerkesztés", exact: true }),
  ).toHaveCount(4, { timeout: 120000 });
  const data = JSON.parse(await readFile(path.join(directory, "marketingpilot.json"), "utf8"));
  const user = data.users.find((u: { email: string }) => u.email === email);
  const workspaceId = data.memberships.find(
    (m: { userId: string }) => m.userId === user.id,
  ).workspaceId;
  const items = data.planItems.filter(
    (i: { workspaceId: string; postId: string }) => i.workspaceId === workspaceId && i.postId,
  );
  for (const item of items) {
    await go(page, `/app/posts/${item.postId}`);
    await edit(page);
  }
  await go(page, "/app/brand");
  await page
    .getByRole("button", { name: /^Részletes/ })
    .first()
    .click();
  await expect(page.locator("[data-ui-mode]")).toHaveAttribute("data-ui-mode", "detailed");
  await go(page, "/app/calendar");
  await page.getByRole("button", { name: "Hónap", exact: true }).click();
  await expect(page.getByRole("button", { name: "Hónap", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("button", { name: "Hónap", exact: true })).toBeEnabled();
  await expect(page.locator(`[data-plan-item="${items[0].id}"]`).first()).toBeVisible();
  await expect(page.locator("main")).not.toContainText("Műhely Pékség");
  await page.screenshot({
    path: `${captures}/marketingpilot-detailed-calendar.jpg`,
    type: "jpeg",
    quality: 90,
  });
  // Publish only after all UI interactions finish: public-file writes trigger
  // Vite reloads and must not interrupt editing or invalidate a screenshot.
  for (const filename of ["marketingpilot-share.png", "marketingpilot-simple-home.jpg", "marketingpilot-simple-result.jpg", "marketingpilot-detailed-calendar.jpg"])
    await copyFile(`${captures}/${filename}`, `public/images/${filename}`);
});

test("refresh populated month calendar preview", async ({ page }, info) => {
  test.setTimeout(300000);
  test.skip(
    !!process.env.BASE_URL || info.project.name !== "chromium",
    "Isolated local preview only.",
  );
  const data = JSON.parse(await readFile(path.join(directory, "marketingpilot.json"), "utf8"));
  const brand = data.brands
    .filter((b: { name: string }) => b.name === LANDING_EXAMPLE.brand)
    .at(-1);
  const member = data.memberships.find(
    (m: { workspaceId: string }) => m.workspaceId === brand?.workspaceId,
  );
  const user = data.users.find((u: { id: string }) => u.id === member?.userId);
  if (!user?.email?.startsWith("landing-preview-") || !user.email.endsWith("@example.invalid"))
    throw new Error(
      "First run the isolated fictional-brand capture. Real accounts are never used.",
    );
  await page.setViewportSize({ width: 1280, height: 900 });
  await go(page, "/login");
  await page.getByLabel("Email", { exact: true }).fill(user.email);
  await page.getByLabel("Jelszó", { exact: true }).fill("Preview-Only-2026!");
  await page.getByRole("button", { name: "Bejelentkezés", exact: true }).click();
  await expect(page).toHaveURL(/\/app/);
  await go(page, "/app/calendar");
  await page.getByRole("button", { name: "Hónap", exact: true }).click();
  await expect(page.getByRole("button", { name: "Hónap", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("button", { name: "Hónap", exact: true })).toBeEnabled();
  await expect(page.locator("[data-plan-item]").first()).toBeVisible();
  await expect(page.locator("main")).not.toContainText("Műhely Pékség");
  await page.screenshot({
    path: "public/images/marketingpilot-detailed-calendar.jpg",
    type: "jpeg",
    quality: 90,
  });
});
