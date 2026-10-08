import type { BrandProfileRecord, BrandRecord, PostPlatform } from "@/lib/data-model";

export const BUSINESS_TYPES = [
  {
    value: "bakery_cafe",
    label: "Pékség / kávézó / cukrászda",
    quickStarts: [
      "Mai kínálat",
      "Kiemelt termék",
      "Reggeli ajánlat",
      "Előrendelés",
      "Instagram poszt",
      "Google Cégprofil",
    ],
  },
  {
    value: "retail",
    label: "Üzlet / bolt",
    quickStarts: [
      "Új termék",
      "Heti ajánlat",
      "Termékbemutató",
      "Vásárlói tipp",
      "Facebook poszt",
      "Google Cégprofil",
    ],
  },
  {
    value: "restaurant",
    label: "Étterem",
    quickStarts: [
      "Mai menü",
      "Instagram / Reels",
      "Heti ajánlat",
      "Google Cégprofil",
      "Ételfotó",
      "Facebook poszt",
    ],
  },
  {
    value: "accommodation",
    label: "Panzió / szálláshely",
    quickStarts: [
      "Hétvégi ajánlat",
      "Szabad időpontok",
      "Reels ötlet",
      "Google Cégprofil",
      "Vendégcsalogató poszt",
      "Blogötlet",
    ],
  },
  {
    value: "hair_salon",
    label: "Fodrászat",
    quickStarts: [
      "Új frizura poszt",
      "Előtte / utána",
      "Időpontfoglalás",
      "Instagram poszt",
      "Facebook poszt",
      "Google Cégprofil",
    ],
  },
  {
    value: "beauty_salon",
    label: "Kozmetika",
    quickStarts: [
      "Kezelésbemutató",
      "Előtte / utána",
      "Időpontfoglalás",
      "Bőrápolási tipp",
      "Instagram poszt",
      "Google Cégprofil",
    ],
  },
  {
    value: "auto_service",
    label: "Autószerelő",
    quickStarts: [
      "Szezonális szerviz",
      "Autóápolási tipp",
      "Szabad időpontok",
      "Szolgáltatásbemutató",
      "Google Cégprofil",
      "Facebook poszt",
    ],
  },
  {
    value: "electrician",
    label: "Villanyszerelő",
    quickStarts: [
      "Biztonsági tipp",
      "Szolgáltatásbemutató",
      "Gyors hibajavítás",
      "Előtte / utána",
      "Google Cégprofil",
      "Facebook poszt",
    ],
  },
  {
    value: "accountant",
    label: "Könyvelő",
    quickStarts: [
      "Határidő-emlékeztető",
      "Adózási tipp",
      "Szolgáltatásbemutató",
      "Ügyfélkérdés",
      "LinkedIn poszt",
      "Facebook poszt",
    ],
  },
  {
    value: "lawyer",
    label: "Ügyvéd",
    quickStarts: [
      "Jogi kisokos",
      "Gyakori kérdés",
      "Szolgáltatásbemutató",
      "Esettanulság",
      "LinkedIn poszt",
      "Google Cégprofil",
    ],
  },
  {
    value: "ecommerce",
    label: "Webáruház",
    quickStarts: [
      "Termékbemutató",
      "Heti ajánlat",
      "Újdonság",
      "Vásárlói tipp",
      "Instagram / Reels",
      "Facebook hirdetés",
    ],
  },
  {
    value: "dental_practice",
    label: "Fogászat",
    quickStarts: [
      "Kezelésbemutató",
      "Fogápolási tipp",
      "Időpontfoglalás",
      "Gyakori kérdések",
      "Google Cégprofil",
      "Facebook poszt",
    ],
  },
  {
    value: "real_estate",
    label: "Ingatlaniroda",
    quickStarts: [
      "Ingatlanbemutató",
      "Nyílt nap",
      "Környékbemutató",
      "Eladói tipp",
      "Instagram / Reels",
      "Facebook poszt",
    ],
  },
  {
    value: "fitness",
    label: "Edzőterem / fitness",
    quickStarts: [
      "Edzésbemutató",
      "Órarend",
      "Próbaedzés",
      "Edzéstipp",
      "Instagram / Reels",
      "Facebook poszt",
    ],
  },
  {
    value: "car_dealer",
    label: "Autókereskedés",
    quickStarts: [
      "Autóbemutató",
      "Újonnan érkezett autó",
      "Tesztvezetés",
      "Autóvásárlási tipp",
      "Instagram / Reels",
      "Facebook poszt",
    ],
  },
  {
    value: "local_business",
    label: "Helyi vállalkozás",
    quickStarts: [
      "Helyi ajánlat",
      "Ügyfélvélemény",
      "Nyitvatartás",
      "Google Cégprofil",
      "Facebook poszt",
      "Instagram poszt",
    ],
  },
  {
    value: "other",
    label: "Egyéb",
    quickStarts: [
      "Bemutatkozó poszt",
      "Hasznos tipp",
      "Heti ajánlat",
      "Instagram poszt",
      "Facebook poszt",
      "Google Cégprofil",
    ],
  },
] as const;

export type BusinessType = (typeof BUSINESS_TYPES)[number]["value"];

const LEGACY_LABELS: Record<string, BusinessType> = {
  pékség: "bakery_cafe",
  kávézó: "bakery_cafe",
  cukrászda: "bakery_cafe",
  "pékség / kávézó / cukrászda": "bakery_cafe",
  "üzlet / bolt": "retail",
  bolt: "retail",
  üzlet: "retail",
  étterem: "restaurant",
  "panzió / szálláshely": "accommodation",
  fodrászat: "hair_salon",
  kozmetika: "beauty_salon",
  autószerelő: "auto_service",
  villanyszerelő: "electrician",
  könyvelő: "accountant",
  ügyvéd: "lawyer",
  webáruház: "ecommerce",
  "helyi vállalkozás": "local_business",
  szépségápolás: "beauty_salon",
  kiskereskedelem: "ecommerce",
  szolgáltatás: "local_business",
  egészség: "local_business",
  oktatás: "local_business",
  ingatlan: "local_business",
  egyéb: "other",
};

export function normalizeBusinessType(value: string | null | undefined): BusinessType {
  if (BUSINESS_TYPES.some((item) => item.value === value)) return value as BusinessType;
  return LEGACY_LABELS[(value ?? "").trim().toLocaleLowerCase("hu-HU")] ?? "other";
}

export function businessTypeLabel(value: string | null | undefined) {
  const normalized = normalizeBusinessType(value);
  return BUSINESS_TYPES.find((item) => item.value === normalized)?.label ?? "Egyéb";
}

export function businessTypeQuickStarts(value: string | null | undefined) {
  const normalized = normalizeBusinessType(value);
  return (
    BUSINESS_TYPES.find((item) => item.value === normalized)?.quickStarts ??
    BUSINESS_TYPES.at(-1)!.quickStarts
  );
}

export type BusinessContext = {
  businessType: BusinessType;
  businessTypeLabel: string;
  brandName: string;
  industry: string;
  website: string;
  region: string;
  language: string;
  products: string;
  services: string;
  offers: string;
  audience: string;
  tone: string;
  ctaStyle: string;
  preferredPhrases: string;
  avoidedPhrases: string;
  learnedBrandVoice: string;
  address: string;
  openingHours: string;
  guardrails: string;
  brandDescription: string;
  goal?: string;
  platform?: PostPlatform | string;
};

export function buildBusinessContext(
  brand: BrandRecord,
  profile: BrandProfileRecord,
  overrides: Pick<
    Partial<BusinessContext>,
    "goal" | "platform" | "audience" | "region" | "language"
  > = {},
): BusinessContext {
  const businessType = normalizeBusinessType(profile.businessType);
  return {
    businessType,
    businessTypeLabel: businessTypeLabel(businessType),
    brandName: brand.name,
    industry: brand.industry,
    website: brand.website,
    region: overrides.region ?? brand.cityRegion,
    language: overrides.language ?? brand.languageMarket,
    products: brand.products,
    services: brand.services,
    offers: brand.offers,
    audience: overrides.audience ?? brand.audience,
    tone: profile.tone,
    ctaStyle: profile.ctaStyle,
    preferredPhrases: profile.preferredPhrases,
    avoidedPhrases: profile.avoidedPhrases,
    learnedBrandVoice: profile.learnedSummary ?? "",
    address: profile.address ?? "",
    openingHours: profile.openingHours ?? "",
    guardrails: profile.aiGuardrails,
    brandDescription: profile.description,
    ...(overrides.goal ? { goal: overrides.goal } : {}),
    ...(overrides.platform ? { platform: overrides.platform } : {}),
  };
}

export function businessContextPrompt(context: BusinessContext) {
  return JSON.stringify(context, null, 2);
}
