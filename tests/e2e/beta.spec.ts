import { test, expect, type Page } from "@playwright/test";
import { readFile, mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
async function go(page: Page, url: string) {
  await page.waitForLoadState("networkidle");
  await page.goto(url);
  await expect(page.locator("html")).toHaveAttribute("data-app-ready", "true");
  await page.waitForLoadState("networkidle");
}
const directory = path.resolve("outputs/beta-e2e-data");
async function onboardingScreens(page: Page, name: string, step: number) {
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    await page.screenshot({
      path: `docs/qa/screens/${name}-${width}-onboarding-step-${step}.png`,
      fullPage: true,
    });
  }
}
async function latestEmail(email: string, subject: string) {
  let link = "";
  await expect
    .poll(async () => {
      const lines = (await readFile(path.join(directory, "outbox.jsonl"), "utf8").catch(() => ""))
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line));
      const message = lines
        .reverse()
        .find((m) => m.to.includes(email) && m.subject.includes(subject));
      link = message?.text.match(/http:\/\/127\.0\.0\.1:8087\/[^\s]+/)?.[0] || "";
      return !!link;
    })
    .toBe(true);
  return link;
}
test("closed beta: onboarding, email, post, campaign, calendar and account lifecycle (mocked providers)", async ({
  page,
}, info) => {
  test.setTimeout(1200000);
  await unlink(path.join(directory, "provider-control.json")).catch(() => undefined);
  const email = `beta-${info.project.name}-${Date.now()}@example.invalid`;
  const password = "Beta-Test-Password-2026!";
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await mkdir("docs/qa/screens", { recursive: true });
  await go(page, "/onboarding");
  await onboardingScreens(page, info.project.name, 1);
  await page.getByRole("button", { name: /Pékség/ }).click();
  await expect(page.getByRole("button", { name: /Pékség/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: "Tovább", exact: true }).click();
  await onboardingScreens(page, info.project.name, 2);
  await page
    .getByLabel("Cég neve *", { exact: true })
    .fill(`TESZT Műhely Pékség ${info.project.name}`);
  await page.getByLabel(/Fő termékek/).fill("Kenyér, kakaós csiga");
  await page.getByLabel(/Város \/ régió/).fill("Csíkszereda");
  await page.waitForTimeout(350);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-app-ready", "true");
  await page.waitForLoadState("networkidle");
  await expect(page.getByLabel("Cég neve *", { exact: true })).toHaveValue(
    `TESZT Műhely Pékség ${info.project.name}`,
  );
  await page.getByRole("button", { name: "Tovább", exact: true }).click();
  await onboardingScreens(page, info.project.name, 3);
  await page.getByRole("button", { name: "Tovább", exact: true }).click();
  await onboardingScreens(page, info.project.name, 4);
  await page.getByLabel("Neved", { exact: true }).fill("Béta Teszt");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Jelszó (legalább 8 karakter)", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Regisztráció", exact: true }).click();
  await expect(page).toHaveURL(/\/verify-email$/);
  await page.waitForLoadState("networkidle");
  await expect(page).toHaveURL(/verify-email/);
  await go(page, "/app/posts/new");
  await page.getByLabel("Az ötleted vagy ajánlatod").fill("Kenyér és kakaós csiga bemutatása");
  await expect(page.getByRole("button", { name: "Poszt készítése", exact: true })).toBeDisabled();
  await expect(page.getByText(/A posztkészítéshez erősítsd/).first()).toBeVisible();
  // Verification uses a real one-time hashed token delivered into the isolated mock outbox.
  await go(page, await latestEmail(email, "Erősítsd"));
  await expect(page.getByText("Az e-mail-címedet megerősítetted.", { exact: false })).toBeVisible();
  await page.getByRole("link", { name: "Első poszt elkészítése" }).click();
  await expect(page).toHaveURL(/app\/posts\/new/);
  await expect(page.locator("html")).toHaveAttribute("data-app-ready", "true");
  await page.waitForLoadState("networkidle");
  await mkdir("docs/qa/screens", { recursive: true });
  await page.screenshot({
    path: `docs/qa/screens/${info.project.name}-post-first.png`,
    fullPage: true,
  });
  await writeFile(
    path.join(directory, `state-${info.project.name}.json`),
    JSON.stringify(await page.context().storageState()),
  );
  await page
    .getByLabel("Az ötleted vagy ajánlatod")
    .fill("Kenyér és kakaós csiga bemutatása. Nem adtam meg a címet, hiányzik a cím.");
  await page.getByRole("button", { name: "Poszt készítése", exact: true }).click();
  await expect(page).toHaveURL(/app\/posts\/post_/, { timeout: 120000 });
  const postUrl = page.url();
  await expect(page.getByLabel("[cím]", { exact: true }).filter({ visible: true })).toBeVisible();
  await page.getByRole("button", { name: "Közzétettem", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("hiányzó");
  await page.getByLabel("[cím]", { exact: true }).filter({ visible: true }).fill("Fő utca 1.");
  await page.getByRole("button", { name: "Beillesztés", exact: true }).click();
  await expect(page.getByLabel("[cím]", { exact: true }).filter({ visible: true })).toHaveCount(0);
  await page.waitForLoadState("networkidle");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-app-ready", "true");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Másolás", exact: true }).click();
  await page.getByRole("button", { name: "Közzétettem", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Közzétéve · kézzel jelölve", exact: true }),
  ).toBeVisible();
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Fiók és beállítások" }).click();
  await page.getByRole("button", { name: /^Részletes/ }).click();
  await expect(page.locator("[data-ui-mode]")).toHaveAttribute("data-ui-mode", "detailed");
  await page.keyboard.press("Escape");
  await go(page, "/app/campaigns?mode=weekly");
  await page
    .locator("#weekly-brief")
    .fill("Kenyér és kakaós csiga bemutatása a héten Csíkszeredában.");
  await writeFile(path.join(directory, "provider-control.json"), JSON.stringify({ status: 402 }));
  await page.getByRole("button", { name: "Heti marketing elkészítése", exact: true }).click();
  await expect(page.getByRole("button", { name: "Újrapróbálom", exact: true })).toBeVisible();
  const db = () => readFile(path.join(directory, "marketingpilot.json"), "utf8").then(JSON.parse);
  const owner = (await db()).users.find((u: { email: string }) => u.email === email);
  const workspaceId = (await db()).memberships.find(
    (m: { userId: string }) => m.userId === owner.id,
  ).workspaceId;
  expect(
    (await db()).campaigns.filter((c: { workspaceId: string }) => c.workspaceId === workspaceId),
  ).toHaveLength(0);
  await page.getByRole("button", { name: "Újrapróbálom", exact: true }).click();
  await expect
    .poll(
      async () =>
        (await db()).campaigns.filter((c: { workspaceId: string }) => c.workspaceId === workspaceId)
          .length,
    )
    .toBe(1);
  await expect(page).toHaveURL(/app\/campaigns\/campaign_/, { timeout: 30000 });
  await expect(page.getByRole("heading", { name: "Heti marketing", exact: true })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-app-ready", "true");
  await go(page, "/app/calendar");
  for (const mode of ["Hét", "Nap", "Hónap"]) {
    await page.getByRole("button", { name: mode, exact: true }).click();
    await expect(page.getByRole("button", { name: mode, exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  }
  await page.getByRole("button", { name: "Hét", exact: true }).click();
  const planItem = (await db()).planItems.find(
    (item: { workspaceId: string; status: string; campaignId: string }) =>
      item.workspaceId === workspaceId && item.campaignId && item.status !== "published",
  );
  await page
    .locator(`[data-plan-item="${planItem.id}"] a[href="#calendar-selected-day"]`)
    .first()
    .click();
  await page.getByRole("button", { name: `Szerkesztés: ${planItem.topic}`, exact: true }).click();
  const calendarForm = page.getByRole("form", { name: `Tartalom szerkesztése: ${planItem.topic}` });
  await calendarForm.getByLabel("Idő", { exact: true }).fill("14:15");
  await calendarForm.getByRole("button", { name: "Mentés", exact: true }).click();
  await expect
    .poll(
      async () =>
        (await db()).planItems.find((item: { id: string }) => item.id === planItem.id)?.time,
    )
    .toBe("14:15");
  const moved = new Date(`${planItem.date}T12:00:00Z`);
  moved.setUTCDate(moved.getUTCDate() + (moved.getUTCDay() === 0 ? -1 : 1));
  const movedDate = moved.toISOString().slice(0, 10);
  await expect(page.getByText("Naptárbejegyzés frissítve.", { exact: true })).toBeVisible();
  await expect(page.locator(`[data-plan-item="${planItem.id}"]`).first()).toHaveAttribute(
    "draggable",
    "true",
  );
  const transfer = await page.evaluateHandle(() => new DataTransfer());
  await page
    .locator(`[data-plan-item="${planItem.id}"]`)
    .first()
    .dispatchEvent("dragstart", { dataTransfer: transfer });
  expect(await transfer.evaluate((t) => t.getData("text/plain"))).toBe(planItem.id);
  await page
    .locator(`[data-calendar-date="${movedDate}"]`)
    .locator(".border-dashed")
    .dispatchEvent("drop", { dataTransfer: transfer });
  await expect
    .poll(
      async () =>
        (await db()).planItems.find((item: { id: string }) => item.id === planItem.id)?.date,
    )
    .toBe(movedDate);
  await transfer.dispose();
  await expect(page.getByText("A tartalom új időpontja mentve.", { exact: true })).toBeVisible();
  expect((await db()).planItems.find((item: { id: string }) => item.id === planItem.id)?.time).toBe(
    "14:15",
  );
  await go(page, "/app/planner");
  await expect(page.getByText(`${movedDate} · 14:15`, { exact: true })).toBeVisible();
  await go(page, "/app/media");
  await page.getByLabel("Médiafájl kiválasztása").setInputFiles({
    name: "beta-test.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aT1cAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await page.getByLabel("Alternatív szöveg", { exact: true }).fill("Béta tesztkép");
  await page.getByRole("button", { name: "Feltöltés", exact: true }).click();
  await expect(page.getByRole("img", { name: "Béta tesztkép" })).toBeVisible();
  const media = (await db()).mediaAssets.find(
    (asset: { workspaceId: string }) => asset.workspaceId === workspaceId,
  );
  const anonymous = await page.context().browser()!.newContext();
  expect(
    (await anonymous.request.get(`http://127.0.0.1:8087/api/media/${media.id}`)).status(),
  ).toBe(401);
  await anonymous.close();
  expect(
    (
      await page.context().request.delete(`http://127.0.0.1:8087/api/media/${media.id}`, {
        headers: { Origin: "https://attack.example.invalid" },
      })
    ).status(),
  ).toBe(403);
  expect((await db()).mediaAssets.some((a: { id: string }) => a.id === media.id)).toBe(true);
  const routes = [
    "/app",
    "/app/posts",
    "/app/posts/new",
    "/app/campaigns",
    "/app/planner",
    "/app/calendar",
    "/app/media",
    "/app/images",
    "/app/brand",
    "/app/channels",
    "/app/analytics",
    "/app/settings",
    postUrl.replace("http://127.0.0.1:8087", ""),
  ];
  const findings: Array<{
    width: number;
    route: string;
    overflow: boolean;
    smallTargets: unknown[];
    clippedControls: unknown[];
    accessibility: unknown[];
  }> = [];
  const widths =
    process.env.E2E_RESPONSIVE === "0"
      ? []
      : process.env.E2E_WIDTHS
        ? process.env.E2E_WIDTHS.split(",").map(Number)
        : [320, 360, 390, 768, 1024, 1280, 1440];
  for (const route of widths.length ? routes : []) {
    await go(page, route);
    for (const width of widths) {
      await page.setViewportSize({ width, height: 844 });
      await page.locator("main").waitFor();
      await page.screenshot({
        path: `docs/qa/screens/${info.project.name}-${width}-${route.replaceAll("/", "-")}.png`,
        fullPage: true,
        caret: "initial",
      });
      const layout = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
        clippedControls: [...document.querySelectorAll<HTMLElement>("button,summary,select")]
          .filter(
            (el) =>
              el.checkVisibility({ checkVisibilityCSS: true, checkOpacity: true }) &&
              el.clientWidth > 0 &&
              el.scrollWidth > el.clientWidth + 2,
          )
          .map((el) => ({
            text: (el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 80),
          })),
        smallTargets: [...document.querySelectorAll<HTMLElement>("button,a,input,select,summary")]
          .filter((el) => {
            if (
              !el.checkVisibility({ checkVisibilityCSS: true, checkOpacity: true }) ||
              el.matches(":disabled")
            )
              return false;
            const target = el.matches(
              "input[type=checkbox],input[type=radio],input[type=file].sr-only",
            )
              ? (el.closest("label") ?? el)
              : el;
            const r = target.getBoundingClientRect();
            return r.width > 0 && r.height > 0 && (r.height < 43.5 || r.width < 43.5);
          })
          .map((el) => ({
            text: (el.textContent || el.getAttribute("aria-label") || el.tagName)
              .trim()
              .slice(0, 75),
            width: Math.round(el.getBoundingClientRect().width),
            height: Math.round(el.getBoundingClientRect().height),
          })),
      }));
      const accessibility =
        width === 390
          ? (
              await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()
            ).violations.map((v) => ({
              id: v.id,
              impact: v.impact,
              nodes: v.nodes.map((n) => ({ target: n.target, detail: n.failureSummary })),
            }))
          : [];
      findings.push({ width, route, ...layout, accessibility });
      await writeFile(
        `docs/qa/${info.project.name}-beta-responsive.json`,
        JSON.stringify(findings, null, 2),
      );
    }
  }
  expect(
    findings.filter(
      (f) =>
        f.overflow || f.smallTargets.length || f.clippedControls.length || f.accessibility.length,
    ),
    "Responsive/accessibility findings",
  ).toEqual([]);
  if (findings.length)
    await writeFile(
      `docs/qa/${info.project.name}-beta-responsive.json`,
      JSON.stringify(findings, null, 2),
    );
  await page.setViewportSize({ width: 1280, height: 700 });
  await go(page, "/app");
  await expect(
    page.locator("aside").getByRole("link", { name: "Csatornák és eredmények", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: `docs/qa/screens/${info.project.name}-1280x700-sidebar.png`,
    caret: "initial",
  });
  await go(page, postUrl);
  await page.getByRole("button", { name: "Fiók és beállítások" }).click();
  await page.getByRole("menuitem", { name: "Kijelentkezés", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await go(page, "/app/posts");
  await expect(page).toHaveURL(/login/);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Jelszó", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Bejelentkezés", exact: true }).click();
  await expect(page).toHaveURL(/\/app$/);
  await go(page, postUrl);
  await expect(page.locator("main")).toContainText("Fő utca 1.");
  await go(page, "/forgot-password");
  await page.getByLabel("E-mail-cím", { exact: true }).fill(email);
  await page.getByRole("button", { name: "Hivatkozás küldése", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Ha ehhez" })).toBeVisible();
  await go(page, await latestEmail(email, "jelszó-visszaállítás"));
  await page.getByLabel("Új jelszó", { exact: true }).fill(`${password}new`);
  await page.getByRole("button", { name: "Új jelszó mentése", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Elmentettük" })).toBeVisible();
  await page.getByRole("link", { name: "Bejelentkezés", exact: true }).click();
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Jelszó", { exact: true }).fill(`${password}new`);
  await page.getByRole("button", { name: "Bejelentkezés", exact: true }).click();
  await expect(page).toHaveURL(/\/app$/);
  await go(page, "/app/settings");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Adataim letöltése" }).click();
  const exported = JSON.parse(await readFile((await (await download).path())!, "utf8"));
  expect(exported.user.id).toBe(owner.id);
  expect(
    exported.posts.every((post: { workspaceId: string }) => post.workspaceId === workspaceId),
  ).toBe(true);
  expect(exported.user.auth).toBeUndefined();
  expect(JSON.stringify(exported)).not.toMatch(
    /"(?:passwordHash|tokenEncrypted|auth_metadata|verification|reset)"\s*:/,
  );
  await page.getByLabel("Jelenlegi jelszó", { exact: true }).fill(`${password}new`);
  await page
    .getByLabel("Új jelszó (legalább 8 karakter)", { exact: true })
    .fill(`${password}changed`);
  await page.getByRole("button", { name: "Jelszó módosítása", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Elmentettük az új jelszavad" }),
  ).toBeVisible();
  const stale = await page
    .context()
    .browser()!
    .newContext({ storageState: path.join(directory, `state-${info.project.name}.json`) });
  const stalePage = await stale.newPage();
  await go(stalePage, "/app/posts");
  await expect(stalePage).toHaveURL(/login/);
  await stale.close();
  await page.getByRole("button", { name: "Fiókom végleges törlése", exact: true }).click();
  await page.getByLabel("Jelenlegi jelszó", { exact: true }).last().fill(`${password}changed`);
  await page.getByLabel("Írd be: TÖRLÉS", { exact: true }).fill("TÖRLÉS");
  await page.getByRole("button", { name: "Végleges törlés", exact: true }).click();
  await expect(page).toHaveURL(/login/);
  expect((await db()).users.some((u: { id: string }) => u.id === owner.id)).toBe(false);
  expect(
    (await db()).posts.some((p: { workspaceId: string }) => p.workspaceId === workspaceId),
  ).toBe(false);
  expect(
    (await db()).campaigns.some((p: { workspaceId: string }) => p.workspaceId === workspaceId),
  ).toBe(false);
  expect(errors).toEqual([]);
});
