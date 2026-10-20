import { expect, type Page } from "@playwright/test";
import { test } from "./fixtures";
import { readFile } from "node:fs/promises";
import path from "node:path";

const directory = path.resolve("outputs/beta-e2e-data");
const db = async () => JSON.parse(await readFile(path.join(directory, "marketingpilot.json"), "utf8"));

async function go(page: Page, url: string) {
  await page.goto(url);
  await expect(page.locator("html")).toHaveAttribute("data-app-ready", "true");
  await page.waitForLoadState("networkidle");
}

async function register(page: Page, browserName: string) {
  const email = `quick-actions-${browserName}-${Date.now()}@example.invalid`;
  await go(page, "/onboarding");
  await page.getByRole("button", { name: /Pékség/ }).click();
  await page.getByRole("button", { name: "Tovább", exact: true }).click();
  await page.getByLabel("Cég neve *", { exact: true }).fill(`TESZT Pékség ${browserName}`);
  await page.getByLabel(/Fő termékek/).fill("Kovászos kenyér, kakaós csiga");
  await page.getByRole("button", { name: "Tovább", exact: true }).click();
  await page.getByRole("button", { name: "Tovább", exact: true }).click();
  await page.getByLabel("Neved", { exact: true }).fill("Teszt Felhasználó");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Jelszó (legalább 8 karakter)", { exact: true }).fill("Quick-Test-Password-2026!");
  await page.getByRole("button", { name: "Regisztráció", exact: true }).click();
  await expect(page).toHaveURL(/verify-email/);
  let link = "";
  await expect.poll(async () => {
    const mail = (await readFile(path.join(directory, "outbox.jsonl"), "utf8"))
      .trim().split("\n").map((line) => JSON.parse(line)).reverse().find((item) => item.to.includes(email));
    link = mail?.text.match(/http:\/\/127\.0\.0\.1:8087\/[^\s]+/)?.[0] ?? "";
    return Boolean(link);
  }).toBe(true);
  await go(page, link);
  await expect(page.getByText("Az e-mail-címedet megerősítetted.", { exact: false })).toBeVisible();
}

test("simple quick edits and pasted-copy improvement work at 390 and 1280px", async ({ page }, info) => {
  test.skip(!!process.env.BASE_URL, "A gyorsműveletek e2e ellenőrzése helyi, elkülönített AI-mockkal fut.");
  test.setTimeout(240000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await register(page, info.project.name);
  const topic = "Hétvégi kenyérajánlat Csíkszeredában";
  await go(page, `/app/posts/new?first=1&topic=${encodeURIComponent(topic)}`);
  await expect(page.getByRole("status")).toContainText("Üdvözlünk");
  await expect(page.getByLabel("Az ötleted vagy ajánlatod", { exact: true })).toHaveValue(topic);
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    await go(page, "/app");
    await page.getByText("Van már szövegem", { exact: true }).click();
    await page.getByLabel("Saját szöveg", { exact: true }).fill("Kovászos kenyér és kakaós csiga. Írj nekünk!");
    await page.getByRole("button", { name: "Javítsd a szövegem", exact: true }).click();
    await expect(page.getByRole("heading", { name: "A posztod elkészült", exact: true })).toBeVisible();
    await expect(page.getByText("Erősebb nyitás:", { exact: false })).toBeVisible();

    await page.getByRole("button", { name: "Erősebb nyitósor", exact: true }).click();
    const openings = page.getByRole("button", { name: /^(kérdés|konkrét kép|hasznos tipp|szezon|érzés):/i });
    await expect(openings).toHaveCount(5);
    const before = (await db()).posts.at(-1);
    const beforeText = (await db()).postVariants.find((variant: { postId: string }) => variant.postId === before.id).content;
    await openings.first().click();
    await expect(page.getByRole("button", { name: "Előző szöveg visszaállítása", exact: true })).toBeVisible();
    const afterOpening = (await db());
    const updated = afterOpening.posts.find((item: { id: string }) => item.id === before.id);
    expect(updated.updatedAt).not.toBe(before.updatedAt);
    expect(afterOpening.postVersions.some((version: { postId: string; content: string }) => version.postId === before.id && version.content === beforeText)).toBe(true);
    await page.getByRole("button", { name: "Előző szöveg visszaállítása", exact: true }).click();
    await expect(page.locator("main")).toContainText(beforeText);

    await page.getByRole("button", { name: "Kérdéssel zárom", exact: true }).click();
    const questions = page.getByRole("button", { name: /\?$/ });
    await expect(questions).toHaveCount(4);
    await questions.first().click();
    await expect(page.locator("main")).toContainText(/\?/);
  }

  await go(page, "/app/brand");
  const detailed = page.getByRole("button", { name: /^Részletes/ }).first();
  await detailed.click();
  await expect(page.locator("[data-ui-mode]")).toHaveAttribute("data-ui-mode", "detailed");
  await go(page, "/app");
  await page.getByText("Ez bejött, készíts hasonlót", { exact: true }).click();
  await page.getByLabel("Jól működő poszt mintája", { exact: true }).fill("Kovászos kenyér és kakaós csiga. Írj nekünk!");
  await page.getByRole("button", { name: "Készíts 3 hasonlót", exact: true }).click();
  await expect(page.getByRole("link", { name: /Kérdés a választásról/ })).toBeVisible();
  expect((await db()).posts.filter((post: { title: string }) => /választás|kínálat|témája/i.test(post.title)).length).toBeGreaterThanOrEqual(3);
  await go(page, "/app/weekly");
  await expect(page.getByText("Elég hetente 3 poszt. A rendszeresség fontosabb, mint a mennyiség.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Ötletbank készítése", exact: true }).click();
  await expect(page.locator("ol li")).toHaveCount(20);
  const countBeforeReload = (await readFile(path.join(directory, "mock-calls.jsonl"), "utf8")).trim().split("\n").filter((line) => JSON.parse(line).schema === "business_idea_bank").length;
  await page.reload();
  await expect(page.locator("ol li")).toHaveCount(20);
  const countAfterReload = (await readFile(path.join(directory, "mock-calls.jsonl"), "utf8")).trim().split("\n").filter((line) => JSON.parse(line).schema === "business_idea_bank").length;
  expect(countAfterReload).toBe(countBeforeReload);

  const calls = JSON.parse(await readFile(path.join(directory, "ai-calls.json"), "utf8"));
  for (const endpoint of ["improve_user_copy", "post_opening_options", "post_question_closings", "similar_posts", "business_idea_bank"])
    expect(calls.some((call: { endpoint: string; status: string }) => call.endpoint === endpoint && call.status === "success")).toBe(true);
  expect(errors).toEqual([]);
});
