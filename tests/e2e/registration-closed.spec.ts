import { expect } from "@playwright/test";
import { test } from "./fixtures";

test("closed registration explains the next step instead of showing a disabled form", async ({
  page,
}) => {
  test.skip(!!process.env.BASE_URL, "This check targets the local closed-beta configuration.");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/signup");
  await expect(page.locator("html")).toHaveAttribute("data-app-ready", "true");
  await expect(page.getByRole("status")).toContainText("Most nem tudsz új fiókot létrehozni");
  await expect(page.getByRole("status")).toContainText("még nincs bekapcsolva");
  await expect(page.getByLabel("Neved", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Már van fiókom · Belépés" })).toHaveAttribute(
    "href",
    "/login",
  );
  await expect(page.getByRole("link", { name: "Kapcsolat", exact: true })).toHaveAttribute(
    "href",
    "/contact",
  );
});
