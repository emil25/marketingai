import { normalizeBusinessType } from "./business-types";

export type Addressing = "te" | "Ön" | "ti";
export const ONBOARDING_TONES = ["Barátságos", "Professzionális", "Játékos", "Inspiráló"] as const;
export const BRAND_MOODS = ["Letisztult", "Prémium", "Lendületes"] as const;
export function defaultAddressing(type: string): Addressing {
  return ["lawyer", "accountant"].includes(normalizeBusinessType(type)) ? "Ön" : "te";
}
export function brandVoiceGuardrails(addressing: Addressing, mood = "") {
  const form =
    addressing === "Ön"
      ? "magázás, egyes szám harmadik személy (Ön)"
      : addressing === "ti"
        ? "tegezés, többes szám második személy (ti)"
        : "tegezés, egyes szám második személy (te)";
  return `Ne találj ki árakat, akciókat, nyitvatartást vagy ügyfélvéleményeket. Megszólítás: ${form}. Ne keverd más megszólítással.${mood ? ` Kommunikáció hangulata: ${mood}.` : ""}`;
}

/** Explicitly labelled UI style sample, never saved as generated business content. */
export function brandStyleSample(name: string, tone: string, addressing: Addressing, mood = "") {
  const brand = name.trim() || "A vállalkozásod";
  const greeting =
    tone === "Professzionális"
      ? "A kínálatunkról és szolgáltatásainkról itt tájékozódhatsz."
      : tone === "Játékos"
        ? "Egy jó kérdéssel kezdődik a beszélgetés."
        : tone === "Inspiráló"
          ? "Egy ötletből indulhat a következő lépés."
          : "Örülünk, hogy itt vagy.";
  const adjusted =
    addressing === "Ön"
      ? greeting.replace("tájékozódhatsz", "tájékozódhat").replace("itt vagy", "itt van")
      : addressing === "ti"
        ? greeting.replace("tájékozódhatsz", "tájékozódhattok").replace("itt vagy", "itt vagytok")
        : greeting;
  const cta =
    addressing === "Ön"
      ? "Kérdésével írjon nekünk."
      : addressing === "ti"
        ? "Kérdésetekkel írjatok nekünk."
        : "Kérdéseddel írj nekünk.";
  return `${brand}\n${mood === "Letisztult" ? "" : adjusted + "\n"}${cta}${mood === "Lendületes" ? " ✨" : ""}`;
}

export const ONBOARDING_DRAFT_KEY = "marketingpilot-onboarding-draft-v1";
// Explicit allowlist: no credentials, tokens, File data or arbitrary properties can be stored.
const fields = [
  "name",
  "website",
  "logoUrl",
  "openingHours",
  "address",
  "cityRegion",
  "offers",
  "services",
  "products",
  "contactMethod",
  "addressing",
  "audience",
  "industry",
] as const;
export function sanitizeOnboardingDraft(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const draft = value as Record<string, unknown>;
  if (
    draft.version !== 1 ||
    typeof draft.savedAt !== "number" ||
    !Number.isFinite(draft.savedAt) ||
    Date.now() - draft.savedAt > 24 * 60 * 60 * 1000 ||
    draft.savedAt > Date.now() + 60000
  )
    return null;
  const raw =
    draft.details && typeof draft.details === "object"
      ? (draft.details as Record<string, unknown>)
      : {};
  const details: Record<string, string> = {};
  for (const key of fields)
    if (typeof raw[key] === "string")
      details[key] = raw[key].slice(
        0,
        key === "products" || key === "services" || key === "offers" ? 4000 : 2000,
      );
  if (!["te", "Ön", "ti"].includes(details.addressing)) details.addressing = "te";
  const type =
    typeof draft.businessType === "string" && draft.businessType
      ? normalizeBusinessType(draft.businessType)
      : "";
  const hours =
    Array.isArray(draft.hours) && draft.hours.length === 7
      ? draft.hours.map((day: unknown) => {
          const item = day && typeof day === "object" ? (day as Record<string, unknown>) : {};
          return {
            status: ["open", "closed"].includes(String(item.status))
              ? (item.status as "open" | "closed")
              : ("unknown" as const),
            from: typeof item.from === "string" ? item.from.slice(0, 5) : "",
            to: typeof item.to === "string" ? item.to.slice(0, 5) : "",
          };
        })
      : undefined;
  return {
    version: 1,
    savedAt: draft.savedAt,
    step: Math.max(0, Math.min(3, Number.isInteger(draft.step) ? (draft.step as number) : 0)),
    businessType: type,
    tone: ONBOARDING_TONES.includes(draft.tone as (typeof ONBOARDING_TONES)[number])
      ? (draft.tone as string)
      : "Barátságos",
    mood: BRAND_MOODS.includes(draft.mood as (typeof BRAND_MOODS)[number])
      ? (draft.mood as string)
      : "",
    color:
      typeof draft.color === "string" && /^#[0-9a-f]{6}$/i.test(draft.color)
        ? draft.color
        : "#ed674d",
    addressingTouched: draft.addressingTouched === true,
    details,
    hours,
    hadLogo: draft.hadLogo === true,
  };
}
