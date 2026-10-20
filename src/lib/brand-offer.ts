import { normalizeBusinessType } from "./business-types";
import type { BrandProfileRecord, BrandRecord } from "./data-model";

/** Apply an owner's missing-offer answer without overwriting profile data. */
export function applyBrandOfferAnswer(
  brand: BrandRecord,
  profile: BrandProfileRecord,
  answer: string,
  updatedAt: string,
) {
  const value = answer.trim();
  if (value.length < 5 || value.length > 1000)
    throw new Error("Írj legalább 5 karaktert arról, mit kínálsz.");
  const isOther = normalizeBusinessType(profile.businessType) === "other";
  const missingIndustry = isOther && !brand.industry.trim();
  const missingOffer = !brand.products.trim() && !brand.services.trim();
  if (!missingIndustry && !missingOffer)
    throw new Error("Ezek az adatok időközben már meg lettek adva. Frissítsd az oldalt.");

  if (missingOffer) brand.services = value;
  if (missingIndustry)
    brand.industry = value.slice(0, 500);
  const existingDescription = profile.description.trim();
  const offerLine = `Fő kínálat: ${value}`;
  if (!existingDescription.includes(offerLine))
    profile.description = [existingDescription, offerLine].filter(Boolean).join("\n").slice(0, 8000);
  brand.updatedAt = updatedAt;
  profile.updatedAt = updatedAt;
}
