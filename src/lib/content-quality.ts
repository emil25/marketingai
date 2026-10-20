import { HU_RO_PROMPTS } from "@/i18n/prompts/hu-RO";
import { isRegulatedBusinessType } from "./approved-claims";

/** The same unresolved-data check is used by the editor and server mutations. */
export function contentPlaceholders(...texts: Array<string | null | undefined>): string[] {
  return [...new Set(texts.flatMap((text) => text?.match(/\[[^\]]+\]/g) ?? []))];
}

export function assertContentReady(...texts: Array<string | null | undefined>) {
  const missing = contentPlaceholders(...texts);
  if (missing.length) {
    throw new Error(
      `Ütemezés vagy közzététel előtt töltsd ki a hiányzó adatokat: ${missing.join(", ")}.`,
    );
  }
}

/** Hide resolved placeholder reminders without hiding independent fact-review tasks. */
export function contentReviewItems(warnings: string[], texts: string[]) {
  const missing = contentPlaceholders(...texts);
  const reminders = warnings.filter((warning) => {
    const references = contentPlaceholders(warning);
    return references.length === 0 || references.some((reference) => missing.includes(reference));
  });
  return [
    ...new Set([
      ...reminders,
      ...missing.filter(
        (placeholder) => !reminders.some((warning) => warning.includes(placeholder)),
      ),
    ]),
  ];
}

export type ContentRuleContext = {
  businessType?: string;
  approvedClaims?: string[];
  allowedWeekdays?: string[];
};

export type ContentFinding = {
  severity: "hard" | "soft";
  category: string;
  message: string;
};

const normalizeClaim = (value: string) =>
  value.toLocaleLowerCase("hu").normalize("NFC").replace(/[^\p{L}\p{N}]+/gu, " ").trim();

const SOFT_CLAIMS: Record<string, RegExp> = {
  bakery_cafe: /\b(?:frissen sül\w*|frissen készül\w*|illatos\w*|omlós\w*|finom\w*|ropogós\w*|puha)\b/giu,
  restaurant: /\b(?:illatos\w*|finom\w*|ropogós\w*|omlós\w*|frissen készül\w*)\b/giu,
  accommodation: /\b(?:csendes\w*|kényelmes\w*|otthonos\w*|hangulatos\w*|nyugodt\w*)\b/giu,
  hair_salon: /\b(?:friss\w*|elegáns\w*|letisztult\w*|kényelmes\w*|barátságos\w*)\b/giu,
  beauty_salon: /\b(?:kellemes\w*|pihentető\w*|nyugodt\w*|barátságos\w*|letisztult\w*)\b/giu,
  auto_service: /\b(?:kényelmes\w*|barátságos\w*|átlátható\w*)\b/giu,
  electrician: /\b(?:átlátható\w*|barátságos\w*|rendezett\w*)\b/giu,
  accountant: /\b(?:átlátható\w*|érthető\w*|barátságos\w*|közvetlen\w*)\b/giu,
  lawyer: /\b(?:érthető\w*|átlátható\w*|közvetlen\w*|barátságos\w*)\b/giu,
  ecommerce: /\b(?:praktikus\w*|könnyű\w*|egyszerű\w*|kényelmes\w*)\b/giu,
  dental_practice: /\b(?:nyugodt\w*|barátságos\w*|kellemes\w*|kényelmes\w*)\b/giu,
  real_estate: /\b(?:világos\w*|tágas\w*|csendes\w*|hangulatos\w*)\b/giu,
  fitness: /\b(?:lendületes\w*|jó hangulat\w*|motiváló\w*)\b/giu,
  car_dealer: /\b(?:kényelmes\w*|praktikus\w*|rendezett\w*)\b/giu,
  local_business: /\b(?:barátságos\w*|kényelmes\w*|hangulatos\w*|közvetlen\w*)\b/giu,
  retail: /\b(?:praktikus\w*|kényelmes\w*|finom\w*|illatos\w*|barátságos\w*)\b/giu,
  other: /\b(?:barátságos\w*|kényelmes\w*|hangulatos\w*|közvetlen\w*)\b/giu,
};

const PRODUCT_TERMS: Record<string, RegExp[]> = {
  bakery_cafe: [
    /\bkeny[eé]r\p{L}*/giu,
    /\bpéksütemény\w*/giu,
    /\bkifli\w*/giu,
    /\bzsemle\w*/giu,
    /\bkalács\w*/giu,
    /\bkakaós csiga\w*/giu,
    /\bpogácsa\w*/giu,
    /\bcroissant\w*/giu,
    /\btorta\w*/giu,
    /\bsütemény\w*/giu,
    /\bkávé\w*/giu,
    /\btea\w*/giu,
    /\bszendvics\w*/giu,
    /\bpizza\w*/giu,
  ],
  restaurant: [
    /\bnapi menü\w*/giu,
    /\bleves\w*/giu,
    /\bfőétel\w*/giu,
    /\bpizza\w*/giu,
    /\bhamburger\w*/giu,
    /\bdesszert\w*/giu,
  ],
  accommodation: [
    /\bszoba\w*/giu,
    /\bapartman\w*/giu,
    /\belviteles reggeli\p{L}*/giu,
    /\breggeli ajánlat\p{L}*/giu,
    /\bfélpanzió\w*/giu,
    /\bwellness\w*/giu,
    /\bmedence\w*/giu,
    /\bszauna\w*/giu,
    /\bjakuzzi\w*/giu,
    /\bparkoló\w*/giu,
  ],
  beauty_salon: [
    /\barckezelés\w*/giu,
    /\barctisztítás\w*/giu,
    /\bmanikűr\w*/giu,
    /\bpedikűr\w*/giu,
    /\bszempilla\w*/giu,
    /\bszemöldök\w*/giu,
    /\bgyantázás\w*/giu,
    /\bmasszázs\w*/giu,
    /\bsmink\w*/giu,
  ],
  hair_salon: [/\bhajfestés\w*/giu, /\bhajvágás\w*/giu, /\bfrizura\w*/giu],
  auto_service: [
    /\bolajcsere\w*/giu,
    /\bfékbetét\w*/giu,
    /\bműszaki vizsga\w*/giu,
    /\bgumicsere\w*/giu,
    /\bautódiagnosztika\w*/giu,
  ],
  electrician: [
    /\bhibajavítás\w*/giu,
    /\bvezetékcsere\w*/giu,
    /\bvillamos biztonsági felülvizsgálat\w*/giu,
  ],
  other: [
    /\bkerékpárkölcsönzés\w*/giu,
    /\bbiciklikölcsönzés\w*/giu,
    /\bidegenvezetés\w*/giu,
    /\brendezvényszervezés\w*/giu,
    /\bwebfejlesztés\w*/giu,
    /\bfotózás\w*/giu,
    /\btanfolyam\w*/giu,
    /\bképzés\w*/giu,
    /\btanácsadás\w*/giu,
    /\btakarítás\w*/giu,
    /\bszállítás\w*/giu,
  ],
};

const ALL_OFFER_TERMS = Object.values(PRODUCT_TERMS).flat();

/** Show a small profile question when the profile and idea contain no concrete offer. */
export function needsOfferDetails(
  profile: {
    businessType?: string;
    industry?: string;
    products?: string;
    services?: string;
  },
  brief: string,
) {
  if (profile.products?.trim() || profile.services?.trim()) return false;
  const providedIdea = brief.trim();
  if (!providedIdea) return true;
  const patterns = ALL_OFFER_TERMS;
  const knownOffer = patterns.some((pattern) => {
    pattern.lastIndex = 0;
    return pattern.test(providedIdea);
  });
  const explicitOfferCue = /\b(?:kínálat(?:unk)?|termék(?:ünk)?|szolgáltatás(?:unk)?)\s*:\s*\S+/iu.test(providedIdea);
  return !knownOffer && !explicitOfferCue;
}

type ClaimRule = { category: string; pattern: RegExp; label: string };
const CLAIM_PLACEHOLDERS: Record<string, string> = {
  HARD_CLAIM_DISCOUNT: "[kedvezmény]",
  HARD_CLAIM_PRICE: "[ár]",
  HARD_CLAIM_DATE: "[dátum]",
  HARD_CLAIM_TIME: "[időpont]",
  HARD_CLAIM_PHONE: "[telefonszám]",
  HARD_CLAIM_ADDRESS: "[cím]",
  HARD_CLAIM_OPENING_HOURS: "[nyitvatartás]",
  HARD_CLAIM_SCHEDULE: "[gyakoriság]",
  HARD_CLAIM_FEE: "[díj]",
  HARD_CLAIM_GUARANTEE: "[garancia]",
  HARD_CLAIM_SUPERLATIVE: "[ellenőrzött állítás]",
  HARD_CLAIM_AWARD: "[díj vagy oklevél]",
  HARD_CLAIM_HEALTH_PROMISE: "[ellenőrzött szakmai állítás]",
  HARD_CLAIM_TECHNICAL_PROMISE: "[ellenőrzött műszaki állítás]",
  HARD_CLAIM_UNSUPPORTED_ANNOUNCEMENT: "[megadott újdonság]",
  HARD_CLAIM_EMPTY_PROMISE: "[konkrét, megadott előny]",
  HARD_CLAIM_UNSUPPORTED_TOPIC: "[megadott témakör]",
  HARD_CLAIM_UNSUPPORTED_PRODUCT: "[megadott termék vagy szolgáltatás]",
};
const HARD_CLAIMS: ClaimRule[] = [
  { category: "HARD_CLAIM_DISCOUNT", pattern: /\b\d+(?:[.,]\d+)?\s*%\s*(?:kedvezmény|árengedmény|off)?\b|\b(?:kedvezmény|árengedmény)\b/giu, label: "kedvezmény vagy százalék" },
  { category: "HARD_CLAIM_PRICE", pattern: /\b\d+(?:[.,]\d+)?\s*(?:lej|lei|ron|forint|ft|eur|€)\b|\b(?:ára|ár|mindössze)\s+\d+(?:[.,]\d+)?\b/giu, label: "ár vagy pénzösszeg" },
  { category: "HARD_CLAIM_DATE", pattern: /\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}\.\s*(?:január|február|március|április|május|június|július|augusztus|szeptember|október|november|december)\b|\b(?:hétfő|kedd|szerda|csütörtök|péntek|szombat|vasárnap)(?:n|tól|ig|on|en|ön)?\b/giu, label: "dátum vagy konkrét nap" },
  { category: "HARD_CLAIM_TIME", pattern: /\b(?:[01]?\d|2[0-3]):[0-5]\d\b|\b\d{1,2}\s*ór(?:akor|ától|áig)\b/giu, label: "időpont" },
  { category: "HARD_CLAIM_PHONE", pattern: /(?:\+?40[\s().-]?)?(?:0\d[\s().-]?)?(?:\d[\s().-]?){7,10}\d/gu, label: "telefonszám" },
  { category: "HARD_CLAIM_ADDRESS", pattern: /\b[\p{L}]+(?:\s+[\p{L}]+){0,2}\s+(?:utca|út|tér|köz|sétány|körút)\s+\d+[\p{L}]?\b/giu, label: "pontos cím" },
  { category: "HARD_CLAIM_OPENING_HOURS", pattern: /\b(?:nyitvatartás|nyitva tartunk|nyitva vagyunk|minden nap\s+\d|hétfőtől.{0,40}(?:péntekig|vasárnapig)|\d{1,2}(?::[0-5]\d)?\s*(?:-|–|tól|től)\s*\d{1,2}(?::[0-5]\d)?\s*(?:óráig|ig)|hajnal\w*|korai nyitás|korán nyit|korán munkába áll\w*|korán kezd\w*)\b/giu, label: "nyitvatartás vagy korai nyitás" },
  { category: "HARD_CLAIM_SCHEDULE", pattern: /\b(?:minden nap|mindennap|naponta|minden reggel)\b/giu, label: "napi rendszeresség" },
  { category: "HARD_CLAIM_FEE", pattern: /\b(?:ingyenes|díjmentes|kiszállási díj|felár nélkül|nincs (?:külön )?díj)\b/giu, label: "díj vagy díjmentesség" },
  { category: "HARD_CLAIM_GUARANTEE", pattern: /\bgaranci\w*\b/giu, label: "garancia" },
  { category: "HARD_CLAIM_SUPERLATIVE", pattern: /\b(?:első|egyetlen|legjobb|legolcsóbb|legtapasztaltabb|legnépszerűbb|legmagasabb|leggyorsabb|legbiztonságosabb|országos első|piacvezető)\b/giu, label: "elsőség vagy felsőfokú állítás" },
  { category: "HARD_CLAIM_AWARD", pattern: /\b(?:díjnyertes|díjat nyert|oklevelet kapott|elismerésben részesült|aranyérmes)\b/giu, label: "díj vagy oklevél" },
  { category: "HARD_CLAIM_HEALTH_PROMISE", pattern: /\b(?:gyógyít\w*|meggyógyít\w*|fájdalommentes\w*|allergiamentes\w*|méregtelenít\w*|fogyaszt\w*|ránctalanít\w*|fiatalít\w*|kisimít\w* a ráncokat|megszünteti a (?:fájdalmat|ráncokat|panaszt)|garantált eredmény)\b/giu, label: "egészségügyi vagy kozmetikai ígéret" },
  { category: "HARD_CLAIM_TECHNICAL_PROMISE", pattern: /\b(?:hibamentes\w*|örök élettartam\w*|100\s*%\s*(?:biztonság|megoldás|hiba nélküli)|minden hibát megold\w*|azonnal működni fog)\b/giu, label: "műszaki ígéret" },
  { category: "HARD_CLAIM_UNSUPPORTED_ANNOUNCEMENT", pattern: /(?<![\p{L}\p{N}_])(?:újdonság\p{L}*|új\s+(?:termék\p{L}*|szolgáltatás\p{L}*|kínálat\p{L}*|ajánlat\p{L}*|menü\p{L}*|üzlet\p{L}*|hely\p{L}*|kollekció\p{L}*|kezelés\p{L}*|csomag\p{L}*|program\p{L}*|lehetőség\p{L}*|élmény\p{L}*)|érkez\p{L}*|hamarosan|most indul\p{L}*|bemutatjuk|nyitás\p{L}*)(?![\p{L}\p{N}_])/giu, label: "be nem jelentett újdonság" },
  { category: "HARD_CLAIM_EMPTY_PROMISE", pattern: /(?<![\p{L}\p{N}_])(?:teljesen új élmény\p{L}*|új lehetőségekkel|új szintre emel\p{L}*|új korszak\p{L}*|felejthetetlen élmény\p{L}*|minden eddiginél jobb élmény\p{L}*)(?![\p{L}\p{N}_])/giu, label: "konkrétummal alá nem támasztott ígéret" },
];

const INFERRED_TOPIC_CLAIMS = [
  {
    pattern: /\bzenei?\s+(?:témá\w*|tartalm\w*|szolgáltatás\w*)/giu,
    supportedFact: /\bzene\p{L}*/iu,
    label: "a profilból nem igazolt zenei téma",
  },
];

function supportedByFacts(match: string, facts: string, approvedClaims: string[]) {
  const normalized = normalizeClaim(match);
  if (!normalized) return false;
  const sources = [facts, ...approvedClaims].map(normalizeClaim).filter(Boolean);
  return sources.some((source) => source.includes(normalized));
}

function explicitTopicFacts(facts: string) {
  try {
    const parsed: unknown = JSON.parse(facts);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return facts;
    const fields = parsed as Record<string, unknown>;
    const business = fields.business && typeof fields.business === "object" && !Array.isArray(fields.business)
      ? (fields.business as Record<string, unknown>)
      : {};
    return [fields, business].flatMap((source) =>
      ["products", "services", "offers", "industry", "brandDescription", "brief", "campaign", "approvedClaims", "suppliedText"]
        .flatMap((key) => {
          const value = source[key];
          return typeof value === "string" ? [value] : Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
        }),
    )
      .join(" ");
  } catch {
    return facts;
  }
}

/** Accept common Hungarian case/object suffixes when a listed product is used naturally in a sentence. */
function supportedProductByFacts(match: string, facts: string, approvedClaims: string[]) {
  if (supportedByFacts(match, facts, approvedClaims)) return true;
  const normalized = normalizeClaim(match);
  if (!normalized) return false;
  const sources = [facts, ...approvedClaims].map(normalizeClaim).filter(Boolean);
  const matchWords = normalized.split(" ");
  const sourceWords = sources.flatMap((source) => source.split(" "));
  // A topic may naturally build a compound around a known product ("kenyérválasztás").
  if (matchWords.some((word) => sourceWords.some((factWord) => factWord.length >= 5 && word.startsWith(factWord))))
    return true;
  const suffixes = ["nak", "nek", "val", "vel", "ral", "rel", "ban", "ben", "ból", "ből", "ról", "ről", "hoz", "hez", "höz", "ra", "re", "on", "en", "ön", "at", "et", "ot", "öt", "t", "n"];
  for (const suffix of suffixes) {
    if (!normalized.endsWith(suffix) || normalized.length <= suffix.length + 2) continue;
    let stem = normalized.slice(0, -suffix.length).trim();
    if (!stem) continue;
    // Hungarian vowel harmony can lengthen the final vowel before the object suffix (csigá-t).
    stem = stem.replace(/[áéíóöőúüű]$/u, (vowel) => ({ á: "a", é: "e", í: "i", ó: "o", ö: "o", ő: "o", ú: "u", ü: "u", ű: "u" })[vowel] ?? vowel);
    const lengthenedStem = stem.replace(/([aeiouöü])([^aeiouöüáéíóöőúüű]*)$/u, (_match, vowel: string, tail: string) =>
      `${({ a: "á", e: "é", i: "í", o: "ó", ö: "ő", u: "ú", ü: "ű" })[vowel] ?? vowel}${tail}`,
    );
    if (sources.some((source) => source.includes(stem) || source.includes(lengthenedStem))) return true;
  }
  return false;
}

function weekdayWasProvided(match: string, context: ContentRuleContext) {
  const normalized = normalizeClaim(match);
  const base = normalized.replace(/(?:tól|től|ig|on|en|ön|n)$/u, "");
  return (context.allowedWeekdays ?? []).some((day) => day === normalized || day === base);
}

function canonicalSoftClaim(value: string) {
  return normalizeClaim(value).replace(/\bfrissen s[üű](?:l|t)\w*/gu, "frissen süt");
}

function softClaimSupported(match: string, facts: string, approvedClaims: string[]) {
  const normalized = canonicalSoftClaim(match);
  return [facts, ...approvedClaims]
    .map(canonicalSoftClaim)
    .some((source) => source.includes(normalized));
}

function hardClaimFindings(
  published: string,
  facts: string,
  context: ContentRuleContext,
): ContentFinding[] {
  const findings: ContentFinding[] = [];
  // A custom approved-claim entry must not bypass hard checks in regulated sectors.
  const approvedClaims = isRegulatedBusinessType(context.businessType) ? [] : context.approvedClaims ?? [];
  for (const rule of HARD_CLAIMS) {
    rule.pattern.lastIndex = 0;
    for (const match of published.matchAll(rule.pattern)) {
      if (supportedByFacts(match[0], facts, approvedClaims)) continue;
      if (rule.category === "HARD_CLAIM_DATE" && weekdayWasProvided(match[0], context)) continue;
      findings.push({
        severity: "hard",
        category: rule.category,
        message: `Nem szerepel ilyen tény a profilban, az ötletben vagy a jóváhagyott állításokban: „${match[0]}” (${rule.label}). Töröld ezt az állítást, vagy cseréld erre a helykitöltőre: ${CLAIM_PLACEHOLDERS[rule.category] ?? "[ellenőrizendő adat]"}.`,
      });
    }
  }
  const topicEvidence = explicitTopicFacts(facts);
  for (const rule of INFERRED_TOPIC_CLAIMS) {
    rule.pattern.lastIndex = 0;
    for (const match of published.matchAll(rule.pattern)) {
      if (rule.supportedFact.test(topicEvidence) || (context.approvedClaims ?? []).some((claim) => rule.supportedFact.test(claim)))
        continue;
      findings.push({
        severity: "hard",
        category: "HARD_CLAIM_UNSUPPORTED_TOPIC",
        message: `A márkanév önmagában nem igazolja ezt a tevékenységi témát: „${match[0]}” (${rule.label}). Csak a profilban vagy az ötletben megadott témát használd, különben cseréld erre: ${CLAIM_PLACEHOLDERS.HARD_CLAIM_UNSUPPORTED_TOPIC}.`,
      });
    }
  }
  // Any concrete offer claim is checked, including when the owner selected "Other".
  // A brand name or business category alone is never evidence for a specific offer.
  for (const rule of ALL_OFFER_TERMS) {
    rule.lastIndex = 0;
    for (const match of published.matchAll(rule)) {
      if (supportedProductByFacts(match[0], facts, approvedClaims)) continue;
      findings.push({
        severity: "hard",
        category: "HARD_CLAIM_UNSUPPORTED_PRODUCT",
        message: `A megadott profil vagy ötlet nem tartalmazza ezt a terméket vagy szolgáltatást: ${match[0]}. Töröld, vagy cseréld erre: ${CLAIM_PLACEHOLDERS.HARD_CLAIM_UNSUPPORTED_PRODUCT ?? "[megadott termék vagy szolgáltatás]"}.`,
      });
    }
  }
  return findings;
}

function softClaimFindings(
  published: string,
  facts: string,
  context: ContentRuleContext,
): ContentFinding[] {
  const pattern = SOFT_CLAIMS[context.businessType ?? "other"] ?? SOFT_CLAIMS.other;
  pattern.lastIndex = 0;
  const findings = new Map<string, ContentFinding>();
  for (const match of published.matchAll(pattern)) {
    if (softClaimSupported(match[0], facts, context.approvedClaims ?? [])) continue;
    const key = normalizeClaim(match[0]);
    findings.set(key, {
      severity: "soft",
      category: "SOFT_CLAIM_ADJECTIVE",
      message: `Ellenőrizd, hogy ez a leírás igaz-e a vállalkozásodra: „${match[0]}”.`,
    });
  }
  return [...findings.values()];
}

function otherRuleFindings(
  text: string,
  platform: string,
  facts: string,
  hashtags: string[] | undefined,
  language: string,
): ContentFinding[] {
  const errors: string[] = [];
  const published = text.replace(/\[[^\]]+\]/g, "");
  const tags = [
    ...new Set(
      (hashtags ?? published.match(/#[\p{L}\p{N}_]+/gu) ?? [])
        .map((tag) => tag.trim().replace(/^#+/, ""))
        .filter((tag) => /^[\p{L}\p{N}_]+$/u.test(tag)),
    ),
  ];
  if (platform === "facebook" && tags.length > 2) errors.push("Facebook: legfeljebb két hashtag.");
  if ((platform === "google-business" || platform === "google_business") && tags.length)
    errors.push("Google Business: hashtag nélkül.");
  if (platform === "instagram") {
    if (tags.length < 4 || tags.length > 6)
      errors.push(
        "Instagram: adj pontosan öt releváns #hashtaget a séma szerinti helyre (a heti tervben a vazlat legvégére). Jelenleg " +
          tags.length +
          " hashtag van.",
      );
    const emojiCount = published.match(/\p{Extended_Pictographic}/gu)?.length ?? 0;
    if (emojiCount < 1 || emojiCount > 3) errors.push("Instagram: 1–3 emoji szükséges.");
  }
  if (/\bregisztrált (?:vendég|dolgozó|ügyfél)\b/iu.test(published) && !/\bregisztrált (?:vendég|dolgozó|ügyfél)\b/iu.test(facts))
    errors.push("Nincs megadott tény ehhez: regisztrált ügyfelek. Töröld, vagy használj helykitöltőt.");
  if (/díjnyertes|családi recept/iu.test(published) && !/díjnyertes|családi recept/iu.test(facts))
    errors.push("Nincs megadott tény ehhez: díj vagy családi recept. Töröld, vagy használj helykitöltőt.");
  if (/ínycsiklandó|feldobja a napod|energikus|varázslatos|páratlan|egyedülálló|legjobb választás|ne hagyd ki|ne maradj le|napod igazán jól kezdődjön/iu.test(published))
    errors.push("Kerüld a tiltott marketing-töltelékszavakat.");
  if (/\bkommentelj\s+(?:IGEN|IGEN-t|igen|igen-t)\b|\boszd\s+meg,?\s+ha\b|\bcímkézd\s+meg\b|\bjelöld\s+meg\b/iu.test(published))
    errors.push("Ne kérj aktivitásvadász hozzászólást, megosztást vagy megjelölést.");
  if (/reggelije[^.!?\n]{0,100}\bvár\b/iu.test(published))
    errors.push("Természetellenes nyitómondat: ne a reggeli várjon. Fogalmazz a vállalkozás vagy a konkrét termék felől.");
  if (/(?<![\p{L}])(?:sziasztok|tudtátok|nektek|kérhettek|indultok|gyertek|nézzetek)(?![\p{L}])/iu.test(published) && /(?<![\p{L}])(?:te|téged|neked|indulsz|sietsz|kérheted)(?![\p{L}])/iu.test(published))
    errors.push("Ne keverd a te és ti megszólítást. Írd át végig egyes szám második személyre, kivéve ha a márkaprofil más megszólítást kér.");
  const calls = published.match(/(?<![\p{L}])(?:látogassatok|gyertek|írjatok|írjátok meg|foglaljatok|kérdezzetek|kóstoljátok|nézzétek meg|vigyétek el|hozzátok magatokkal|ugorjatok be|keressétek fel|próbáljátok ki|kérjetek|válasszatok|osszátok meg|ismerjétek meg|tudjátok meg|fedezzétek fel|mondjátok el|csatlakozzatok|rendeljetek|hívjatok|vásároljatok|regisztráljatok|jelentkezzetek|mentsétek el|küldjétek el|vegyétek fel|látogass|gyere|írj|írd meg|foglalj|kérdezz|kóstold|nézd meg|vidd el|hozd magaddal|ugorj be|keresd fel|próbáld ki|kérj|válassz|oszd meg|ismerd meg|tudd meg|fedezd fel|mondd el|csatlakozz|rendelj|hívj|vásárolj|regisztrálj|jelentkezz|mentsd el|küldd el|vedd fel|látogasson|jöjjön|írjon|írja meg|foglaljon|kérdezzen|kóstolja|nézze meg|vigye el|hozza magával|ugorjon be|keresse fel|próbálja ki|kérjen|válasszon|ossza meg|ismerje meg|tudja meg|fedezze fel|mondja el|csatlakozzon|rendeljen|hívjon|vásároljon|regisztráljon|jelentkezzen|mentse el|küldje el|vegye fel)(?![\p{L}])/giu) ?? [];
  if (calls.length > 1) errors.push(`Több CTA szerepel: ${calls.join(", ")}. Csak egyetlen felhívás maradjon a végén. A többit alakítsd kijelentéssé vagy töröld. Kérdés-posztnál az Írd meg kommentben! lehet az egyetlen CTA; akkor ne legyen mellette Látogass el hozzánk!`);
  const conversationalQuestion = platform === "facebook" && /\?\s*(?:#[\p{L}\p{N}_]+\s*)*$/u.test(published.trim());
  if (/^(magyar|hu(?:$|[-_])|hungarian)/i.test(language) && calls.length === 0 && !conversationalQuestion)
    errors.push("Hiányzik a konkrét CTA. A végén egyetlen felhívás legyen: például Látogass el!, Írd meg kommentben!, Foglalj most! vagy Mentsd el, ha erre jársz! A Mentésre ajánljuk fordulat helyett írj közvetlen felhívást: Mentsd el!.");
  return errors.map((message) => ({
    severity: "hard" as const,
    category: /hashtag|emoji|Google Business|Facebook:|Instagram:/iu.test(message)
      ? "CONTENT_CHANNEL_RULE"
      : /CTA|felhívás|kérdés-poszt/iu.test(message)
        ? "CONTENT_CTA_RULE"
        : "CONTENT_STYLE_RULE",
    message,
  }));
}

/** Hard claims are rejected; reasonable, unconfirmed descriptors only need owner review. */
export function contentRuleFindings(
  text: string,
  platform: string,
  facts: string,
  hashtags?: string[],
  language = "magyar",
  context: ContentRuleContext = {},
): ContentFinding[] {
  const published = text.replace(/\[[^\]]+\]/g, "");
  return [
    ...contentClaimFindings(published, facts, context),
    ...otherRuleFindings(text, platform, facts, hashtags, language),
  ];
}

/** Claim-only checks for short ideas that are not complete posts and have no CTA. */
export function contentClaimFindings(
  text: string,
  facts: string,
  context: ContentRuleContext = {},
): ContentFinding[] {
  const published = text.replace(/\[[^\]]+\]/g, "");
  return [
    ...hardClaimFindings(published, facts, context),
    ...softClaimFindings(published, facts, context),
  ];
}

/** Preserve the existing helper for publish paths: only blocking findings are returned. */
export function contentRuleViolations(
  text: string,
  platform: string,
  facts: string,
  hashtags?: string[],
  language = "magyar",
  context: ContentRuleContext = {},
): string[] {
  return contentRuleFindings(text, platform, facts, hashtags, language, context)
    .filter((finding) => finding.severity === "hard")
    .map((finding) => finding.message);
}

export function contentSoftClaimWarnings(
  text: string,
  facts: string,
  context: ContentRuleContext = {},
) {
  return softClaimFindings(text.replace(/\[[^\]]+\]/g, ""), facts, context).map(
    (finding) => finding.message,
  );
}

export const FACTUAL_CONTENT_RULES = `${HU_RO_PROMPTS.factualContentRules}
Ne következtess a vállalkozás kínálatára a márkanévből vagy pusztán a vállalkozástípusból. Csak a márkaprofilban, termékek/szolgáltatások között, jóváhagyott állításokban vagy a felhasználó ötletében szereplő üzleti tényt használd. Ha ezek szűkösek, írj rövidebben és csak a megadott tényekből; ne pótold a hiányt általános marketingszöveggel. A szükséges, de hiányzó adatot szögletes helykitöltővel jelöld. A felhasználónak szóló kérdés külön jelenjen meg, ne a közzétehető szöveg részeként.`;
