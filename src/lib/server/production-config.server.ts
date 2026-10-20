import { brandForLocale, DEFAULT_MARKET_LOCALE } from "@/config/brand";

type Environment = Record<string, string | undefined>;

export function isProductionEnvironment(env: Environment = process.env) {
  return env.NODE_ENV === "production" || env.VERCEL_ENV === "production";
}

// Values never appear in validation errors, even for malformed connection strings.
export function assertProductionConfiguration(env: Environment = process.env) {
  if (!isProductionEnvironment(env)) return;
  const problems: string[] = [];
  if (!["off", "private"].includes(env.BETA_MODE?.trim() || "off"))
    problems.push("BETA_MODE: off vagy private érték szükséges");
  for (const key of [
    "ENABLE_LOCAL_ADMIN_LOGIN",
    "MARKETINGPILOT_PREVIEW_TEST_AI",
    "MARKETINGPILOT_JSON_FIXTURE",
  ]) {
    // Fail closed for ambiguous flags too; only absent/empty/false/0 are disabled.
    if (!/^(?:false|0)?$/i.test(env[key]?.trim() || ""))
      problems.push(`${key}: tiltott tesztbeállítás`);
  }
  if ((env.SESSION_SECRET?.trim().length || 0) < 32)
    problems.push("SESSION_SECRET: legalább 32 karakter szükséges");
  if (!env.DATABASE_URL?.trim()) problems.push("DATABASE_URL: tartós adatbázis szükséges");
  let publicOriginValid = false;
  try {
    const url = new URL(env.PUBLIC_APP_URL || "");
    const host = url.hostname.toLowerCase().replace(/\.$/, "");
    publicOriginValid =
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      url.pathname === "/" &&
      host !== "localhost" &&
      !host.endsWith(".localhost") &&
      !/^127\./.test(host) &&
      host !== "[::1]" &&
      host !== "[::]" &&
      !/^\[::ffff:7f[0-9a-f]{2}:/.test(host) &&
      host !== "0.0.0.0";
  } catch {
    /* Report the variable name, never its value. */
  }
  if (!publicOriginValid) problems.push("PUBLIC_APP_URL: nyilvános HTTPS-cím szükséges");
  if (problems.length)
    throw new Error(`${brandForLocale(DEFAULT_MARKET_LOCALE).productName} nem indulhat el éles környezetben. ${problems.join("; ")}.`);
}
