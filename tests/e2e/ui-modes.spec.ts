import { test, expect, type Page } from "@playwright/test";
import { readFile, mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
const directory = path.resolve("outputs/beta-e2e-data");
const qaScreensDir = process.env.QA_SCREENSHOT_DIR || "docs/qa/screens";
const qaReportDir = process.env.QA_REPORT_DIR || "docs/qa";
async function go(page: Page, url: string) {
  await page.waitForLoadState("networkidle");
  await page.goto(url);
  await expect(page.locator("html")).toHaveAttribute("data-app-ready", "true");
  await page.waitForLoadState("networkidle");
}
async function mode(page: Page, value: "simple" | "detailed") {
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Fiók és beállítások" }).click();
  await page
    .getByRole("menu")
    .getByRole("button", { name: value === "simple" ? /^Egyszerű/ : /^Részletes/ })
    .click();
  await expect(page.locator("[data-ui-mode]")).toHaveAttribute("data-ui-mode", value);
  await page.keyboard.press("Escape");
}
test("two modes: signup, three-click post, autosave, weekly plan, persistence, isolation and responsive UI (mocked AI/email)", async ({
  page,
  browser,
}, info) => {
  test.setTimeout(900000);
  await page.setViewportSize({ width: 390, height: 844 });
  if (info.project.name === "chromium")
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await unlink(path.join(directory, "provider-control.json")).catch(() => undefined);
  const email = `modes-${info.project.name}-${Date.now()}@example.invalid`,
    password = "Modes-Test-Password-2026!";
  await mkdir(qaScreensDir, { recursive: true });
  await go(page, "/onboarding");
  await page
    .getByLabel("Cég neve *", { exact: true })
    .fill(`TESZT Módok Pékség ${info.project.name}`);
  await page.getByLabel(/Mit kínálsz/).fill("Kenyér, kakaós csiga");
  await page.getByLabel(/Település \(magyar névvel\)/).fill("Csíkszereda");
  await page.getByRole("button", { name: "Tovább", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Hozd létre a fiókod" })).toBeVisible();
  await page.getByLabel("Neved", { exact: true }).fill("Mód Teszt");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Jelszó (legalább 8 karakter)", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Regisztráció", exact: true }).click();
  await expect(page).toHaveURL(/verify-email/);
  let verify = "";
  await expect
    .poll(async () => {
      const mail = (await readFile(path.join(directory, "outbox.jsonl"), "utf8"))
        .trim()
        .split("\n")
        .map((s) => JSON.parse(s))
        .reverse()
        .find((m) => m.to.includes(email));
      verify = mail?.text.match(/http:\/\/127\.0\.0\.1:8087\/[^\s]+/)?.[0] || "";
      return !!verify;
    })
    .toBe(true);
  await go(page, verify);
  await expect(page.getByText("Az e-mail-címedet megerősítetted.", { exact: false })).toBeVisible();
  await go(page, "/app");
  await expect(page.locator("[data-ui-mode]")).toHaveAttribute("data-ui-mode", "simple");
  // First post: idea chip -> generate -> copy. No platform, tone or type decision.
  const ideaButton = page.locator("form").getByRole("button").first();
  const selectedIdea = (await ideaButton.innerText()).trim();
  await ideaButton.click();
  await expect(ideaButton).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("Az ötleted vagy ajánlatod")).toHaveValue(selectedIdea);
  expect(
    await ideaButton.evaluate((element) => element.getBoundingClientRect().height),
  ).toBeGreaterThanOrEqual(44);
  await page.getByRole("button", { name: "Poszt készítése", exact: true }).click();
  await expect(page).toHaveURL(/app\/posts\/post_/, { timeout: 120000 });
  await expect(page.getByText("Közvetlen közzététel", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Csatorna csatlakoztatása" })).toBeVisible();
  const postUrl = page.url();
  for (const label of ["Másolás", "Szerkesztés", "Másik változat"])
    expect(
      await page
        .getByRole("button", { name: label, exact: true })
        .evaluate((element) => element.getBoundingClientRect().height),
      `${label} touch target`,
    ).toBeGreaterThanOrEqual(44);
  await page.getByRole("button", { name: "Másolás", exact: true }).click();
  await expect(page.getByText("A szöveget kimásoltuk.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Szerkesztés", exact: true }).click();
  await page
    .getByLabel("Poszt szövege", { exact: true })
    .fill("TESZT szerkesztett poszt kenyérről és kakaós csigáról. Írj nekünk!");
  await expect(page.getByRole("status").filter({ hasText: "Automatikusan mentve" })).toBeVisible();
  await page.waitForLoadState("networkidle");
  await page.reload();
  await expect(
    page
      .getByText("TESZT szerkesztett poszt kenyérről és kakaós csigáról. Írj nekünk!", {
        exact: true,
      })
      .filter({ visible: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Rövidebb", exact: true }).click();
  await expect(
    page
      .getByText("Kenyér és kakaós csiga.\n\nÍrj nekünk!", { exact: true })
      .filter({ visible: true }),
  ).toBeVisible();
  const db = () => readFile(path.join(directory, "marketingpilot.json"), "utf8").then(JSON.parse);
  const owner = (await db()).users.find((u: { email: string }) => u.email === email);
  const workspaceId = (await db()).memberships.find(
    (m: { userId: string }) => m.userId === owner.id,
  ).workspaceId;
  expect(
    (await db()).postVersions.filter((v: { postId: string }) => postUrl.endsWith(v.postId)).length,
  ).toBeGreaterThanOrEqual(2);
  await go(page, "/app/posts");
  await expect(page.getByRole("heading", { name: "Posztjaim", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Kész", exact: true })).toBeVisible();
  await go(page, "/app/weekly");
  await writeFile(path.join(directory, "provider-control.json"), JSON.stringify({ status: 402 }));
  await page.getByRole("button", { name: "Készíts tervet a hétre", exact: true }).click();
  await expect(page.getByRole("button", { name: "Újrapróbálom", exact: true })).toBeVisible();
  expect(
    (await db()).campaigns.filter((c: { workspaceId: string }) => c.workspaceId === workspaceId),
  ).toHaveLength(0);
  await page.getByRole("button", { name: "Újrapróbálom", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Megnyitás és szerkesztés", exact: true }),
  ).toHaveCount(4, { timeout: 120000 });
  expect(
    (await db()).campaigns.filter((c: { workspaceId: string }) => c.workspaceId === workspaceId),
  ).toHaveLength(1);
  const counts = () =>
    db().then((d) => ({
      posts: d.posts.filter((p: { workspaceId: string }) => p.workspaceId === workspaceId).length,
      plans: d.planItems.filter((p: { workspaceId: string }) => p.workspaceId === workspaceId)
        .length,
    }));
  await expect(page.getByRole("button", { name: "Újrapróbálom", exact: true })).toHaveCount(0);
  expect(
    (await db()).aiJobs.filter(
      (j: { workspaceId: string; type: string }) =>
        j.workspaceId === workspaceId && j.type === "campaign",
    ),
  ).toHaveLength(1);
  const before = await counts();
  await expect(page.getByRole("button", { name: "Most nem", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Most nem", exact: true }).click();
  await expect(page.getByRole("button", { name: "Most nem", exact: true })).toHaveCount(0);
  await page.reload();
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("button", { name: "Most nem", exact: true })).toHaveCount(0);
  await mode(page, "detailed");
  await expect(
    page
      .getByRole("navigation", { name: "Kapcsolódó oldalak" })
      .getByRole("link", { name: "Naptár", exact: true }),
  ).toBeVisible();
  await go(page, "/app/calendar");
  await expect(page.getByRole("button", { name: "Hónap", exact: true })).toBeVisible();
  await mode(page, "simple");
  await expect(page.getByRole("button", { name: "Hónap", exact: true })).toBeVisible();
  expect(await counts()).toEqual(before);
  // Direct access remains supported; switching never authorizes extra data access.
  await go(page, "/app/media");
  await expect(page.locator("main")).toContainText("Médiatár");
  await go(page, postUrl);
  await expect(page.getByRole("heading", { name: "A posztod elkészült" })).toBeVisible();
  await go(page, "/app");
  await page.getByLabel("Az ötleted vagy ajánlatod").fill("TESZT megőrzött ötlet");
  await mode(page, "detailed");
  await mode(page, "simple");
  await expect(page.getByLabel("Az ötleted vagy ajánlatod")).toHaveValue("TESZT megőrzött ötlet");
  // Strict authenticated API and CSRF; no user/workspace selector is accepted.
  expect((await page.request.get("/api/ui-preferences")).status()).toBe(200);
  expect(
    (
      await page.request.put("/api/ui-preferences", {
        data: { ui_mode: "wrong" },
        headers: { Origin: "http://127.0.0.1:8087" },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await page.request.put("/api/ui-preferences", {
        data: { ui_mode: "detailed", userId: "another-user" },
        headers: { Origin: "http://127.0.0.1:8087" },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await page.request.put("/api/ui-preferences", {
        data: { ui_mode: "detailed" },
        headers: { Origin: "https://foreign.invalid" },
      })
    ).status(),
  ).toBe(403);
  const anonymous = await browser.newContext();
  expect((await anonymous.request.get("http://127.0.0.1:8087/api/ui-preferences")).status()).toBe(
    401,
  );
  await anonymous.close();
  const findings: unknown[] = [];
  for (const view of ["simple", "detailed"] as const) {
    await mode(page, view);
    for (const route of [
      "/app",
      postUrl.replace("http://127.0.0.1:8087", ""),
      "/app/posts",
      "/app/weekly",
      "/app/brand",
    ]) {
      await go(page, route);
      for (const width of [360, 390, 768, 1280]) {
        await page.setViewportSize({ width, height: 844 });
        await page.screenshot({
          path: path.join(
            qaScreensDir,
            `${info.project.name}-modes-${view}-${width}-${route.split("/").pop() || "home"}.png`,
          ),
          fullPage: true,
          caret: "initial",
        });
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
          `${view} ${route} ${width} overflow`,
        ).toBe(false);
        const mobile = page.getByRole("navigation", { name: "Mobil navigáció" });
        expect(await mobile.locator("a,button").count()).toBeLessThanOrEqual(5);
        if (width < 1024)
          expect(await mobile.locator("a,button").count()).toBe(view === "simple" ? 4 : 5);
        if (width === 390) {
          const audit = await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
            .analyze();
          findings.push(
            ...audit.violations.map((v) => ({
              view,
              route,
              id: v.id,
              nodes: v.nodes.map((n) => n.target),
            })),
          );
        }
      }
    }
  }
  await mkdir(qaReportDir, { recursive: true });
  await writeFile(
    path.join(qaReportDir, `${info.project.name}-ui-modes-accessibility.json`),
    JSON.stringify(findings, null, 2),
  );
  expect(findings).toEqual([]);
  // A fresh device authenticates independently (no copied cookie) and reads the saved mode.
  const device = await browser.newContext();
  const other = await device.newPage();
  await go(other, "/login");
  await other.getByLabel("Email", { exact: true }).fill(email);
  await other.getByLabel("Jelszó", { exact: true }).fill(password);
  await other.getByRole("button", { name: "Bejelentkezés", exact: true }).click();
  await expect(other.locator("[data-ui-mode]")).toHaveAttribute("data-ui-mode", "detailed");
  await mode(other, "simple");
  await other.reload();
  await expect(other.locator("[data-ui-mode]")).toHaveAttribute("data-ui-mode", "simple");
  expect(
    (await db()).users.find((u: { id: string }) => u.id === owner.id).uiModeSuggestionDismissed,
  ).toBe(true);
  expect(await counts()).toEqual(before);
  await device.close();
  // Advanced tools load on demand and remain available after the simple-mode changes.
  await go(page, postUrl);
  await mode(page, "detailed");
  await page.getByText("Több beállítás: kép, időzítés és szövegötletek", { exact: true }).click();
  await expect(page.getByRole("heading", { name: "Poszt szerkesztése", exact: true })).toBeVisible();
  await page.waitForLoadState("networkidle");
  expect(errors).toEqual([]);
});
