import { expect, type Page } from "@playwright/test";
import { test } from "./fixtures";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
const directory = path.resolve("outputs/beta-e2e-data");
const external = !!process.env.BASE_URL;
async function go(page: Page, url: string) {
  await page.waitForLoadState("networkidle");
  await page.goto(url);
  await expect(page.locator("html")).toHaveAttribute("data-app-ready", "true");
  await page.waitForLoadState("networkidle");
}
async function account(page: Page, browserName: string) {
  if (external) {
    // A dedicated verified test user on a disposable Neon branch. Never log credentials.
    if (!process.env.E2E_EMAIL?.endsWith("@example.invalid") || !process.env.E2E_PASSWORD)
      throw new Error("Az előnézeti teszthez elkülönített E2E_EMAIL és E2E_PASSWORD szükséges.");
    await go(page, "/login");
    await page.getByLabel("Email", { exact: true }).fill(process.env.E2E_EMAIL);
    try {
      await page.getByLabel("Jelszó", { exact: true }).fill(process.env.E2E_PASSWORD);
    } catch {
      throw new Error("Az előnézeti tesztfiók belépési mezője nem elérhető.");
    }
    await page.getByRole("button", { name: "Bejelentkezés", exact: true }).click();
    await expect(page).toHaveURL(/\/app/);
    await go(page, "/app/brand");
    await page
      .getByRole("button", { name: /^Egyszerű/ })
      .first()
      .click();
    await expect(page.locator("[data-ui-mode]")).toHaveAttribute("data-ui-mode", "simple");
    await page.getByLabel("Fő csatorna", { exact: false }).selectOption("facebook");
    await page.getByRole("button", { name: "Változtatások mentése", exact: true }).click();
    await expect(page.getByText("A vállalkozásod adatait mentettük.")).toBeVisible();
    return;
  }
  const email = `channel-${browserName}-${Date.now()}@example.invalid`;
  await go(page, "/onboarding");
  await page.getByRole("button", { name: /Pékség/ }).click();
  await page.getByRole("button", { name: "Tovább", exact: true }).click();
  await page.getByLabel("Cég neve *", { exact: true }).fill(`TESZT Csatorna Pékség ${browserName}`);
  await page.getByLabel(/Fő termékek/).fill("Kenyér, kakaós csiga");
  await page.getByRole("button", { name: "Tovább", exact: true }).click();
  await page.getByRole("button", { name: "Tovább", exact: true }).click();
  await page.getByLabel("Neved", { exact: true }).fill("Csatorna Teszt");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page
    .getByLabel("Jelszó (legalább 8 karakter)", { exact: true })
    .fill("Channel-Test-Password-2026!");
  await page.getByRole("button", { name: "Regisztráció", exact: true }).click();
  await expect(page).toHaveURL(/verify-email/);
  let link = "";
  await expect
    .poll(async () => {
      const mail = (await readFile(path.join(directory, "outbox.jsonl"), "utf8"))
        .trim()
        .split("\n")
        .map((s) => JSON.parse(s))
        .reverse()
        .find((m) => m.to.includes(email));
      link = mail?.text.match(/http:\/\/127\.0\.0\.1:8087\/[^\s]+/)?.[0] || "";
      return !!link;
    })
    .toBe(true);
  await go(page, link);
  await expect(page.getByText("Az e-mail-címedet megerősítetted.", { exact: false })).toBeVisible();
}
test("first post → Instagram rewrite → copy → restore, brand preference and responsive layout", async ({
  page,
}, info) => {
  test.setTimeout(300000);
  if (info.project.name === "chromium")
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await mkdir("docs/qa/screens", { recursive: true });
  const screens = external ? "outputs/preview-screens" : "docs/qa/screens";
  await mkdir(screens, { recursive: true });
  await account(page, info.project.name);
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    await go(page, "/app");
    await page
      .getByLabel("Az ötleted vagy ajánlatod")
      .fill("TESZT: kenyér és kakaós csiga bemutatása, árak és akció nélkül.");
    await page.getByRole("button", { name: "Poszt készítése", exact: true }).click();
    await expect(page).toHaveURL(/app\/posts\/post_/, { timeout: 120000 });
    const postUrl = page.url();
    const selector = page.getByRole("group", { name: "Poszt csatornája" });
    await expect(selector.getByRole("button", { name: "Facebook", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await page.getByRole("button", { name: "Szerkesztés", exact: true }).click();
    const edited = "TESZT szerkesztett kenyér és kakaós csiga. Írj nekünk!";
    await page.getByLabel("Poszt szövege", { exact: true }).fill(edited);
    // Click while editing: it must flush the edited source before requesting the rewrite.
    await selector.getByRole("button", { name: "Instagram", exact: true }).click();
    await expect(selector.getByRole("button", { name: "Instagram", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
      { timeout: 120000 },
    );
    await expect(page.locator("main")).toContainText("#pékség");
    await page.getByRole("button", { name: "Másolás", exact: true }).click();
    await expect(page.getByText("A szöveget kimásoltuk.", { exact: true })).toBeVisible();
    if (info.project.name === "chromium") {
      const clipboard = await page.evaluate(() => navigator.clipboard.readText());
      expect(clipboard.match(/#[\p{L}\p{N}_]+/gu)?.length).toBeGreaterThanOrEqual(4);
      expect(clipboard).not.toContain("Ellenőrizendő:");
    }
    await page.screenshot({
      path: `${screens}/${info.project.name}-channel-${width}-instagram.png`,
      fullPage: true,
      caret: "initial",
    });
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(
      false,
    );
    const audit = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    const findings = audit.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
    }));
    await writeFile(
      `outputs/${info.project.name}-channel-${width}-accessibility.json`,
      JSON.stringify(findings, null, 2),
    );
    expect(findings).toEqual([]);
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(selector.getByRole("button", { name: "Instagram", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await go(page, "/app/brand");
    await expect(page.getByLabel("Fő csatorna", { exact: false })).toHaveValue("instagram");
    await go(page, postUrl);
    await page
      .getByRole("button", { name: "Előző szöveg visszaállítása", exact: true })
      .click();
    await expect(page.getByText(edited, { exact: true }).filter({ visible: true })).toBeVisible();
    await expect(selector.getByRole("button", { name: "Facebook", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await go(page, "/app/brand");
    await expect(page.getByLabel("Fő csatorna", { exact: false })).toHaveValue("facebook");
    // Settings save must persist through reload and determine the next new post.
    await page.getByLabel("Fő csatorna", { exact: false }).selectOption("instagram");
    await page.getByRole("button", { name: "Változtatások mentése", exact: true }).click();
    await expect(page.getByText("A vállalkozásod adatait mentettük.")).toBeVisible();
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page.getByLabel("Fő csatorna", { exact: false })).toHaveValue("instagram");
    await go(page, "/app");
    await page.getByLabel("Az ötleted vagy ajánlatod").fill("TESZT kenyér és kakaós csiga.");
    await page.getByRole("button", { name: "Poszt készítése", exact: true }).click();
    await expect(page).toHaveURL(/app\/posts\/post_/, { timeout: 120000 });
    await expect(selector.getByRole("button", { name: "Instagram", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await selector.getByRole("button", { name: "Facebook", exact: true }).click();
    await expect(selector.getByRole("button", { name: "Facebook", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
      { timeout: 120000 },
    );
    const facebookText = await page.locator("main .whitespace-pre-wrap").innerText();
    const tags = facebookText.match(/#[\p{L}\p{N}_]+/gu) ?? [];
    expect(tags.length).toBeGreaterThanOrEqual(1);
    expect(tags.length).toBeLessThanOrEqual(2);
  }
  expect(errors).toEqual([]);
});
