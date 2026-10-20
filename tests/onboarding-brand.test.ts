import assert from "node:assert/strict";
import { test } from "node:test";
import {
  defaultAddressing,
  brandVoiceGuardrails,
  brandStyleSample,
  sanitizeOnboardingDraft,
} from "../src/lib/onboarding-brand";
import { contentRuleViolations } from "../src/lib/content-quality";
import { buildBusinessContext, normalizeBusinessType } from "../src/lib/business-types";
import type { BrandRecord, BrandProfileRecord } from "../src/lib/data-model";
import { approvedClaimSuggestions, cleanApprovedClaims } from "../src/lib/approved-claims";

test("bakery and shop categories survive normalization and enter the existing business context", () => {
  for (const businessType of ["bakery_cafe", "retail"]) {
    assert.equal(normalizeBusinessType(businessType), businessType);
    const context = buildBusinessContext(
      { name: "TESZT", industry: "Kerékpárkölcsönzés" } as BrandRecord,
      { businessType, aiGuardrails: brandVoiceGuardrails("ti") } as BrandProfileRecord,
    );
    assert.equal(context.businessType, businessType);
    assert.equal(context.industry, "Kerékpárkölcsönzés");
    assert.match(context.guardrails, /többes szám második személy/);
  }
});
test("type-specific owner-confirmed claims are stored in brand context and draft recovery", () => {
  assert.ok(approvedClaimSuggestions("bakery_cafe").includes("Frissen sütünk"));
  for (const type of [
    "beauty_salon",
    "dental_practice",
    "lawyer",
    "fogorvos",
    "orvos",
    "ügyvéd",
    "szépészeti kezelés",
  ])
    assert.deepEqual(
      approvedClaimSuggestions(type),
      [],
      `${type} must not offer promise-like claims`,
    );
  for (const type of [
    "bakery_cafe",
    "retail",
    "restaurant",
    "accommodation",
    "hair_salon",
    "auto_service",
    "electrician",
    "accountant",
    "ecommerce",
    "real_estate",
    "fitness",
    "car_dealer",
    "local_business",
    "other",
  ])
    assert.ok(approvedClaimSuggestions(type).length <= 5, `${type} must offer at most five claims`);
  assert.deepEqual(cleanApprovedClaims(undefined), [], "no claims are preselected by default");
  const claims = cleanApprovedClaims(["Frissen sütünk", "  Helyi alapanyagokat használunk  ", "x"]);
  assert.deepEqual(claims, ["Frissen sütünk", "Helyi alapanyagokat használunk"]);
  const brand = { id: "brand-claims", name: "Teszt", products: "kenyér" } as BrandRecord;
  const profile = { approvedClaims: claims } as BrandProfileRecord;
  assert.deepEqual(buildBusinessContext(brand, profile).approvedClaims, claims);
  const draft = sanitizeOnboardingDraft({
    version: 1,
    savedAt: Date.now(),
    step: 1,
    approvedClaims: claims,
    details: { name: "Pékség" },
  });
  assert.deepEqual(draft?.approvedClaims, claims);
  const longDraft = sanitizeOnboardingDraft({
    version: 1,
    savedAt: Date.now(),
    approvedClaims: ["TÚL HOSSZÚ".repeat(40), "ok"],
    details: {},
  })?.approvedClaims;
  assert.deepEqual(
    longDraft?.map((claim) => claim.length),
    [200, 2],
  );
});
test("addressing defaults fit the business type and all three forms have explicit AI instructions", () => {
  assert.equal(defaultAddressing("lawyer"), "Ön");
  assert.equal(defaultAddressing("accountant"), "Ön");
  for (const type of ["bakery_cafe", "retail", "other", "hair_salon"])
    assert.equal(defaultAddressing(type), "te");
  assert.match(brandVoiceGuardrails("te"), /egyes szám második személy/);
  assert.match(brandVoiceGuardrails("Ön", "Prémium"), /magázás.*Prémium/);
  assert.match(brandVoiceGuardrails("ti"), /többes szám második személy/);
});
test("live style sample changes addressing and tone without inventing business facts", () => {
  const singular = brandStyleSample("TESZT Pékség", "Barátságos", "te");
  const formal = brandStyleSample("TESZT Pékség", "Professzionális", "Ön");
  const plural = brandStyleSample("TESZT Pékség", "Játékos", "ti");
  assert.match(singular, /TESZT Pékség.*\n.*itt vagy/s);
  assert.match(formal, /tájékozódhat.*Írjon|tájékozódhat.*írjon/s);
  assert.match(plural, /írjatok/);
  assert.notEqual(singular, formal);
  assert.notEqual(plural, singular);
  assert.doesNotMatch(singular + formal + plural, /díjnyertes|kedvezmény|reggel nyit/);
});
test("style samples use the business type and professional energy never adds emoji", () => {
  const bakery = brandStyleSample(
    "TESZT Pékség",
    "Professzionális",
    "ti",
    "Lendületes",
    "bakery_cafe",
  );
  const hotel = brandStyleSample(
    "TESZT Panzió",
    "Professzionális",
    "Ön",
    "Lendületes",
    "accommodation",
  );
  assert.match(bakery, /kínálatról van kérdésetek/);
  assert.match(hotel, /szállásról van kérdése/);
  assert.doesNotMatch(bakery + hotel, /\p{Extended_Pictographic}/u);
  assert.match(brandStyleSample("TESZT", "Barátságos", "te", "Lendületes", "restaurant"), /✨/);
});

test("valid plural and formal calls to action are accepted; two plural CTAs are rejected", () => {
  assert.deepEqual(
    contentRuleViolations("Kenyér elvitelre. Írjatok nekünk!", "facebook", "kenyér"),
    [],
  );
  assert.deepEqual(
    contentRuleViolations("Kenyér elvitelre. Kérjen tájékoztatást!", "facebook", "kenyér"),
    [],
  );
  assert.ok(
    contentRuleViolations("Gyertek hozzánk! Írjatok nekünk!", "facebook", "kenyér").some(
      (message) => message.includes("Több CTA"),
    ),
  );
});
test("temporary draft allowlist preserves business text but never account credentials, files or arbitrary keys", () => {
  const draft = sanitizeOnboardingDraft({
    version: 1,
    savedAt: Date.now(),
    step: 2,
    businessType: "bakery_cafe",
    password: "DO-NOT-KEEP",
    token: "DO-NOT-KEEP",
    logoFile: "DO-NOT-KEEP",
    details: {
      name: "TESZT",
      products: "kenyér",
      industry: "Pékség",
      addressing: "ti",
      password: "DO-NOT-KEEP",
      email: "DO-NOT-KEEP",
    },
  });
  assert.equal(draft?.step, 2);
  assert.equal(draft?.details.products, "kenyér");
  assert.equal(draft?.details.addressing, "ti");
  assert.doesNotMatch(JSON.stringify(draft), /DO-NOT-KEEP/);
  assert.equal(
    sanitizeOnboardingDraft({ version: 1, savedAt: Date.now() - 25 * 60 * 60 * 1000 }),
    null,
  );
  assert.equal(sanitizeOnboardingDraft({ version: 1, savedAt: Date.now() + 120000 }), null);
  assert.equal(sanitizeOnboardingDraft({ version: 77, savedAt: Date.now() }), null);
});
