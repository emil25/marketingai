import assert from "node:assert/strict";
import { test } from "node:test";
import type { BrandProfileRecord, BrandRecord } from "../src/lib/data-model";
import { buildBusinessContext } from "../src/lib/business-types";
import { brandForLocale, DEFAULT_MARKET_LOCALE } from "../src/config/brand";
import { localeForLanguage, translate, UI_RESOURCES } from "../src/i18n";
import { HU_RO_PROMPTS, imagePromptRules, marketWritingRules } from "../src/i18n/prompts/hu-RO";
import {
  displayCityName,
  formatRomanianAddress,
  formatRomanianPhone,
  formatRonAmount,
  localMarketEvents,
  normalizeRomanianPhone,
} from "../src/lib/market/ro";
import { buildMarketImagePrompt } from "../src/lib/market/image-prompt";

test("prices use Romanian lei formatting and never convert to forints", () => {
  assert.equal(formatRonAmount(15), "15 lei");
  assert.equal(formatRonAmount("15,5", "RON"), "15,5 RON");
  assert.doesNotMatch(formatRonAmount(1200), /Ft|HUF/iu);
  assert.throws(() => formatRonAmount(-1));
});

test("Romanian telephone numbers accept national and international +40 forms", () => {
  assert.equal(normalizeRomanianPhone("0266 364 845"), "+40266364845");
  assert.equal(normalizeRomanianPhone("0040 744 123 456"), "+40744123456");
  assert.equal(formatRomanianPhone("+40 744 123 456"), "+40 744 123 456");
});

test("city and Romanian address display follow the selected name preference", () => {
  assert.equal(displayCityName("Csíkszereda", "hu"), "Csíkszereda");
  assert.equal(displayCityName("Csíkszereda", "ro"), "Miercurea Ciuc");
  assert.equal(displayCityName("Csíkszereda", "both"), "Csíkszereda / Miercurea Ciuc");
  assert.equal(
    formatRomanianAddress(
      { street: "Petőfi utca", houseNumber: "2", city: "Csíkszereda", county: "Hargita" },
      "both",
    ),
    "Csíkszereda / Miercurea Ciuc, Petőfi utca, 2, Hargita",
  );
});

test("business context carries local words, city preference, currency and supplied facts", () => {
  const brand = {
    id: "brand-test",
    name: "Műhely Pékség",
    industry: "Pékség",
    website: "",
    cityRegion: "Csíkszereda",
    languageMarket: "magyar",
    products: "kovászos kenyér",
    services: "előrendelés",
    offers: "",
    audience: "helyi családok",
  } as BrandRecord;
  const profile = {
    businessType: "bakery_cafe",
    cityNameMode: "both",
    localPhrases: "nálunk, a piacon",
    localEvents: "2026-10-20 – Szüreti vásár",
    phone: "+40744123456",
    address: "Petőfi utca",
    houseNumber: "2",
    county: "Hargita",
    aiGuardrails: "Csak megadott tényeket használj.",
  } as BrandProfileRecord;
  const context = buildBusinessContext(brand, profile);
  assert.equal(context.currency, "RON");
  assert.equal(context.region, "Csíkszereda / Miercurea Ciuc");
  assert.equal(context.address, "Csíkszereda / Miercurea Ciuc, Petőfi utca, 2, Hargita");
  assert.equal(context.localPhrases, "nálunk, a piacon");
  assert.equal(context.localEvents, "2026-10-20 – Szüreti vásár");
  assert.equal(context.products, "kovászos kenyér");
});

test("holiday data distinguishes Western and Orthodox Easter and filters exact dates", () => {
  const events = localMarketEvents("2026-04-01", "2026-04-20");
  assert.ok(events.some((item) => item.date === "2026-04-05" && item.name.includes("Nyugati húsvét")));
  assert.ok(events.some((item) => item.date === "2026-04-12" && item.name === "Ortodox húsvét"));
  assert.ok(localMarketEvents("2026-08-20", "2026-08-20").some((item) => item.name === "Szent István napja"));
  assert.ok(localMarketEvents("2026-12-01", "2026-12-01").some((item) => item.name === "Románia nemzeti ünnepe"));
  assert.ok(
    localMarketEvents(
      "2026-10-01",
      "2026-10-31",
      "2026-10-20 – Helyi vásár\n2026-10-45 – Hibás dátum\nSzöveg dátum nélkül",
    ).some((item) => item.date === "2026-10-20" && item.source === "local"),
  );
  assert.equal(localMarketEvents("2026-10-31", "2026-10-01").length, 0);
});

test("hu-RO is the UI default, brand text comes from configuration and Romanian is an empty future pack", () => {
  const brand = brandForLocale(DEFAULT_MARKET_LOCALE);
  assert.equal(translate("brand.name"), brand.productName);
  assert.equal(translate("brand.slogan"), brand.shortSlogan);
  assert.equal(translate("landing.badge"), "Erdélyi kisvállalkozóknak, akiknek nincs marketingesük");
  assert.ok("hu-RO" in UI_RESOURCES);
  assert.equal(localeForLanguage("magyar"), "hu-RO");
  assert.equal(localeForLanguage("română"), "ro-RO");
  assert.equal(translate("landing.badge", "ro-RO"), translate("landing.badge", "hu-RO"));
});

test("Hungarian prompt rules use Transylvanian language, RON and only provided event dates", () => {
  assert.match(marketWritingRules("magyar"), /erdélyi környezetben/iu);
  assert.match(marketWritingRules("magyar"), /lej vagy RON/iu);
  assert.match(HU_RO_PROMPTS.weekPlan, /dátumú magyar\/román ünnepeket/iu);
  assert.match(imagePromptRules("magyar"), /ne jeleníts meg kitalált feliratot/iu);
});

test("image prompts include relevant local business context without private contact details", () => {
  const brand = {
    id: "brand-image-test",
    name: "Műhely Pékség",
    industry: "Pékség",
    website: "",
    cityRegion: "Csíkszereda",
    languageMarket: "magyar",
    products: "kovászos kenyér",
    services: "előrendelés",
    offers: "",
    audience: "helyiek",
  } as BrandRecord;
  const profile = {
    businessType: "bakery_cafe",
    cityNameMode: "hu",
    localPhrases: "nálunk",
    phone: "+40744123456",
    colors: ["#102f25"],
    aiGuardrails: "",
  } as BrandProfileRecord;
  const prompt = buildMarketImagePrompt("kenyér bemutató", brand, profile, "1:1");
  assert.match(prompt, /Pékség/);
  assert.match(prompt, /Csíkszereda/);
  assert.match(prompt, /kovászos kenyér/);
  assert.match(prompt, /1:1/);
  assert.doesNotMatch(prompt, /\+40744123456/);
});
