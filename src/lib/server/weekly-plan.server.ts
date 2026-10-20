import { z } from "zod";
import type { BusinessContext } from "../business-types";
import { businessContextPrompt } from "../business-types";
import {
  contentPlaceholders,
  contentRuleFindings,
  contentSoftClaimWarnings,
  needsOfferDetails,
} from "../content-quality";
import { requestAiJson } from "./ai-json.server";
import { annotateAiResponse } from "./ai-calls.server";
import { weekPlanPromptForLanguage } from "@/i18n/prompts/hu-RO";
import { seasonForDate } from "@/lib/market/ro";

const channels = [
  "facebook",
  "instagram",
  "google_business",
  "tiktok",
  "linkedin",
  "youtube",
] as const;
const types = [
  "termékbemutató",
  "kérdés",
  "ajánlat",
  "kulissza",
  "vélemény",
  "szezonális",
  "tipp",
  "hasznos_tipp_ellenorzo_lista",
] as const;
const formats = ["egyképes", "carousel", "reel", "story", "szöveges"] as const;
const phases = ["ismertség", "bizalom", "cselekvésre hívás"] as const;

export const WEEK_PLAN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["het", "szakasz", "posztok", "temak_osszefoglalo"],
  properties: {
    het: { type: "integer", minimum: 1, maximum: 5 },
    szakasz: { type: "string", enum: phases },
    posztok: {
      type: "array",
      minItems: 1,
      maxItems: 4,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "datum",
          "idopont",
          "csatorna",
          "tipus",
          "forma",
          "tema",
          "cel",
          "vazlat",
          "vizualis_otlet",
          "ellenorizendo",
        ],
        properties: {
          datum: { type: "string" },
          idopont: { type: "string" },
          csatorna: { type: "string", enum: channels },
          tipus: { type: "string", enum: types },
          forma: { type: "string", enum: formats },
          tema: { type: "string" },
          cel: { type: "string", enum: ["ismertség", "bizalom", "beszélgetés", "forgalom"] },
          vazlat: {
            type: "string",
            description:
              "Teljes posztszöveg. Instagramnál 1–3 emoji és pontosan 4–6 #hashtag a végén; Facebooknál legfeljebb 2 hashtag. Nincs külön hashtags mező.",
          },
          vizualis_otlet: { type: "string" },
          ellenorizendo: { type: "array", items: { type: "string" } },
        },
      },
    },
    temak_osszefoglalo: { type: "array", minItems: 1, maxItems: 4, items: { type: "string" } },
  },
} as const;

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => {
    const d = new Date(`${s}T00:00:00Z`);
    return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === s;
  });
export const WeekPlanSchema = z.object({
  het: z.number().int().min(1).max(5),
  szakasz: z.enum(phases),
  posztok: z
    .array(
      z.object({
        datum: dateSchema,
        idopont: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
        csatorna: z.enum(channels),
        tipus: z.enum(types),
        forma: z.enum(formats),
        tema: z.string().trim().min(1).max(160),
        cel: z.enum(["ismertség", "bizalom", "beszélgetés", "forgalom"]),
        vazlat: z.string().trim().min(1).max(10000),
        vizualis_otlet: z.string().trim().min(1).max(1000),
        ellenorizendo: z.array(z.string().trim().min(1).max(500)).max(20),
      }),
    )
    .min(1)
    .max(4),
  temak_osszefoglalo: z.array(z.string().trim().min(1).max(240)).min(1).max(4),
});
export type WeekPlan = z.infer<typeof WeekPlanSchema>;

export const WEEK_PLAN_PROMPT = weekPlanPromptForLanguage("magyar");

const SERVICE_BUSINESSES = new Set([
  "hair_salon", "beauty_salon", "auto_service", "electrician", "accountant",
  "lawyer", "dental_practice", "fitness", "real_estate", "local_business", "other",
]);
const REGULATED_BUSINESSES = new Set([
  "beauty_salon", "lawyer", "dental_practice", "doctor", "medical_practice",
]);
export function weeklyServiceTipRule(businessType: string) {
  if (!SERVICE_BUSINESSES.has(businessType)) return "";
  return REGULATED_BUSINESSES.has(businessType)
    ? "A heti poszttípusok között lehet Hasznos tipp / ellenőrzőlista, de szabályozott területen csak általános, ígéret nélküli tájékoztatást adj; ne adj diagnózist, kezelési, egészségügyi, szépségápolási vagy jogi eredményígéretet."
    : "A heti poszttípusok között legalább egy Hasznos tipp / ellenőrzőlista témát is válassz, ha természetesen illik a vállalkozáshoz.";
}

export function campaignWeeks(startDate: string, days: 7 | 30) {
  return Array.from({ length: Math.ceil(days / 7) }, (_, index) => {
    const offset = index * 7;
    const count = Math.min(7, days - offset);
    const add = (n: number) =>
      new Date(Date.parse(`${startDate}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
    return {
      week: index + 1,
      startDate: add(offset),
      endDate: add(offset + count - 1),
      length: count,
    };
  });
}

type WeeklyInput = {
  businessContext: BusinessContext;
  campaign: {
    name: string;
    objective: string;
    audience?: string;
    offer: string;
    description: string;
    startDate: string;
    endDate: string;
    timezone: string;
    cta: string;
  };
  channels: string[];
  week: ReturnType<typeof campaignWeeks>[number];
  plannedTopics: string[];
  channelCounts: Record<string, number>;
  localEvents: string[];
  model?: string;
  deadlineAt?: number;
  weekly?: boolean;
};

export async function generateWeeklyPlan(
  input: WeeklyInput,
  send?: Parameters<typeof requestAiJson>[2],
): Promise<WeekPlan> {
  const minimum = input.week.length === 7 ? (input.weekly ? 4 : 3) : 1;
  const maximum = input.week.length === 7 ? 4 : Math.min(2, input.week.length);
  const allowed = input.channels.map((p) => (p === "google-business" ? "google_business" : p));
  const normalize = (s: string) => s.toLocaleLowerCase("hu").replace(/[^\p{L}\p{N}]/gu, "");
  const weekdayNames = ["vasárnap", "hétfő", "kedd", "szerda", "csütörtök", "péntek", "szombat"];
  const allowedWeekdays = Array.from({ length: input.week.length }, (_, index) => {
    const day = new Date(Date.parse(`${input.week.startDate}T00:00:00Z`) + index * 86400000).getUTCDay();
    return weekdayNames[day];
  });
  const claimContext = {
    businessType: input.businessContext.businessType,
    approvedClaims: input.businessContext.approvedClaims,
    allowedWeekdays,
  };
  const facts = JSON.stringify({
    industry: input.businessContext.industry,
    brandDescription: input.businessContext.brandDescription,
    products: input.businessContext.products,
    services: input.businessContext.services,
    offers: input.businessContext.offers,
    address: input.businessContext.address,
    phone: input.businessContext.phone,
    region: input.businessContext.region,
    openingHours: input.businessContext.openingHours,
    localEvents: input.localEvents,
    offer: input.campaign.offer,
    brief: input.campaign.description,
  });
  const validate = WeekPlanSchema.superRefine((value, ctx) => {
    const invalid = (message: string) => ctx.addIssue({ code: "custom", message });
    if (
      value.het !== input.week.week ||
      value.posztok.length < minimum ||
      value.posztok.length > maximum
    )
      invalid("Hibás hét vagy darabszám.");
    if (
      value.posztok.some(
        (p) =>
          p.datum < input.week.startDate ||
          p.datum > input.week.endDate ||
          !allowed.includes(p.csatorna),
      )
    )
      invalid("Hibás dátum vagy csatorna.");
    if (new Set(value.posztok.map((p) => p.datum)).size !== value.posztok.length)
      invalid("Azonos napra ismételt poszt.");
    if (input.week.length === 7 && new Set(value.posztok.map((p) => p.tipus)).size < 3)
      invalid("Legalább három poszttípus szükséges.");
    for (const post of value.posztok)
      for (const finding of contentRuleFindings(
        post.vazlat,
        post.csatorna,
        facts,
        undefined,
        input.businessContext.language,
        claimContext,
      ))
        if (finding.severity === "hard")
          ctx.addIssue({
            code: "custom",
            message: `${post.datum} / ${post.tema}: ${finding.message}`,
            params: { category: finding.category },
          });
    const topics = value.posztok.map((p) => normalize(p.tema));
    const repeated = value.posztok.filter(
      (post, index) =>
        topics.indexOf(topics[index]) !== index ||
        input.plannedTopics.some((old) => normalize(old) === topics[index]),
    );
    if (repeated.length)
      invalid(
        `Ismételt téma: ${repeated.map((post) => post.tema).join("; ")}. Ezek helyett válassz teljesen új tartalmi nézőpontot, ne csak a címüket írd át. A poszt szövegét és temak_osszefoglalo elemét is változtasd meg.`,
      );
    if (value.temak_osszefoglalo.length !== value.posztok.length)
      invalid("Minden témához összefoglaló szükséges.");
  });
  const schema = {
    ...WEEK_PLAN_SCHEMA,
    properties: {
      ...WEEK_PLAN_SCHEMA.properties,
      posztok: { ...WEEK_PLAN_SCHEMA.properties.posztok, minItems: minimum, maxItems: maximum },
    },
  };
  const result = await requestAiJson(
    {
      messages: [
        {
          role: "system",
          content: `${weekPlanPromptForLanguage(input.businessContext.language)}\n${weeklyServiceTipRule(input.businessContext.businessType)}\nKemény tények: árat, kedvezményt, dátumot, időpontot, címet, telefonszámot, nyitvatartást, díjat, garanciát, felsőfokú állítást, díjat/oklevelet, egészségügyi, kozmetikai vagy műszaki ígéretet, újdonságot, termék- vagy szolgáltatásnevet csak a márkaprofilból, a kampánybriefből vagy a jóváhagyott állításokból vegyél át. A márkanév önmagában nem bizonyítja a kínálatot. Hiányzó kemény adat helyett írj [helykitöltőt]. A vállalkozáshoz illő hangulati jelzők használhatók, de kerüljenek az ellenőrizendő listába, ha a megadott profil nem erősíti meg őket.\n${needsOfferDetails({ businessType: input.businessContext.businessType, industry: input.businessContext.industry, products: input.businessContext.products, services: input.businessContext.services }, input.campaign.offer + " " + input.campaign.description) ? "Kevés konkrét kínálati adat áll rendelkezésre. Ne töltsd ki a hiányt általános marketingszöveggel, ne találj ki terméket vagy szolgáltatást, és minden szükséges hiányzó adatot helykitöltővel jelölj. A tulajdonosnak külön kérdésként ezt add meg: Mit kínálsz? Egy mondatban. Ne tedd a kérdést a posztok szövegébe." : ""}`,
        },
        {
          role: "user",
          content: JSON.stringify({
            markaprofil: JSON.parse(businessContextPrompt(input.businessContext)),
            kampany: input.campaign,
            most_tervezendo_het: input.week,
            kivalasztott_csatornak: allowed,
            helyi_unnepek_es_esemenyek: input.localEvents,
            szezon: seasonForDate(input.week.startDate) ?? null,
            eddig_tervezett_temak: input.plannedTopics,
            csatornankenti_eddigi_posztok: input.channelCounts,
            kert_posztok: `${minimum}–${maximum}`,
            followUpQuestionForOwner: needsOfferDetails(
              { businessType: input.businessContext.businessType, industry: input.businessContext.industry, products: input.businessContext.products, services: input.businessContext.services },
              input.campaign.offer + " " + input.campaign.description,
            ) ? "Mit kínálsz? Egy mondatban." : "",
          }),
        },
      ],
      schemaName: "weekly_campaign_plan",
      brandId: input.businessContext.brandId,
      schema,
      maxTokens: 4000,
      model: input.model,
      deadlineAt: input.deadlineAt,
    },
    validate,
    send,
    async (value, response) => {
      const hasSoftFindings = value.posztok.some(
        (post) => contentSoftClaimWarnings(post.vazlat, facts, claimContext).length > 0,
      );
      if (hasSoftFindings) await annotateAiResponse(response, "SOFT_CLAIM_ADJECTIVE");
    },
  );
  for (const post of result.posztok)
    post.ellenorizendo = [
      ...new Set([
        ...post.ellenorizendo,
        ...contentSoftClaimWarnings(post.vazlat, facts, claimContext),
        ...contentPlaceholders(post.vazlat),
      ]),
    ];
  return result;
}
