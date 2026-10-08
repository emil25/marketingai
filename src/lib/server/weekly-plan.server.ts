import { z } from "zod";
import type { BusinessContext } from "../business-types";
import { businessContextPrompt } from "../business-types";
import {
  FACTUAL_CONTENT_RULES,
  contentPlaceholders,
  contentRuleViolations,
} from "../content-quality";
import { requestAiJson } from "./ai-json.server";

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

export const WEEK_PLAN_PROMPT = `Tapasztalt, magyar kisvállalkozások mellett dolgozó közösségimédia-szakember vagy. Egy hétnyi poszttervet készítesz.
${FACTUAL_CONTENT_RULES}
Ne ismételd az eddig tervezett témákat és ne parafrazáld őket. Egy témakör legfeljebb egyszer szerepelhet egy héten. Teljes héten legalább három különböző poszttípust használj, hetente 3–4 posztot tervezz, ne naponta. A rövid, maradék hétre arányosan kevesebb posztot adj.
A kampány íve: ismertség 1–10. nap, bizalom/közösség 11–20. nap, cselekvés/ajánlat 21–30. nap. A dátumok szerinti szakaszhoz igazítsd a témákat; 7 napos kampánynál a három szakasz egy héten belül jelenjen meg. Minden posztban pontosan egy konkrét CTA legyen. Kérdés-posztnál például az Írd meg kommentben! az egyetlen CTA, ilyenkor ne írj mellé Látogass el hozzánk! felhívást.
Igazítsd a napokat/időpontokat a vállalkozás típusához. Ezek javaslatok, nem mért adatok. Ne váltogasd gépiesen a csatornákat. A kevésbé használt kiválasztott csatornákra is tervezz a hónapban.
Csak a bemenetben kapott helyi ünnepeket/eseményeket használd; ha üres a lista, ne találj ki eseményt. Adj formátumot és egy mondatos fotó/videóötletet. A vazlat kész posztszöveg, CTA-val és a csatorna szerinti hashtagekkel. Az ellenorizendo külön mező minden helykitöltőhöz és megerősítendő állításhoz. Csak érvényes JSON, magyarázat és kódblokk nélkül.`;

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
    const facts = JSON.stringify({
      products: input.businessContext.products,
      services: input.businessContext.services,
      offers: input.businessContext.offers,
      address: input.businessContext.address,
      openingHours: input.businessContext.openingHours,
      offer: input.campaign.offer,
      brief: input.campaign.description,
    });
    for (const post of value.posztok)
      for (const message of contentRuleViolations(
        post.vazlat,
        post.csatorna,
        facts,
        undefined,
        input.businessContext.language,
      ))
        invalid(`${post.datum} / ${post.tema}: ${message}`);
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
        { role: "system", content: WEEK_PLAN_PROMPT },
        {
          role: "user",
          content: JSON.stringify({
            markaprofil: JSON.parse(businessContextPrompt(input.businessContext)),
            kampany: input.campaign,
            most_tervezendo_het: input.week,
            kivalasztott_csatornak: allowed,
            helyi_unnepek_es_esemenyek: input.localEvents,
            eddig_tervezett_temak: input.plannedTopics,
            csatornankenti_eddigi_posztok: input.channelCounts,
            kert_posztok: `${minimum}–${maximum}`,
          }),
        },
      ],
      schemaName: "weekly_campaign_plan",
      schema,
      maxTokens: 4000,
      model: input.model,
      deadlineAt: input.deadlineAt,
    },
    validate,
    send,
  );
  for (const post of result.posztok)
    post.ellenorizendo = [...new Set([...post.ellenorizendo, ...contentPlaceholders(post.vazlat)])];
  return result;
}
