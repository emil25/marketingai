import { expect } from "@playwright/test";
import { test } from "./fixtures";

test("release smoke: public entry renders and operator cron rejects ordinary browser access", async ({ page, request }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", error => pageErrors.push(error.name));
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/login");
    await expect(page.locator("html")).toHaveAttribute("data-app-ready", "true");
    await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Bejelentkezés", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  }
  for (const headers of [{}, { Authorization: "Bearer intentionally-invalid-release-test" }, { "user-agent": "vercel-cron/1.0" }]) {
    const response = await request.get("/api/cron/ai-monitor", { headers });
    expect(response.status()).toBe(401);
    expect(response.headers()["cache-control"]).toBe("no-store");
    expect(await response.json()).toEqual({ error: "UNAUTHORIZED" });
  }
  await page.goto("/api/cron/ai-monitor");
  await expect(page.locator("body")).toContainText("UNAUTHORIZED");
  expect(pageErrors).toEqual([]);
});
