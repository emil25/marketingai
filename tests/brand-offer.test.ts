import assert from "node:assert/strict";
import { test } from "node:test";
import { applyBrandOfferAnswer } from "../src/lib/brand-offer";
import type { BrandProfileRecord, BrandRecord } from "../src/lib/data-model";

function records(type = "other") {
  const brand = {
    id: "brand_owned",
    workspaceId: "workspace_owned",
    name: "Példa műhely",
    website: "",
    cityRegion: "",
    languageMarket: "magyar",
    industry: "",
    products: "",
    services: "",
    offers: "",
    audience: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  } as BrandRecord;
  const profile = {
    id: "profile_owned",
    brandId: brand.id,
    businessType: type,
    tone: "Barátságos",
    ctaStyle: "Írj nekünk",
    values: "",
    preferredPhrases: "",
    avoidedPhrases: "",
    description: "Helyi vállalkozás",
    approvedExamples: "",
    aiGuardrails: "",
    logoUrl: "",
    colors: [],
    fontFamily: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  } as BrandProfileRecord;
  return { brand, profile };
}

test("saves offer answer into the owned Other brand and profile context", () => {
  const { brand, profile } = records();
  applyBrandOfferAnswer(brand, profile, "Kerékpárszerviz és túravezetés", "2026-10-16T10:00:00.000Z");
  assert.equal(brand.industry, "Kerékpárszerviz és túravezetés");
  assert.equal(brand.services, "Kerékpárszerviz és túravezetés");
  assert.match(profile.description, /Fő kínálat: Kerékpárszerviz és túravezetés/);
  assert.equal(profile.updatedAt, "2026-10-16T10:00:00.000Z");
});

test("fills missing Other activity without overwriting existing services", () => {
  const { brand, profile } = records();
  brand.services = "Javítás";
  applyBrandOfferAnswer(brand, profile, "Kerékpárszerviz és túravezetés", "2026-10-16T10:00:00.000Z");
  assert.equal(brand.services, "Javítás");
  assert.equal(brand.industry, "Kerékpárszerviz és túravezetés");
});

test("prevents replacing an offer that another update has already filled", () => {
  const { brand, profile } = records("bakery_cafe");
  brand.products = "Kovászos kenyér";
  assert.throws(
    () => applyBrandOfferAnswer(brand, profile, "Másik kínálat", "2026-10-16T10:00:00.000Z"),
    /már meg lettek adva/i,
  );
  assert.equal(brand.products, "Kovászos kenyér");
});
