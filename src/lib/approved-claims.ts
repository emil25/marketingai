import { normalizeBusinessType } from "./business-types";

const CLAIM_SUGGESTIONS: Record<string, readonly string[]> = {
  bakery_cafe: [
    "Frissen sütünk",
    "Házi készítésű termékeket kínálunk",
    "Helyi alapanyagokat használunk",
  ],
  retail: ["Helyi termékeket is kínálunk", "Személyes átvétel lehetséges", "Csomagküldés elérhető"],
  restaurant: [
    "Frissen készítjük az ételeket",
    "Helyi alapanyagokat használunk",
    "Helyben fogyasztás lehetséges",
  ],
  accommodation: ["Házi reggelit kínálunk", "Családokat is fogadunk", "Parkolási lehetőség van"],
  hair_salon: [
    "Előzetes időpontfoglalással dolgozunk",
    "Hajfestést is vállalunk",
    "Férfi és női hajvágást is végzünk",
  ],
  beauty_salon: [],
  auto_service: [
    "Előzetes időpontfoglalással dolgozunk",
    "Műszaki vizsgára való felkészítést is vállalunk",
  ],
  electrician: ["Kiszállást is vállalunk", "Villamos biztonsági felülvizsgálatot is végzünk"],
  accountant: [
    "Online ügyintézés is lehetséges",
    "Kisvállalkozások könyvelését is vállaljuk",
    "Román és magyar nyelven is dolgozunk",
  ],
  lawyer: [],
  ecommerce: [
    "Csomagküldés elérhető",
    "Személyes átvétel lehetséges",
    "Bankkártyás fizetés lehetséges",
  ],
  dental_practice: [],
  real_estate: [
    "Lakásokat is közvetítünk",
    "Házakat is közvetítünk",
    "Előzetes időpontfoglalással dolgozunk",
  ],
  fitness: ["Személyi edzést is tartunk", "Csoportos órák is vannak", "Kezdőket is fogadunk"],
  car_dealer: [
    "Használt autókat is kínálunk",
    "Tesztvezetés előre egyeztethető",
    "Finanszírozási ügyintézésben is segítünk",
  ],
  local_business: [
    "Előzetes egyeztetéssel fogadunk",
    "Helyi kiszállást is vállalunk",
    "Magyar és román nyelven is dolgozunk",
  ],
  other: [
    "Előzetes időpontfoglalással dolgozunk",
    "Helyi kiszállást is vállalunk",
    "Magyar és román nyelven is dolgozunk",
  ],
};

const RESTRICTED_TYPE_TERMS =
  /(?:egészség(?:ügy)?|orvos|doctor|medical|health|fogászat|fogorvos|dentist|dental|ügyvéd|lawyer|kozmetika|szépészeti kezelés|kozmetikai kezelés|beauty[_ -]?salon)/iu;

/** True for canonical regulated types and common labels/aliases stored by older profiles. */
export function isRegulatedBusinessType(businessType: string | null | undefined) {
  const normalized = normalizeBusinessType(businessType);
  const canonical = ["beauty_salon", "dental_practice", "lawyer"].includes(normalized);
  return canonical || RESTRICTED_TYPE_TERMS.test((businessType ?? "").trim());
}

export function approvedClaimSuggestions(businessType: string | null | undefined) {
  if (isRegulatedBusinessType(businessType)) return [];
  return (CLAIM_SUGGESTIONS[normalizeBusinessType(businessType)] ?? CLAIM_SUGGESTIONS.other).slice(
    0,
    5,
  );
}

export function cleanApprovedClaims(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim().slice(0, 200))
        .filter((item) => item.length >= 2),
    ),
  ].slice(0, 30);
}
