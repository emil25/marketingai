import { z } from "zod";
import type { BusinessContext } from "../business-types";
import { businessContextPrompt } from "../business-types";
import {
  contentClaimFindings,
  contentPlaceholders,
  contentRuleFindings,
  contentSoftClaimWarnings,
  FACTUAL_CONTENT_RULES,
} from "../content-quality";
import { marketWritingRules } from "@/i18n/prompts/hu-RO";
import { requestAiJson } from "./ai-json.server";
import { annotateAiResponse } from "./ai-calls.server";
import { replaceOpeningLine } from "../post-quick-actions";

export const QUICK_ACTION_RULES = `Csak a megadott tényekből dolgozz. Személyes történetet, vendégvéleményt, számot, eredményt vagy esettanulmányt csak akkor használj, ha a profil vagy a bemeneti szöveg tartalmazza; különben hagyd ki, vagy használj rövid szögletes helykitöltőt. Tartsd meg a márkaprofil megszólítását, hangnemét és nyelvét. Természetes, köznyelvi magyar nyelvet használj erdélyi környezetben; kerüld a töltelékszavakat és a kattintásvadászatot. A nyitás lehet kíváncsiságot keltő, de nem lehet félrevezető. Tilos aktivitásvadász felszólítást írni, például „kommentelj IGEN-t”, „oszd meg, ha…” vagy „címkézd meg”. Ne adj hozzá új állítást. A szöveg a meglévő, kemény és puha tényellenőrzésen is átmegy.`;

const approaches = ["kérdés", "konkrét kép", "hasznos tipp", "szezon", "érzés"] as const;
const similarAngles = ["kérdés", "hasznos tipp", "kulissza"] as const;

export const OpeningOptionsSchema = z.object({
  options: z
    .array(
      z.object({
        megkozelites: z.enum(approaches),
        text: z.string().trim().min(2).max(240),
      }),
    )
    .length(5),
});

export const QuestionClosingsSchema = z.object({
  questions: z.array(z.string().trim().min(3).max(240)).length(4),
});

export const ImprovedCopySchema = z.object({
  content: z.string().trim().min(2).max(12000),
  cta: z.string().trim().max(1000),
  hashtags: z.array(z.string().trim().max(80)).max(6),
  reasons: z
    .array(
      z.object({
        change: z.enum(["Erősebb nyitás", "Rövidebb mondatok", "Egyértelmű felhívás"]),
        reason: z.string().trim().min(2).max(160),
      }),
    )
    .max(3),
});

export const SimilarPostsSchema = z.object({
  posts: z
    .array(
      z.object({
        megkozelites: z.enum(similarAngles),
        title: z.string().trim().min(2).max(120),
        content: z.string().trim().min(2).max(12000),
        cta: z.string().trim().max(1000),
        hashtags: z.array(z.string().trim().max(80)).max(6),
        ellenorizendo: z.array(z.string().trim().max(300)).max(12).default([]),
      }),
    )
    .length(3),
});

export const IdeaBankSchema = z.object({
  ideas: z.array(z.string().trim().min(5).max(180)).length(20),
});

const OPENING_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["options"],
  properties: {
    options: {
      type: "array",
      minItems: 5,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["megkozelites", "text"],
        properties: {
          megkozelites: { type: "string", enum: approaches },
          text: { type: "string" },
        },
      },
    },
  },
} as const;
const CLOSING_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["questions"],
  properties: { questions: { type: "array", minItems: 4, maxItems: 4, items: { type: "string" } } },
} as const;
const IMPROVE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["content", "cta", "hashtags", "reasons"],
  properties: {
    content: { type: "string" },
    cta: { type: "string" },
    hashtags: { type: "array", items: { type: "string" }, maxItems: 6 },
    reasons: {
      type: "array",
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["change", "reason"],
        properties: {
          change: { type: "string", enum: ["Erősebb nyitás", "Rövidebb mondatok", "Egyértelmű felhívás"] },
          reason: { type: "string" },
        },
      },
    },
  },
} as const;
const SIMILAR_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["posts"],
  properties: {
    posts: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["megkozelites", "title", "content", "cta", "hashtags", "ellenorizendo"],
        properties: {
          megkozelites: { type: "string", enum: similarAngles },
          title: { type: "string" },
          content: { type: "string" },
          cta: { type: "string" },
          hashtags: { type: "array", items: { type: "string" }, maxItems: 6 },
          ellenorizendo: { type: "array", items: { type: "string" }, maxItems: 12 },
        },
      },
    },
  },
} as const;
const IDEAS_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["ideas"],
  properties: { ideas: { type: "array", minItems: 20, maxItems: 20, items: { type: "string" } } },
} as const;

type QuickContext = {
  businessContext: BusinessContext;
  platform: string;
  sourceText: string;
};

function systemPrompt(input: QuickContext) {
  return `${marketWritingRules(input.businessContext.language)}\n${FACTUAL_CONTENT_RULES}\n${QUICK_ACTION_RULES}\n${businessContextPrompt(input.businessContext)}`;
}

function facts(input: QuickContext) {
  return JSON.stringify({ business: input.businessContext, suppliedText: input.sourceText });
}

function claimContext(input: QuickContext) {
  return {
    businessType: input.businessContext.businessType,
    approvedClaims: input.businessContext.approvedClaims,
  };
}

function addContentChecks(
  ctx: z.RefinementCtx,
  input: QuickContext,
  text: string,
  hashtags?: string[],
) {
  for (const finding of contentRuleFindings(
    text,
    input.platform,
    facts(input),
    hashtags,
    input.businessContext.language,
    claimContext(input),
  )) {
    if (finding.severity === "hard")
      ctx.addIssue({ code: "custom", message: finding.message, params: { category: finding.category } });
  }
}

async function annotateSoft(
  response: Response,
  input: QuickContext,
  contents: Array<{ text: string; hashtags?: string[] }>,
) {
  const anySoft = contents.some(({ text }) =>
    contentSoftClaimWarnings(text, facts(input), claimContext(input)).length > 0,
  );
  if (anySoft) await annotateAiResponse(response, "SOFT_CLAIM_ADJECTIVE");
}

export async function generateOpeningOptions(
  input: QuickContext,
  send?: Parameters<typeof requestAiJson>[2],
) {
  const validate = OpeningOptionsSchema.superRefine((value, ctx) => {
    if (new Set(value.options.map((item) => item.megkozelites)).size !== 5)
      ctx.addIssue({ code: "custom", message: "Mind az öt különböző nyitómegközelítést add vissza." });
    for (const option of value.options)
      addContentChecks(ctx, input, replaceOpeningLine(input.sourceText, option.text));
  });
  return requestAiJson(
    {
      brandId: input.businessContext.brandId,
      schemaName: "post_opening_options",
      schema: OPENING_JSON_SCHEMA,
      maxTokens: 1000,
      messages: [
        { role: "system", content: systemPrompt(input) },
        {
          role: "user",
          content: JSON.stringify({
            feladat: "Adj öt alternatív első sort öt különböző megközelítéssel. Mindegyik egyetlen rövid mondat legyen. A poszt többi részét ne írd át.",
            forras: input.sourceText,
            megkozelitesek: approaches,
          }),
        },
      ],
    },
    validate,
    send,
    async (value, response) =>
      annotateSoft(
        response,
        input,
        value.options.map((item) => ({ text: replaceOpeningLine(input.sourceText, item.text) })),
      ),
  );
}

export async function generateQuestionClosings(
  input: QuickContext,
  send?: Parameters<typeof requestAiJson>[2],
) {
  const validate = QuestionClosingsSchema.superRefine((value, ctx) => {
    if (value.questions.some((question) => !question.endsWith("?")))
      ctx.addIssue({ code: "custom", message: "Mind a négy lezárás könnyen megválaszolható kérdés legyen." });
    if (new Set(value.questions.map((item) => item.toLocaleLowerCase("hu"))).size !== 4)
      ctx.addIssue({ code: "custom", message: "A négy kérdés legyen eltérő." });
    for (const question of value.questions)
      addContentChecks(ctx, input, `${input.sourceText.trim()}\n\n${question}`);
  });
  return requestAiJson(
    {
      brandId: input.businessContext.brandId,
      schemaName: "post_question_closings",
      schema: CLOSING_JSON_SCHEMA,
      maxTokens: 900,
      messages: [
        { role: "system", content: systemPrompt(input) },
        {
          role: "user",
          content: JSON.stringify({
            feladat: "Adj négy rövid, könnyen megválaszolható lezáró kérdést, amelyek közvetlenül kapcsolódnak a poszthoz. Ne legyen felszólítás vagy kitalált tény.",
            forras: input.sourceText,
          }),
        },
      ],
    },
    validate,
    send,
    async (value, response) =>
      annotateSoft(response, input, value.questions.map((question) => ({ text: `${input.sourceText}\n${question}` }))),
  );
}

export async function improveCopy(
  input: QuickContext,
  send?: Parameters<typeof requestAiJson>[2],
) {
  const validate = ImprovedCopySchema.superRefine((value, ctx) => {
    if (value.cta && !value.content.trim().endsWith(value.cta))
      ctx.addIssue({ code: "custom", message: "A felhívás pontosan a szöveg végén álljon.", params: { category: "CONTENT_CTA_RULE" } });
    addContentChecks(ctx, input, value.content, value.hashtags);
  });
  return requestAiJson(
    {
      brandId: input.businessContext.brandId,
      schemaName: "improve_user_copy",
      schema: IMPROVE_JSON_SCHEMA,
      maxTokens: 1400,
      messages: [
        { role: "system", content: systemPrompt(input) },
        {
          role: "user",
          content: JSON.stringify({
            feladat: "Javítsd a megadott poszt természetességét, nyitását, mondathosszát és egyetlen felhívását. A közlendő üzenet és minden tény maradjon ugyanaz. Ne adj hozzá új terméket, számot, történetet, véleményt vagy eredményt. Adj legfeljebb három rövid indoklást a megengedett címkékkel.",
            eredeti: input.sourceText,
            csatorna: input.platform,
          }),
        },
      ],
    },
    validate,
    send,
    async (value, response) => annotateSoft(response, input, [{ text: value.content, hashtags: value.hashtags }]),
  );
}

export async function generateSimilarPosts(
  input: QuickContext,
  send?: Parameters<typeof requestAiJson>[2],
) {
  const validate = SimilarPostsSchema.superRefine((value, ctx) => {
    if (new Set(value.posts.map((item) => item.megkozelites)).size !== 3)
      ctx.addIssue({ code: "custom", message: "Mindhárom különböző nézőpontot használd." });
    const openings = value.posts.map((item) => item.content.split(/[\n.!?]/u)[0].trim().toLocaleLowerCase("hu"));
    if (new Set(openings).size !== 3)
      ctx.addIssue({ code: "custom", message: "A három poszt nyitása legyen eltérő." });
    for (const post of value.posts) addContentChecks(ctx, input, post.content, post.hashtags);
  });
  return requestAiJson(
    {
      brandId: input.businessContext.brandId,
      schemaName: "similar_posts",
      schema: SIMILAR_JSON_SCHEMA,
      maxTokens: 3000,
      messages: [
        { role: "system", content: systemPrompt(input) },
        {
          role: "user",
          content: JSON.stringify({
            feladat: "Készíts pontosan három új posztot három eltérő nézőpontból: kérdés, hasznos tipp és kulissza. Tartsd meg az eredeti poszt szerkezetét és nagyjából a hosszát, de ne másold a szövegét vagy a nyitását. Csak az eredeti poszt és a márkaprofil tényeit használd.",
            csatorna: input.platform,
            eredeti: input.sourceText,
          }),
        },
      ],
    },
    validate,
    send,
    async (value, response) =>
      annotateSoft(response, input, value.posts.map((item) => ({ text: item.content, hashtags: item.hashtags }))),
  );
}

export async function generateIdeaBank(
  businessContext: BusinessContext,
  send?: Parameters<typeof requestAiJson>[2],
) {
  const context: QuickContext = { businessContext, platform: "topic_idea", sourceText: "" };
  const validate = IdeaBankSchema.superRefine((value, ctx) => {
    const normalized = value.ideas.map((idea) => idea.toLocaleLowerCase("hu").replace(/\s+/g, " ").trim());
    if (new Set(normalized).size !== 20)
      ctx.addIssue({ code: "custom", message: "Mind a húsz témaötlet legyen különböző." });
    for (const idea of value.ideas)
      for (const finding of contentClaimFindings(idea, facts(context), claimContext(context)))
        if (finding.severity === "hard")
          ctx.addIssue({ code: "custom", message: finding.message, params: { category: finding.category } });
  });
  const result = await requestAiJson(
    {
      brandId: businessContext.brandId,
      schemaName: "business_idea_bank",
      schema: IDEAS_JSON_SCHEMA,
      maxTokens: 1800,
      messages: [
        { role: "system", content: systemPrompt(context) },
        {
          role: "user",
          content: JSON.stringify({
            feladat: "Készíts húsz rövid, egymástól eltérő poszttéma-ötletet a vállalkozásnak és a megadott célközönségnek. Ötleteket adj, ne tényállításokat, árakat, kedvezményeket, eseményeket, véleményeket vagy ígéreteket. Szabályozott területen csak általános, ígéret nélküli tájékoztatási témát adj.",
            businessContext: JSON.parse(businessContextPrompt(businessContext)),
          }),
        },
      ],
    },
    validate,
    send,
    async (value, response) =>
      annotateSoft(response, context, value.ideas.map((text) => ({ text }))),
  );
  return { ideas: result.ideas, warnings: result.ideas.flatMap((idea) => contentPlaceholders(idea)) };
}
