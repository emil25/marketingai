import { mkdir, writeFile, readFile, open, access } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { chromium, expect } from "@playwright/test";
import { demoFixture, QA_BRANDS } from "./demo-fixture";
import { isProductionEnvironment } from "../src/lib/server/production-config.server";

if (isProductionEnvironment() || process.env.VERCEL)
  throw new Error("AI QA csak elkülönített helyi fejlesztői tárolóban futtatható.");
// Load credentials internally; never print them, place them in arguments, or include them in reports.
try {
  process.loadEnvFile(".env");
} catch {
  /* Optional local provider configuration. */
}
if (isProductionEnvironment() || process.env.VERCEL)
  throw new Error("Éles környezetben a QA nem indul.");
const providerArg = process.argv.find((value) => value.startsWith("--provider="))?.slice("--provider=".length);
const configuredProvider = (
  providerArg?.trim().toLowerCase() ||
  process.env.QA_TEXT_PROVIDER?.trim().toLowerCase() ||
  process.env.AI_TEXT_PROVIDER?.trim().toLowerCase() ||
  (process.env.GEMINI_API_KEY?.trim() && !process.env.OPENROUTER_API_KEY?.trim()
    ? "gemini"
    : process.env.GROQ_API_KEY?.trim() && !process.env.OPENROUTER_API_KEY?.trim()
      ? "groq"
      : "openrouter")
);
if (configuredProvider !== "openrouter" && configuredProvider !== "gemini" && configuredProvider !== "groq")
  throw new Error("A QA_TEXT_PROVIDER csak openrouter, gemini vagy groq lehet.");
const provider = configuredProvider;
const providerKey =
  provider === "gemini"
    ? process.env.GEMINI_API_KEY?.trim()
    : provider === "groq"
      ? process.env.GROQ_API_KEY?.trim()
      : process.env.OPENROUTER_API_KEY?.trim();
const live = !!providerKey && process.env.QA_FORCE_MOCK !== "true";
const directory = path.resolve(`outputs/ai-qa-${Date.now()}`),
  samples = path.join(directory, "samples");
await mkdir(directory, { recursive: true, mode: 0o700 });
await mkdir(samples, { recursive: true });
const fixture = demoFixture(false);
await writeFile(path.join(directory, "marketingpilot.json"), JSON.stringify(fixture.db), {
  flag: "wx",
  mode: 0o600,
});
const log = await open(path.join(directory, "runtime.log"), "a", 0o600);
const origin = "http://127.0.0.1:8091";
const child = spawn(
  process.execPath,
  [
    "--import",
    "./scripts/qa-provider.mjs",
    "node_modules/vite/bin/vite.js",
    "--host",
    "127.0.0.1",
    "--port",
    "8091",
    "--strictPort",
  ],
  {
    stdio: ["ignore", log.fd, log.fd],
    env: {
      ...process.env,
      NODE_ENV: "development",
      VERCEL: "",
      VERCEL_ENV: "",
      DATABASE_URL: "",
      DIRECT_URL: "",
      BLOB_READ_WRITE_TOKEN: "",
      MEDIA_STORAGE: "local",
      ENABLE_LOCAL_ADMIN_LOGIN: "false",
      MARKETINGPILOT_JSON_FIXTURE: "true",
      MARKETINGPILOT_PREVIEW_TEST_AI: "false",
      MARKETINGPILOT_QA: "1",
      MARKETINGPILOT_DATA_DIR: directory,
      QA_PROVIDER_MOCK: live ? "false" : "true",
      AI_TEXT_PROVIDER: provider,
      OPENROUTER_API_KEY:
        provider === "openrouter" && live ? providerKey! : "explicit-qa-mock",
      GEMINI_API_KEY: provider === "gemini" && live ? providerKey! : "explicit-qa-mock",
      GROQ_API_KEY: provider === "groq" && live ? providerKey! : "explicit-qa-mock",
      SESSION_SECRET: "isolated-fictional-ai-qa-session-2026",
      PUBLIC_APP_URL: origin,
      BETA_MODE: "off",
      RESEND_API_KEY: "",
      EMAIL_FROM: "",
      WEEKLY_REMINDERS_ENABLED: "false",
      TURNSTILE_SITE_KEY: "",
      TURNSTILE_SECRET_KEY: "",
    },
  },
);
async function installedChromiumPath() {
  const candidates = [
    process.env.QA_CHROMIUM_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  ].filter((value): value is string => !!value?.trim());
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next locally installed browser.
    }
  }
  return undefined;
}
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
const results: Array<{ brand: string; status: string }> = [];
const db = async () =>
  JSON.parse(await readFile(path.join(directory, "marketingpilot.json"), "utf8"));
async function completed(page: import("@playwright/test").Page, success: Promise<unknown>) {
  await Promise.race([
    success,
    page
      .getByRole("alert")
      .filter({
        hasText: /nem érhető el|nem készült|nem adott|nem elegendő|próbáld újra|Próbáld újra|hibás/,
      })
      .first()
      .waitFor({ state: "visible", timeout: 480000 })
      .then(() => {
        throw new Error("A felületen hibaüzenet jelent meg.");
      }),
  ]);
}
try {
  const executablePath = await installedChromiumPath();
  browser = await chromium.launch(executablePath ? { executablePath } : undefined);
  let ready = false;
  for (let i = 0; i < 120; i++) {
    if (child.exitCode !== null) throw new Error("A QA előnézeti szervere nem indult.");
    try {
      if ((await fetch(origin + "/api/health")).ok) {
        ready = true;
        break;
      }
    } catch {
      /* Start-up wait. */
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  if (!ready) throw new Error("A QA előnézeti szervere nem válaszol.");
  console.log(
    live
      ? `Valódi ${provider === "gemini" ? "Gemini" : "OpenRouter"} QA, kizárólag kitalált márkákkal.`
      : `Explicit mock QA (${provider}); ez nem valódi AI-eredmény.`,
  );
  for (const [index, brand] of QA_BRANDS.entries()) {
    const context = await browser.newContext(),
      page = await context.newPage();
    page.setDefaultTimeout(120000);
    let failure = false;
    let stage = "belépés";
    let failureMessage = "";
    const stages: Array<{ stage: string; status: string; message?: string }> = [];
    async function operation(name: string, run: () => Promise<void>) {
      stage = name;
      try {
        await run();
        stages.push({ stage: name, status: "PASS" });
      } catch {
        failure = true;
        const message =
          (
            await page
              .getByRole("alert")
              .first()
              .textContent()
              .catch(() => "")
          )?.slice(0, 1500) || "A böngészős lépés nem fejeződött be.";
        stages.push({ stage: name, status: "FAIL", message });
      }
    }
    const credential = fixture.credentials[index];
    try {
      await page.goto(origin + "/login");
      await page.getByLabel("Email", { exact: true }).fill(credential.email);
      await page.getByLabel("Jelszó", { exact: true }).fill(credential.password);
      await page.getByRole("button", { name: "Bejelentkezés", exact: true }).click();
      await expect(page).toHaveURL(/\/app\/?$/);
      await page.waitForLoadState("networkidle");
      await expect(page.locator("html")).toHaveAttribute("data-app-ready", "true");
      await operation("poszt", async () => {
        await page.getByLabel("Az ötleted vagy ajánlatod", { exact: true }).fill(brand.idea);
        await page.getByRole("button", { name: "Poszt készítése", exact: true }).click();
        await completed(page, expect(page).toHaveURL(/\/app\/posts\/post_/, { timeout: 180000 }));
      });
      await page.waitForLoadState("networkidle");
      await page.goto(origin + "/app/weekly");
      await expect(page.locator("html")).toHaveAttribute("data-app-ready", "true");
      await page.waitForLoadState("networkidle");
      await operation("heti terv", async () => {
        await page
          .getByLabel(/Van valami különleges/)
          .fill(
            "A megadott termékek és szolgáltatások bemutatása. Ne találj ki árat vagy kedvezményt.",
          );
        await page.getByRole("button", { name: "Készíts tervet a hétre", exact: true }).click();
        await completed(
          page,
          expect(
            page.getByRole("button", { name: "Megnyitás és szerkesztés", exact: true }),
          ).toHaveCount(4, { timeout: 480000 }),
        );
      });
    } catch {
      failure = true;
      failureMessage =
        (
          await page
            .getByRole("alert")
            .first()
            .textContent()
            .catch(() => "")
        )?.slice(0, 1500) || "A böngészős lépés nem fejeződött be.";
      await page
        .screenshot({ path: path.join(directory, `failure-${brand.type}.png`), fullPage: true })
        .catch(() => undefined);
      // Only fictional UI output is retained; no exception text, credentials, headers or traces.
    }
    const data = await db();
    const posts = data.posts.filter((p: { brandId: string }) => p.brandId === credential.brandId);
    const items = data.planItems.filter(
      (p: { brandId: string }) => p.brandId === credential.brandId,
    );
    const requests = (
      await readFile(path.join(directory, "request-contexts.jsonl"), "utf8").catch(() => "")
    )
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line: string) => JSON.parse(line))
      .filter((r) => r.businessContext.brandId === credential.brandId);
    const calls = JSON.parse(
      await readFile(path.join(directory, "ai-calls.json"), "utf8").catch(() => "[]"),
    )
      .filter((c: { brandId: string }) => c.brandId === credential.brandId)
      .map(
        (c: {
          endpoint: string;
          status: string;
          httpStatus: number;
          errorCode: string;
          model: string;
        }) => ({
          endpoint: c.endpoint,
          status: c.status,
          httpStatus: c.httpStatus,
          errorCode: c.errorCode,
          model: c.model,
        }),
      );
    const sample = {
      fictional: true,
      provider: live ? `${provider}-live` : `explicit-mock-${provider}`,
      status: failure ? "FAIL" : "PASS",
      businessType: brand.type,
      brandName: brand.name,
      stages,
      ...(failure ? { failedStage: stage, failureMessage } : {}),
      requests,
      posts: posts.map((p: { id: string; title: string; status: string }) => ({
        title: p.title,
        status: p.status,
        variants: data.postVariants
          .filter((v: { postId: string }) => v.postId === p.id)
          .map((v: { content: string; hashtags: string[]; platform: string }) => ({
            platform: v.platform,
            content: v.content,
            hashtags: v.hashtags,
          })),
      })),
      weeklyPlan: items.map(
        (i: {
          date: string;
          time: string;
          topic: string;
          platform: string;
          draftContent: string;
          verificationWarnings: string[];
        }) => ({
          date: i.date,
          time: i.time,
          topic: i.topic,
          platform: i.platform,
          content: i.draftContent,
          review: i.verificationWarnings,
        }),
      ),
      calls,
    };
    await writeFile(
    path.join(samples, `${brand.type}.json`),
      JSON.stringify(sample, null, 2) + "\n",
    );
    results.push({ brand: brand.name, status: sample.status });
    console.log(
      `${brand.name}: ${sample.status}${calls.some((c: { httpStatus: number }) => c.httpStatus === 402) ? " – külső AI keret nem elegendő" : ""}`,
    );
    await context.close();
    // A credit/network block is still tested on each brand; never substitute mock after a live failure.
  }
  await writeFile(
    path.join(samples, "summary.json"),
    JSON.stringify(
      {
        provider: live ? `${provider}-live` : `explicit-mock-${provider}`,
        results,
        rejectionReasonCounts: Object.fromEntries(
          Object.entries(
            JSON.parse(
              await readFile(path.join(directory, "ai-calls.json"), "utf8").catch(() => "[]"),
            )
              .filter((call: { status?: string; errorCode?: string | null }) =>
                call.status === "error" && !!call.errorCode,
              )
              .reduce((counts: Record<string, number>, call: { errorCode: string }) => {
                counts[call.errorCode] = (counts[call.errorCode] ?? 0) + 1;
                return counts;
              }, {}),
          ).sort(([left], [right]) => left.localeCompare(right)),
        ),
        createdAt: new Date().toISOString(),
      },
      null,
      2,
    ) + "\n",
  );
  if (results.some((r) => r.status !== "PASS")) process.exitCode = 1;
} finally {
  await browser?.close().catch(() => undefined);
  child.kill();
  await log.close();
}

