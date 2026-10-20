import { expect } from "@playwright/test";
import { test } from "./fixtures";
import { mkdir, writeFile } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";

test("public pages: mobile and desktop layout, controls and accessibility", async ({
  page,
}, info) => {
  test.setTimeout(600000);
  test.skip(process.env.E2E_RESPONSIVE === "0", "Focused workflow iteration");
  await mkdir("docs/qa/screens", { recursive: true });
  const screens = process.env.BASE_URL ? "outputs/preview-screens" : "docs/qa/screens";
  await mkdir(screens, { recursive: true });
  const findings = [];
  const widths = process.env.E2E_WIDTHS
    ? process.env.E2E_WIDTHS.split(",").map(Number)
    : [320, 360, 390, 768, 1024, 1280, 1440];
  for (const route of [
    "/",
    "/login",
    "/onboarding",
    "/forgot-password",
    "/privacy",
    "/terms",
    "/contact",
    "/nonexistent-beta-page",
  ]) {
    await page.goto(route);
    await expect(page.locator("html")).toHaveAttribute("data-app-ready", "true");
    await page.waitForLoadState("networkidle");
    for (const width of widths) {
      await page.setViewportSize({ width, height: 844 });
      await page.screenshot({
        path: `${screens}/${info.project.name}-${width}-public-${route.replaceAll("/", "-") || "home"}.png`,
        fullPage: true,
      });
      const layout = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
        smallTargets: [...document.querySelectorAll<HTMLElement>("button,a,input,select,summary")]
          .filter((el) => {
            if (
              !el.checkVisibility({ checkVisibilityCSS: true, checkOpacity: true }) ||
              el.matches(":disabled")
            )
              return false;
            const target = el.matches("input[type=checkbox],input[type=radio]")
              ? (el.closest("label") ?? el)
              : el;
            const r = target.getBoundingClientRect();
            return r.width > 0 && r.height > 0 && (r.width < 43.5 || r.height < 43.5);
          })
          .map((el) => ({
            text: (el.textContent || el.getAttribute("aria-label") || el.tagName)
              .trim()
              .slice(0, 80),
            width: Math.round(el.getBoundingClientRect().width),
            height: Math.round(el.getBoundingClientRect().height),
          })),
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
        `docs/qa/${info.project.name}-beta-public-responsive.json`,
        JSON.stringify(findings, null, 2),
      );
    }
  }
  expect(
    findings.filter(
      (f) =>
        f.overflow || f.smallTargets.length || f.clippedControls.length || f.accessibility.length,
    ),
    "Public responsive/accessibility findings",
  ).toEqual([]);
});
