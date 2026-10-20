import type { BrandProfileRecord, BrandRecord } from "@/lib/data-model";
import { buildBusinessContext } from "@/lib/business-types";
import { imagePromptRules } from "@/i18n/prompts/hu-RO";

/** Builds a localized image prompt from user-provided details only. */
export function buildMarketImagePrompt(
  prompt: string,
  brand: BrandRecord,
  profile: BrandProfileRecord,
  format?: string,
) {
  const context = buildBusinessContext(brand, profile);
  const visualContext = {
    brandName: context.brandName,
    businessType: context.businessTypeLabel,
    industry: context.industry,
    language: context.language,
    region: context.region,
    products: context.products,
    services: context.services,
    offer: context.offers,
    audience: context.audience,
    preferredLocalPhrases: context.localPhrases,
    colors: profile.colors,
  };
  return [
    imagePromptRules(context.language),
    `Felhasználói képleírás: ${prompt.trim()}`,
    format ? `Képarány vagy elrendezés: ${format}` : "",
    `Márkakörnyezet (csak megadott adatok): ${JSON.stringify(visualContext)}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}
