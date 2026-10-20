/** Explicit opt-in to an isolated PostgreSQL branch; never prints credentials. */
import { randomUUID } from "node:crypto";
import {
  readPostgresData,
  postgresTransact,
  closePostgresPool,
} from "../src/lib/server/postgres-store.server";
import { hashPassword } from "../src/lib/server/password.server";
const email = process.env.E2E_EMAIL,
  password = process.env.E2E_PASSWORD;
if (
  process.env.E2E_PREVIEW_ACK !== "isolated-preview" ||
  !email?.endsWith("@example.invalid") ||
  !password ||
  password.length < 12 ||
  !(process.env.DATABASE_URL || process.env.DIRECT_URL)
)
  throw new Error(
    "Elkülönített próbaág, E2E_PREVIEW_ACK és tesztfiók környezeti beállítások szükségesek.",
  );
if (process.env.VERCEL_ENV === "production")
  throw new Error("Productionben tesztfiók nem készíthető.");
try {
  const prior = await readPostgresData();
  if (prior.users.some((u) => !u.email.endsWith("@example.invalid")))
    throw new Error("Ez az adatbázis nem kizárólag tesztfiókokat tartalmaz. Nem írtunk bele.");
  const existing = prior.users.find((u) => u.email === email);
  if (existing)
    throw new Error("Ez a tesztfiók már létezik. Nem módosítottuk a jelszavát vagy adatait.");
  await postgresTransact((db) => {
    if (db.users.some((u) => !u.email.endsWith("@example.invalid")))
      throw new Error("Valódi fiókot tartalmazó adatbázisba nem készül tesztfiók.");
    if (db.users.some((u) => u.email === email)) throw new Error("A tesztfiók közben létrejött.");
    const id = (prefix: string) => `${prefix}_${randomUUID()}`,
      at = new Date().toISOString();
    const userId = id("user"),
      workspaceId = id("workspace"),
      brandId = id("brand");
    db.users.push({
      id: userId,
      email,
      displayName: "TESZT Előnézet",
      passwordHash: hashPassword(password),
      createdAt: at,
      uiMode: "simple",
      uiModeSuggestionDismissed: true,
      auth: { emailVerifiedAt: at, sessionVersion: 0 },
    });
    db.workspaces.push({ id: workspaceId, name: "TESZT Előnézet", createdAt: at, updatedAt: at });
    db.memberships.push({
      id: id("membership"),
      workspaceId,
      userId,
      role: "owner",
      createdAt: at,
    });
    db.brands.push({
      id: brandId,
      workspaceId,
      name: "TESZT Műhely Pékség",
      website: "",
      cityRegion: "Csíkszereda",
      languageMarket: "magyar",
      industry: "pékség",
      products: "Kenyér, kakaós csiga",
      services: "",
      offers: "",
      audience: "helyiek",
      createdAt: at,
      updatedAt: at,
    });
    db.brandProfiles.push({
      id: id("voice"),
      brandId,
      businessType: "bakery_cafe",
      mainChannel: "facebook",
      tone: "Barátságos",
      ctaStyle: "Írj nekünk!",
      values: "",
      preferredPhrases: "",
      avoidedPhrases: "",
      description: "",
      approvedExamples: "",
      aiGuardrails: "Csak a megadott tényeket használd. Megszólítás: tegezés, egyes szám (te).",
      logoUrl: "",
      colors: [],
      fontFamily: "Plus Jakarta Sans",
      createdAt: at,
      updatedAt: at,
    });
  });
  console.log(
    "Elkülönített, ellenőrzött TESZT fiók létrehozva. Meglévő rekordot nem módosítottunk.",
  );
} catch {
  // Connection/parser errors may contain connection details; never print their payload.
  console.error(
    "A tesztfiók előkészítése nem sikerült. Ellenőrizd az elkülönített adatbázist és a tesztfiók beállításait; meglévő fiókot nem írunk felül.",
  );
  process.exitCode = 1;
} finally {
  await closePostgresPool();
}
