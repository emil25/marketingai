import { createHash } from "node:crypto";

// Identify a Neon endpoint/database without credentials. Pooler and direct URLs
// must identify the same endpoint. Other providers require explicit migration.
export function neonTargetFingerprint(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/-pooler(?=\.)/, "");
    if (
      !/^(postgres|postgresql):$/.test(url.protocol) ||
      !/^ep-[a-z0-9-]+\.[a-z0-9.-]+\.neon\.tech$/.test(host) ||
      !url.pathname ||
      url.pathname === "/" ||
      (url.port && url.port !== "5432")
    )
      throw new Error();
    return createHash("sha256").update(`${host}${url.pathname}`).digest("hex");
  } catch {
    throw new Error("A build-migráció célja nem igazolható; futtasd a migrációt külön lépésként.");
  }
}

export function allowBuildMigration(env) {
  if (!env.MIGRATE_ON_BUILD?.trim()) return false;
  if (!env.VERCEL || env.MIGRATE_ON_BUILD !== "preview-isolated" || env.VERCEL_ENV !== "preview")
    throw new Error("Build alatti migráció csak elkülönített Preview környezetben engedélyezett.");
  const preview = env.PREVIEW_DATABASE_TARGET_SHA256;
  const production = env.PRODUCTION_DATABASE_TARGET_SHA256;
  if (
    !/^[a-f0-9]{64}$/.test(preview || "") ||
    !/^[a-f0-9]{64}$/.test(production || "") ||
    preview === production ||
    !env.DATABASE_URL?.trim()
  )
    throw new Error("Az elkülönített próbaadatbázis és a production cél ellenőrzése hiányzik.");
  for (const value of [env.DATABASE_URL, env.DIRECT_URL, env.DATABASE_URL_UNPOOLED].filter((v) =>
    v?.trim(),
  )) {
    const actual = neonTargetFingerprint(value);
    if (actual !== preview || actual === production)
      throw new Error("A build-migráció célja nem az engedélyezett próbaadatbázis.");
  }
  return true;
}
