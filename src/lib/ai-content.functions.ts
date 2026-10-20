import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireBrandContext } from "@/lib/server/auth-context.server";
import { completeAiJob, createAiJob, startAiJob, transact } from "@/lib/server/store.server";
import { requestAiJson } from "@/lib/server/ai-json.server";
import { FACTUAL_CONTENT_RULES } from "@/lib/content-quality";
import { buildBusinessContext, businessContextPrompt } from "@/lib/business-types";
import { marketWritingRules } from "@/i18n/prompts/hu-RO";

const InputSchema = z.object({
  type: z.enum(["facebook", "instagram", "tiktok", "google", "blog", "newsletter"]),
  topic: z.string().trim().min(2).max(400),
  modifiers: z.array(z.string().max(40)).max(8).default([]),
  language: z.string().max(120).optional(),
  campaignContext: z.string().max(2000).optional(),
});
const RESULT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "blocks"],
  properties: {
    title: { type: "string" },
    blocks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "body"],
        properties: { label: { type: "string" }, body: { type: "string" } },
      },
    },
  },
} as const;
const BRIEFS: Record<string, string> = {
  facebook:
    "Készíts 4 Facebook poszt variánst: 'Rövid verzió', 'Közepes verzió', 'Emoji verzió', 'CTA verzió'. Mindegyik önálló, közzétehető poszt hashtagekkel.",
  instagram:
    "Készíts 4 Instagram blokkot: 'Feed poszt', 'Story szöveg', 'Carousel diák', 'Reels felirat'. Hashtagekkel.",
  tiktok:
    "Készíts 4 blokkot: 'Hook', 'Forgatókönyv' (számozott jelenetek), 'Felirat szöveg', 'Hangötletek és hashtagek'.",
  google:
    "Készíts 3 Google Cégprofil bejegyzést: 'Ajánlat', 'Újdonság', 'Esemény'. Rövid, CTA-val.",
  blog: "Készíts 5 blokkot: 'SEO cím', 'Meta leírás' (max 155 karakter), 'Fő kulcsszó', 'Vázlat' (H2 pontok), 'GYIK' (4 kérdés-válasz).",
  newsletter:
    "Készíts 4 blokkot: 'Tárgy', 'Előfejléc', 'Email szöveg' (teljes), 'CTA gomb szövege'.",
};
export type GeneratedContent = { title: string; blocks: { label: string; body: string }[] };

export const generateContent = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }): Promise<GeneratedContent> => {
    const context = await requireBrandContext();
    const brand = context.activeBrand;
    if (!brand) throw new Error("Még nincs aktív márka ebben a munkatérben.");
    const voice = brand.profile;
    const businessContext = buildBusinessContext(brand, voice, {
      language: data.language ?? brand.languageMarket,
      platform: data.type,
      audience: brand.audience,
      region: brand.cityRegion,
    });
    const job = await transact((database) =>
      createAiJob(database, {
        workspaceId: context.workspace.id,
        brandId: brand.id,
        type: "content",
        input: { ...data, businessContext },
      }),
    );
    await transact((database) => startAiJob(database, job.id));
    try {
      const system = `A vállalkozás beállításában megadott nyelven írj. ${marketWritingRules(businessContext.language)}\n${FACTUAL_CONTENT_RULES}\nAz alábbi strukturált üzleti kontextust használd minden döntéshez:\n${businessContextPrompt(businessContext)}\nMárkaleírás: ${voice.description}. Guardrail: ${voice.aiGuardrails}. Csak a megadott JSON sémát töltsd ki.`;
      const user = `${BRIEFS[data.type]}\n\nTéma: ${data.topic}${data.modifiers.length ? `\nStílus kérések: ${data.modifiers.join(", ")}` : ""}${data.campaignContext ? `\nKampánykontextus: ${data.campaignContext}` : ""}`;
      const parsed = await requestAiJson(
        {
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          schemaName: "marketing_content",
          schema: RESULT_SCHEMA,
        },
        z.object({
          title: z.string().trim().min(1).max(500),
          blocks: z
            .array(
              z.object({
                label: z.string().trim().min(1).max(500),
                body: z.string().trim().min(1).max(30000),
              }),
            )
            .min(1)
            .max(10),
        }),
      );
      await transact((database) => completeAiJob(database, job.id));
      return parsed;
    } catch (cause) {
      await transact((database) =>
        completeAiJob(database, job.id, cause instanceof Error ? cause.message : "AI hiba"),
      );
      throw cause;
    }
  });
