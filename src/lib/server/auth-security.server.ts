import { createHash, createHmac, randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getRequestHeader } from "@tanstack/react-start/server";
import { assertJsonFixtureAllowed } from "./storage-mode.server";
import { replaceAtomicFile } from "./atomic-file.server";
import { betaConfiguration, developmentEmailAllowed } from "./beta-access.server";
import { isProductionEnvironment } from "./production-config.server";
import { brandForLocale, DEFAULT_MARKET_LOCALE } from "@/config/brand";
import { translate } from "@/i18n";

export function newAuthToken(minutes: number) {
  const token = randomBytes(32).toString("hex");
  return {
    token,
    stored: {
      hash: tokenHash(token),
      expiresAt: new Date(Date.now() + minutes * 60000).toISOString(),
    },
  };
}
export const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");
export function matchesAuthToken(
  stored: { hash: string; expiresAt: string } | undefined,
  token: string,
) {
  return (
    !!stored &&
    /^[a-f0-9]{64}$/.test(token) &&
    stored.hash === tokenHash(token) &&
    Date.parse(stored.expiresAt) > Date.now()
  );
}
export function authConfiguration(env: Record<string, string | undefined> = process.env) {
  const production = isProductionEnvironment(env);
  const beta = betaConfiguration(env);
  const operatorReady = ["OPERATOR_NAME", "OPERATOR_EMAIL", "OPERATOR_ADDRESS"].every((key) =>
    env[key]?.trim(),
  );
  const emailReady = !!env.RESEND_API_KEY?.trim() && !!env.EMAIL_FROM?.trim();
  const botReady = !!env.TURNSTILE_SECRET_KEY?.trim() && !!env.TURNSTILE_SITE_KEY?.trim();
  let originReady = false;
  try {
    const url = new URL(env.PUBLIC_APP_URL || "");
    originReady = url.protocol === "https:" && !url.username && !url.password;
  } catch {
    /* fail closed */
  }
  return {
    registrationEnabled:
      beta.validMode &&
      (beta.privateBeta
        ? beta.inviteReady
        : !production || (!!operatorReady && emailReady && botReady && originReady)),
    privateBeta: beta.privateBeta,
    registrationMessage: beta.privateBeta
      ? "Zárt béta: a regisztráció jelenleg nem elérhető."
      : "A regisztráció előkészítés alatt áll. Kérjük, nézz vissza később.",
    emailReady,
    passwordResetAvailable: emailReady || developmentEmailAllowed(env),
    developmentEmail: !emailReady && developmentEmailAllowed(env),
    turnstileSiteKey: env.TURNSTILE_SITE_KEY?.trim() || "",
  };
}
export async function verifyBot(token: string, action: string) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (
    !secret &&
    !process.env.TURNSTILE_SITE_KEY &&
    (!isProductionEnvironment() ||
      (betaConfiguration().privateBeta && betaConfiguration().inviteReady))
  )
    return;
  if (!secret || !token) throw new Error("Kérjük, végezd el a biztonsági ellenőrzést.");
  let result: { success?: boolean; action?: string; hostname?: string };
  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: new URLSearchParams({ secret, response: token }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error("provider");
    result = await response.json();
  } catch {
    throw new Error("A biztonsági ellenőrzés most nem érhető el. Próbáld újra.");
  }
  const expectedHost = process.env.PUBLIC_APP_URL
    ? new URL(process.env.PUBLIC_APP_URL).hostname
    : undefined;
  if (
    !result.success ||
    result.action !== action ||
    (expectedHost && result.hostname !== expectedHost)
  ) {
    throw new Error("A biztonsági ellenőrzés lejárt. Próbáld újra.");
  }
}

type Bucket = { windowStart: number; attempts: number };
let queue: Promise<unknown> = Promise.resolve();
export async function consumeAuthLimit(key: string, limit: number, minutes: number) {
  const hashed = createHmac("sha256", process.env.SESSION_SECRET || "development-rate-limit")
    .update(key)
    .digest("hex");
  const cutoff = Date.now() - minutes * 60000;
  let count: number;
  if (process.env.DATABASE_URL?.trim() || process.env.DIRECT_URL?.trim()) {
    const { getPool } = await import("./postgres-store.server");
    const result = await getPool().query(
      `INSERT INTO auth_rate_limits(key_hash,window_start,attempts) VALUES($1,now(),1)
       ON CONFLICT(key_hash) DO UPDATE SET attempts=CASE WHEN auth_rate_limits.window_start < $2 THEN 1 ELSE auth_rate_limits.attempts+1 END,
       window_start=CASE WHEN auth_rate_limits.window_start < $2 THEN now() ELSE auth_rate_limits.window_start END RETURNING attempts`,
      [hashed, new Date(cutoff).toISOString()],
    );
    count = result.rows[0].attempts;
  } else {
    assertJsonFixtureAllowed();
    const file = path.join(
      process.env.MARKETINGPILOT_DATA_DIR || path.join(process.cwd(), "data"),
      "auth-limits.json",
    );
    const run = queue.then(async () => {
      let buckets: Record<string, Bucket> = {};
      try {
        buckets = JSON.parse(await readFile(file, "utf8"));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
      for (const [id, bucket] of Object.entries(buckets))
        if (bucket.windowStart < Date.now() - 86400000) delete buckets[id];
      const previous = buckets[hashed];
      const bucket =
        previous && previous.windowStart >= cutoff
          ? { ...previous, attempts: previous.attempts + 1 }
          : { windowStart: Date.now(), attempts: 1 };
      buckets[hashed] = bucket;
      await mkdir(path.dirname(file), { recursive: true });
      const temp = `${file}.${randomBytes(8).toString("hex")}.tmp`;
      await writeFile(temp, JSON.stringify(buckets));
      await replaceAtomicFile(temp, file);
      return bucket.attempts;
    });
    queue = run.catch(() => undefined);
    count = await run;
  }
  if (count > limit)
    throw new Error("Túl sok próbálkozás. Kérjük, várj néhány percet, majd próbáld újra.");
}
export async function protectAuth(action: string, email: string, token: string, limit = 8) {
  // Only platform-provided client IP headers are trusted in production.
  const ip = process.env.VERCEL
    ? getRequestHeader("x-vercel-forwarded-for")?.split(",")[0]
    : process.env.CF_PAGES
      ? getRequestHeader("cf-connecting-ip")
      : undefined;
  await consumeAuthLimit(`${action}:email:${email.toLowerCase()}`, limit, 15);
  if (ip) await consumeAuthLimit(`${action}:ip:${ip}`, 40, 15);
  await verifyBot(token, action);
}

export async function sendAuthEmail(email: string, kind: "verify" | "reset", token: string) {
  if (!authConfiguration().emailReady && !developmentEmailAllowed())
    throw new Error(
      "Az e-mail-küldés még nincs bekapcsolva. A fiókod megmaradt, a levelet később újraküldheted.",
    );
  const origin = new URL(process.env.PUBLIC_APP_URL || "http://127.0.0.1:8080");
  if (isProductionEnvironment() && origin.protocol !== "https:")
    throw new Error("Az e-mail-küldés átmenetileg nem érhető el.");
  const url = new URL(kind === "verify" ? "/verify-email" : "/reset-password", origin);
  // Fragment is consumed by the page, never sent in access logs or referrer headers.
  url.hash = token;
  const brand = brandForLocale(DEFAULT_MARKET_LOCALE);
  const subject = translate(kind === "verify" ? "email.verifySubject" : "email.resetSubject")
    .replaceAll("{brand}", brand.productName);
  const text = `${subject}\n\n${url.href}\n\nHa nem te kérted, hagyd figyelmen kívül ezt a levelet.`;
  if (!authConfiguration().emailReady) {
    const { writeDevelopmentEmail } = await import("./development-outbox.server");
    await writeDevelopmentEmail({ to: email, subject, text });
    return;
  }
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      signal: AbortSignal.timeout(12000),
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: [email],
        subject,
        text,
      }),
    });
    if (!response.ok) {
      console.error(
        JSON.stringify({ event: "auth_email_failed", provider: "resend", status: response.status }),
      );
      throw new Error("provider");
    }
  } catch {
    throw new Error("A levelet most nem sikerült elküldeni. Próbáld újra néhány perc múlva.");
  }
}
