import { z } from "zod";
import type { BusinessContext } from "../business-types";
import { businessContextPrompt } from "../business-types";
import {
  FACTUAL_CONTENT_RULES,
  contentPlaceholders,
  contentRuleViolations,
} from "../content-quality";
import { requestAiJson } from "./ai-json.server";

const platforms = [
  "facebook",
  "instagram",
  "tiktok",
  "linkedin",
  "youtube",
  "google-business",
] as const;
const schema = {
  type: "object",
  additionalProperties: false,
  required: ["variants"],
  properties: {
    variants: {
      type: "array",
      minItems: 1,
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["platform", "content", "hashtags", "cta", "ellenorizendo"],
        properties: {
          platform: { type: "string", enum: platforms },
          content: { type: "string" },
          hashtags: { type: "array", items: { type: "string" } },
          cta: { type: "string" },
          ellenorizendo: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
} as const;
const resultSchema = z.object({
  variants: z
    .array(
      z.object({
        platform: z.enum(platforms),
        content: z.string().trim().min(1).max(30000),
        hashtags: z.array(z.string().max(80)).max(40),
        cta: z.string().max(1000),
        ellenorizendo: z.array(z.string().max(500)).max(20),
      }),
    )
    .min(1)
    .max(6),
});

export async function generateFactualPost(
  input: {
    businessContext: BusinessContext;
    brief: string;
    title: string;
    platforms: string[];
    ctaStyle: string;
    campaignContext?: string;
    model?: string;
  },
  send?: Parameters<typeof requestAiJson>[2],
) {
  const selected = [...new Set(input.platforms)];
  const explicitlyMissing =
    /nem adtam meg|nincs megadva|nincs megadott|hiányzik|ezeket még nem/iu.test(input.brief);
  const requiredPlaceholders = explicitlyMissing
    ? [
        !input.businessContext.address && /cím/iu.test(input.brief) ? "[cím]" : "",
        !input.businessContext.openingHours && /nyitvatart/iu.test(input.brief)
          ? "[nyitvatartás]"
          : "",
      ].filter(Boolean)
    : [];
  const validate = resultSchema.superRefine((value, ctx) => {
    const facts = JSON.stringify({
      products: input.businessContext.products,
      services: input.businessContext.services,
      offers: input.businessContext.offers,
      address: input.businessContext.address,
      openingHours: input.businessContext.openingHours,
      brief: input.brief,
      campaign: input.campaignContext,
    });
    for (const variant of value.variants) {
      if (variant.cta.trim() && !variant.content.trim().endsWith(variant.cta.trim()))
        ctx.addIssue({
          code: "custom",
          message: `${variant.platform}: A cta mező pontosan a content utolsó mondata legyen; ne írj külön második felhívást. Facebooknál ez egy lezáró kérdés is lehet.`,
        });
      for (const placeholder of requiredPlaceholders)
        if (!variant.content.includes(placeholder))
          ctx.addIssue({
            code: "custom",
            message: `${variant.platform}: A briefben kért, nem megadott adatot tedd a content mezőbe ezzel a helykitöltővel: ${placeholder}. Ne ígérd, hogy hamarosan elérhető lesz.`,
          });
      for (const message of contentRuleViolations(
        variant.content,
        variant.platform,
        facts,
        variant.hashtags,
        input.businessContext.language,
      ))
        ctx.addIssue({ code: "custom", message: `${variant.platform}: ${message}` });
    }
    if (
      value.variants.length !== selected.length ||
      selected.some((p) => !value.variants.some((v) => v.platform === p))
    )
      ctx.addIssue({
        code: "custom",
        message: "Minden kiválasztott csatornához pontosan egy változat szükséges.",
      });
    const facebook = value.variants.find((variant) => variant.platform === "facebook");
    const instagram = value.variants.find((variant) => variant.platform === "instagram");
    if (facebook && instagram) {
      const normalize = (text: string) =>
        text
          .toLocaleLowerCase("hu")
          .replace(/[^\p{L}\p{N}\s]/gu, "")
          .replace(/\s+/g, " ")
          .trim();
      const opening = (text: string) => normalize(text.split(/[\n.!?]/u)[0]);
      const words = (text: string) =>
        new Set(
          normalize(text.replace(/\[[^\]]+\]/g, "").replace(/#[\p{L}\p{N}_]+/gu, ""))
            .split(" ")
            .filter((word) => word.length > 3),
        );
      const fbWords = words(facebook.content);
      const igWords = words(instagram.content);
      const shared = [...fbWords].filter((word) => igWords.has(word)).length;
      const union = new Set([...fbWords, ...igWords]).size;
      if (
        (opening(facebook.content).length > 25 &&
          opening(facebook.content) === opening(instagram.content)) ||
        (Math.min(fbWords.size, igWords.size) >= 15 && shared / union > 0.8)
      )
        ctx.addIssue({
          code: "custom",
          message:
            "A Facebook és Instagram szöveg túlságosan azonos. Írj külön rövid, erős Instagram-nyitósort és tömör vizuális szöveget; Facebookra beszélgetősebb, eltérő felépítésű posztot. A tények maradjanak azonosak, ne találj ki új terméket.",
        });
    }
  });
  const result = await requestAiJson(
    {
      messages: [
        {
          role: "system",
          content: `${FACTUAL_CONTENT_RULES}\nHasználd a strukturált márkakontextust. A content mezőben legyen a végső CTA vagy Facebooknál a lezáró kérdés, a külön cta mező ugyanaz a mondat legyen. A hashtags csak a külön tömbben szerepeljen, Instagramnál kötelező 4–6 valódi #hashtag, nem hagyható el. Egy briefből minden kiválasztott platformra önálló, optimalizált, szerkeszthető posztot adj. A hiányzó cél/közönség irányát a briefből állapítsd meg, üzleti tényt ne következtess.\n${businessContextPrompt(input.businessContext)}`,
        },
        {
          role: "user",
          content: JSON.stringify({
            brief: input.brief,
            title: input.title,
            platforms: selected,
            ctaStyle: input.ctaStyle,
            campaignContext: input.campaignContext ?? "",
            requiredPlaceholders,
            channelInstructions: selected.map((platform) => ({
              platform,
              writing:
                platform === "facebook"
                  ? "Beszélgetős, végig te megszólítás (kivéve a profil kifejezett eltérő kérését). Ne legyen Sziasztok vagy Nektek. Saját nyitósor és rövid bekezdések; a végén egyetlen konkrét kérdés VAGY felhívás. A cta mező a content utolsó mondata legyen. Legfeljebb 2 hashtag a külön tömbben."
                  : platform === "instagram"
                    ? "Saját, rövid, erős nyitósor. Rövidebb, más felépítésű poszt, mint a Facebook. 1–3 emoji. A végén egy közvetlen CTA, például Mentsd el, ha erre jársz! Ne írd azt, hogy Mentésre ajánljuk. A cta ugyanaz a zárómondat legyen. 4–6 hashtag a külön tömbben."
                    : "A csatornához illeszkedő önálló szöveg.",
            })),
          }),
        },
      ],
      schemaName: "factual_post_variants",
      schema,
      maxTokens: Math.min(7000, 1200 * selected.length + 500),
      model: input.model,
    },
    validate,
    send,
  );
  for (const variant of result.variants)
    variant.ellenorizendo = [
      ...new Set([
        ...variant.ellenorizendo,
        ...contentPlaceholders(variant.content, variant.cta, ...variant.hashtags),
      ]),
    ];
  return result;
}
