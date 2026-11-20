import { z } from "zod";
import type { BusinessContext } from "../business-types";
import {
  contentClaimFindings,
  contentPlaceholders,
  contentRuleFindings,
  contentSoftClaimWarnings,
  FACTUAL_CONTENT_RULES,
} from "../content-quality";
import { marketWritingRules } from "@/i18n/prompts/hu-RO";
import { businessContextPrompt } from "../business-types";
import { requestAiJson } from "./ai-json.server";
import { annotateAiResponse } from "./ai-calls.server";

export const fivePostRoles = [
  "figyelemfelkeltés",
  "tanítás",
  "értékbemutatás",
  "gyakori kérdés",
  "cselekvésre ösztönzés",
] as const;

const platformSchema = z.enum(["facebook", "instagram"]);
const responseSchema = z.object({
  posts: z.array(z.object({
    role: z.enum(fivePostRoles),
    title: z.string().trim().min(2).max(100),
    content: z.string().trim().min(2).max(1500),
    cta: z.string().trim().min(2).max(300),
    hashtags: z.array(z.string().trim().max(48)).max(6),
    ellenorizendo: z.array(z.string().trim().max(300)).max(12).default([]),
    graphic: z.object({
      headline: z.string().trim().min(1).max(90),
      body: z.string().trim().max(180),
      cta: z.string().trim().max(60),
    }),
  })).length(5),
});

const jsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["posts"],
  properties: {
    posts: {
      type: "array",
      minItems: 5,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["role", "title", "content", "cta", "hashtags", "ellenorizendo", "graphic"],
        properties: {
          role: { type: "string", enum: fivePostRoles },
          title: { type: "string" },
          content: { type: "string" },
          cta: { type: "string" },
          hashtags: { type: "array", items: { type: "string" }, maxItems: 6 },
          ellenorizendo: { type: "array", items: { type: "string" }, maxItems: 12 },
          graphic: {
            type: "object",
            additionalProperties: false,
            required: ["headline", "body", "cta"],
            properties: {
              headline: { type: "string" },
              body: { type: "string" },
              cta: { type: "string" },
            },
          },
        },
      },
    },
  },
} as const;

export async function generateFivePostSeries(
  input: {
    businessContext: BusinessContext;
    topic: string;
    platform: z.infer<typeof platformSchema>;
  },
  send?: Parameters<typeof requestAiJson>[2],
) {
  const facts = JSON.stringify({ business: input.businessContext, userTopic: input.topic });
  const claimContext = {
    businessType: input.businessContext.businessType,
    approvedClaims: input.businessContext.approvedClaims,
  };
  const validate = responseSchema.superRefine((result, ctx) => {
    if (result.posts.some((post, index) => post.role !== fivePostRoles[index]))
      ctx.addIssue({ code: "custom", message: "Az öt poszt pontosan a kért sorrendben, öt különböző feladattal készüljön." });
    const openings = result.posts.map((post) => post.content.split(/[\n.!?]/u)[0].trim().toLocaleLowerCase("hu"));
    if (new Set(openings).size !== result.posts.length)
      ctx.addIssue({ code: "custom", message: "Mind az öt posztnak különböző nyitása legyen." });

    for (const post of result.posts) {
      if (!post.content.trim().endsWith(post.cta.trim()))
        ctx.addIssue({ code: "custom", message: `${post.role}: a felhívás vagy kérdés legyen a poszt utolsó mondata.` });
      const hashtagPattern = /^#[\p{L}\p{N}_]+$/u;
      if (post.hashtags.some((tag) => !hashtagPattern.test(tag)))
        ctx.addIssue({ code: "custom", message: `${post.role}: minden hashtag külön, # jellel kezdődő címke legyen.` });
      const requiredCount = input.platform === "instagram" ? [4, 6] : [1, 2];
      if (post.hashtags.length < requiredCount[0] || post.hashtags.length > requiredCount[1])
        ctx.addIssue({ code: "custom", message: `${post.role}: ${input.platform === "instagram" ? "Instagramra 4–6" : "Facebookra 1–2"} releváns hashtag szükséges.` });
      for (const finding of contentRuleFindings(
        post.content,
        input.platform,
        facts,
        post.hashtags,
        input.businessContext.language,
        claimContext,
      )) {
        if (finding.severity === "hard")
          ctx.addIssue({ code: "custom", message: `${post.role}: ${finding.message}`, params: { category: finding.category } });
      }
      const graphicText = `${post.graphic.headline}\n${post.graphic.body}\n${post.graphic.cta}`;
      for (const finding of contentClaimFindings(
        graphicText,
        facts,
        claimContext,
      )) {
        if (finding.severity === "hard")
          ctx.addIssue({ code: "custom", message: `${post.role} grafika: ${finding.message}`, params: { category: finding.category } });
      }
    }
  });

  const result = await requestAiJson(
    {
      brandId: input.businessContext.brandId,
      schemaName: "five_post_series",
      schema: jsonSchema,
      maxTokens: 6000,
      messages: [
        {
          role: "system",
          content: `${marketWritingRules(input.businessContext.language)}\n${FACTUAL_CONTENT_RULES}\nKizárólag a kapott márkaprofil és a felhasználó témája alapján írj. Ne találj ki terméket, szolgáltatást, árat, kedvezményt, helyet, időpontot, tapasztalatot, vásárlói véleményt, eredményt vagy népszerűséget. A márkanévből ne következtess kínálatra. Ha hiányzik egy szükséges konkrétum, használj rövid [helykitöltőt], és sorold fel az ellenőrizendő mezőben. Hangulatot vagy terméktulajdonságot se találgass. Kerüld az aktivitásvadászatot. A grafikára kerülő headline/body/cta csak a posztszövegben is szereplő információt rövidítheti, új tényt nem adhat hozzá. A grafikák rövid szövegeit mobilon is olvashatóra írd.\n${businessContextPrompt(input.businessContext)}`,
        },
        {
          role: "user",
          content: JSON.stringify({
            feladat: "Készíts pontosan öt különálló, kész közösségi posztot és mindegyikhez egy szerkeszthető grafika szövegvázlatát ugyanahhoz a témához. Legyenek különböző nyitásaik, feladataik és vizuális címük. A szerepek sorrendje: figyelemfelkeltés, tanítás, értékbemutatás, gyakori kérdés, cselekvésre ösztönzés. A gyakori kérdésre csak akkor adj konkrét választ, ha a bemenetben szerepel; különben használj [válasz] helykitöltőt. Minden poszt végén legyen egyetlen, a témához illő felhívás vagy könnyen megválaszolható kérdés. A grafika headline/body/cta rövid, a poszt tényeivel egyező kivonat legyen.",
            tema: input.topic,
            csatorna: input.platform,
            szerepek: fivePostRoles,
            csatornaszabalyok: input.platform === "instagram"
              ? "Rövid nyitás, tömör bekezdések, legfeljebb 3 emoji, 4–6 releváns hashtag."
              : "Beszélgetős megfogalmazás, rövid bekezdések, 1–2 releváns hashtag.",
          }),
        },
      ],
    },
    validate,
    send,
    async (value, response) => {
      if (value.posts.some((post) =>
        contentSoftClaimWarnings(
          `${post.content}\n${post.graphic.headline}\n${post.graphic.body}\n${post.graphic.cta}`,
          facts,
          claimContext,
        ).length > 0,
      )) await annotateAiResponse(response, "SOFT_CLAIM_ADJECTIVE");
    },
  );

  return {
    posts: result.posts.map((post) => {
      const reviewText = `${post.content}\n${post.graphic.headline}\n${post.graphic.body}\n${post.graphic.cta}`;
      const warnings = contentSoftClaimWarnings(reviewText, facts, claimContext);
      return {
        ...post,
        ellenorizendo: [...new Set([
          ...post.ellenorizendo,
          ...warnings,
          ...contentPlaceholders(reviewText, post.cta, ...post.hashtags),
        ])],
      };
    }),
  };
}
