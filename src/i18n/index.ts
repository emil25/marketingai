import { brandForLocale, DEFAULT_MARKET_LOCALE, type MarketLocale } from "@/config/brand";
import { huRO } from "./hu-RO";

export const UI_RESOURCES = { "hu-RO": huRO } as const;
type BrandResourceKey = "brand.name" | "brand.slogan" | "brand.description";
export type UiResourceKey = keyof typeof huRO | BrandResourceKey;

export function localeForLanguage(language: string | null | undefined): MarketLocale {
  const value = (language ?? "").trim().toLocaleLowerCase("hu-RO");
  if (/^(ro|ro-ro|română|romana|romanian)(?:$|[-_ ])/iu.test(value) || value === "română")
    return "ro-RO";
  return DEFAULT_MARKET_LOCALE;
}

export function translate(
  key: UiResourceKey,
  locale: MarketLocale = DEFAULT_MARKET_LOCALE,
): string {
  const brand = brandForLocale(locale);
  if (key === "brand.name") return brand.productName;
  if (key === "brand.slogan") return brand.shortSlogan;
  if (key === "brand.description") return brand.description;
  const resource = UI_RESOURCES[locale as keyof typeof UI_RESOURCES] ?? huRO;
  return (
    (resource as Record<keyof typeof huRO, string>)[key as keyof typeof huRO] ??
    huRO[key as keyof typeof huRO]
  );
}

export function brandForLanguage(language?: string | null) {
  return brandForLocale(localeForLanguage(language));
}

export type { MarketLocale };
