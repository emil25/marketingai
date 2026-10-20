import { z } from "zod";
import type { BusinessContext } from "../business-types";
import { businessContextPrompt } from "../business-types";
import {
  FACTUAL_CONTENT_RULES,
  contentRuleFindings,
  contentSoftClaimWarnings,
  contentPlaceholders,
  needsOfferDetails,
} from "../content-quality";
import { requestAiJson } from "./ai-json.server";
import { annotateAiResponse } from "./ai-calls.server";
import { marketWritingRules } from "@/i18n/prompts/hu-RO";

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
    requireChannelTags?: boolean;
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
  const claimContext = {
    businessType: input.businessContext.businessType,
    approvedClaims: input.businessContext.approvedClaims,
  };
  const followUpQuestion = needsOfferDetails(
    {
      businessType: input.businessContext.businessType,
      industry: input.businessContext.industry,
      products: input.businessContext.products,
      services: input.businessContext.services,
    },
    input.brief,
  )
    ? "Mit kínálsz? Egy mondatban."
    : "";
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
    localEvents: input.businessContext.localEvents,
    brief: input.brief,
    campaign: input.campaignContext,
  });
  const validate = resultSchema.superRefine((value, ctx) => {
    for (const variant of value.variants) {
      if (input.requireChannelTags && variant.platform === "facebook" &&
          (variant.hashtags.length < 1 || variant.hashtags.length > 2))
        ctx.addIssue({ code: "custom", message: "Facebookra 1–2 releváns hashtag szükséges a külön tömbben." });
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
      for (const finding of contentRuleFindings(
        variant.content,
        variant.platform,
        facts,
        variant.hashtags,
        input.businessContext.language,
        claimContext,
      ))
        if (finding.severity === "hard")
          ctx.addIssue({
            code: "custom",
            message: `${variant.platform}: ${finding.message}`,
            params: { category: finding.category },
          });
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
          content: `${marketWritingRules(input.businessContext.language)}\n${FACTUAL_CONTENT_RULES}\nTartalmi ellenőrzés: árat, kedvezményt, dátumot, időpontot, címet, telefonszámot, nyitvatartást, díjat, garanciát, felsőfokú állítást, díjat/oklevelet, egészségügyi, kozmetikai vagy műszaki ígéretet, újdonságot, termék- vagy szolgáltatásnevet csak akkor állíts, ha szerepel a márkaprofilban, a felhasználó ötletében vagy a jóváhagyott állítások között. A vállalkozás nevét ne használd bizonyítékként arra, hogy mit kínál. Hiányzó kemény tényt jelöld helykitöltővel; hangulati jelzőt csak ellenőrizendő megjegyzéssel használj.\n${followUpQuestion ? `Kevés konkrét adat áll rendelkezésre. Ne töltsd ki a hiányt általános marketingmondatokkal, és ne következtess a márkanévből. Készíts rövid, 1–3 mondatos szöveget kizárólag a megadott tényekből. Ha konkrét kínálat kellene hozzá, használj [termék vagy szolgáltatás] helykitöltőt. A felhasználónak külön tedd fel ezt a kérdést: „${followUpQuestion}” A kérdés ne kerüljön a közzétehető posztba.` : ""}\nHasználd a strukturált márkakontextust. A content mezőben legyen a végső CTA vagy Facebooknál a lezáró kérdés, a külön cta mező ugyanaz a mondat legyen. A hashtags csak a külön tömbben szerepeljen, Instagramnál kötelező 4–6 valódi #hashtag, nem hagyható el. Egy briefből minden kiválasztott platformra önálló, optimalizált, szerkeszthető posztot adj. A hiányzó cél/közönség irányát a briefből állapítsd meg, üzleti tényt ne következtess.\n${businessContextPrompt(input.businessContext)}`,
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
            followUpQuestionForOwner: followUpQuestion,
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
      brandId: input.businessContext.brandId,
      schema,
      maxTokens: Math.min(7000, 1200 * selected.length + 500),
      model: input.model,
    },
    validate,
    send,
    async (value, response) => {
      const hasSoftFindings = value.variants.some(
        (variant) => contentSoftClaimWarnings(variant.content, facts, claimContext).length > 0,
      );
      if (hasSoftFindings) await annotateAiResponse(response, "SOFT_CLAIM_ADJECTIVE");
    },
  );
  for (const variant of result.variants) {
    const softWarnings = contentSoftClaimWarnings(variant.content, facts, claimContext);
    variant.ellenorizendo = [
      ...new Set([
        ...variant.ellenorizendo,
        ...softWarnings,
        ...contentPlaceholders(variant.content, variant.cta, ...variant.hashtags),
      ]),
    ];
  }
  return result;
}
