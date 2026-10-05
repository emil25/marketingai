import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BUSINESS_TYPES,
  normalizeBusinessType,
  businessTypeQuickStarts,
  buildBusinessContext,
} from "../src/lib/business-types";
import type { BrandRecord, BrandProfileRecord } from "../src/lib/data-model";

test("all business types have a unique ID and six working creator topics", () => {
  assert.equal(new Set(BUSINESS_TYPES.map((type) => type.value)).size, BUSINESS_TYPES.length);
  for (const type of BUSINESS_TYPES) {
    assert.equal(normalizeBusinessType(type.value), type.value);
    assert.equal(type.quickStarts.length, 6);
    assert.equal(new Set(type.quickStarts).size, 6);
  }
});
test("new business directions retain actual brand and voice context", () => {
  const brand = {
    name: "TESZT",
    services: "Saját szolgáltatás",
    products: "",
    offers: "",
    website: "",
    cityRegion: "Csíkszereda",
    industry: "",
    languageMarket: "magyar",
    audience: "Helyi ügyfelek",
  } as BrandRecord;
  for (const businessType of ["dental_practice", "real_estate", "fitness", "car_dealer"]) {
    const profile = {
      businessType,
      tone: "Barátságos",
      ctaStyle: "Időpontfoglalás",
      preferredPhrases: "",
      avoidedPhrases: "",
      learnedSummary: "Saját márkahang",
    } as BrandProfileRecord;
    const context = buildBusinessContext(brand, profile, {
      platform: "instagram",
      goal: "érdeklődők",
    });
    assert.equal(context.businessType, businessType);
    assert.equal(context.brandName, brand.name);
    assert.equal(context.services, brand.services);
    assert.equal(context.learnedBrandVoice, profile.learnedSummary);
    assert.equal(context.language, "magyar");
    assert.equal(context.platform, "instagram");
    assert.equal(context.goal, "érdeklődők");
  }
  assert.notDeepEqual(
    businessTypeQuickStarts("dental_practice"),
    businessTypeQuickStarts("car_dealer"),
  );
});
test("missing business type and legacy users keep a safe general fallback", () => {
  assert.equal(normalizeBusinessType(null), "other");
  assert.equal(normalizeBusinessType(undefined), "other");
  assert.equal(normalizeBusinessType("ÉtTeReM"), "restaurant");
  assert.equal(normalizeBusinessType("unknown"), "other");
  assert.equal(businessTypeQuickStarts(null).length, 6);
});
