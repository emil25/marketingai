/** Public brand identity only. Provider credentials and other secrets never belong here. */
export type MarketLocale = "hu-RO" | "ro-RO";

export type LocalizedBrand = {
  productName: string;
  shortSlogan: string;
  description: string;
  defaultOrigin: string;
  contact: {
    nameEnv: string;
    nameFallbackEnv: string;
    addressEnv: string;
    addressFallbackEnv: string;
    emailEnv: string;
    emailFallbackEnv: string;
    aboutEnv: string;
  };
  logos: {
    light: string;
    dark: string;
    icon: string;
    favicon: string;
    socialShare: string;
  };
  colors: { coral: string; forest: string; cream: string };
};

export const BRAND_CONFIG: Readonly<Record<MarketLocale, LocalizedBrand | undefined>> = {
  "hu-RO": {
    productName: "MarketingPilot",
    shortSlogan: "Posztok egyszerűen, a te hangodon.",
    description:
      "Erdélyi kisvállalkozóknak segít posztot és heti tervet készíteni a saját vállalkozásuk adataiból.",
    defaultOrigin: "https://marketingai-self.vercel.app",
    contact: {
      nameEnv: "OPERATOR_NAME",
      nameFallbackEnv: "PUBLIC_OPERATOR_NAME",
      addressEnv: "OPERATOR_ADDRESS",
      addressFallbackEnv: "PUBLIC_OPERATOR_ADDRESS",
      emailEnv: "OPERATOR_EMAIL",
      emailFallbackEnv: "PUBLIC_CONTACT_EMAIL",
      aboutEnv: "PUBLIC_OPERATOR_ABOUT",
    },
    logos: {
      light: "/images/brand/logo-light.svg",
      dark: "/images/brand/logo-dark.svg",
      icon: "/images/brand/icon.svg",
      favicon: "/favicon.ico",
      socialShare: "/images/marketingpilot-share.png",
    },
    colors: { coral: "#f36b52", forest: "#102f25", cream: "#f7f4ee" },
  },
  // Add this market's brand copy and prompt resources when Romanian is localized.
  "ro-RO": undefined,
};

export const DEFAULT_MARKET_LOCALE: MarketLocale = "hu-RO";

export function brandForLocale(locale: MarketLocale = DEFAULT_MARKET_LOCALE): LocalizedBrand {
  return BRAND_CONFIG[locale] ?? BRAND_CONFIG[DEFAULT_MARKET_LOCALE]!;
}

/** Use a valid deployment origin when configured; otherwise use the canonical public origin. */
export function publicAppUrl(
  env: Record<string, string | undefined> = typeof process === "undefined" ? {} : process.env,
): string {
  const configured = env.PUBLIC_APP_URL?.trim();
  if (configured) {
    try {
      const value = new URL(configured);
      if (["https:", "http:"].includes(value.protocol)) return value.origin;
    } catch {
      // An invalid override must not leak into canonical links.
    }
  }
  return brandForLocale().defaultOrigin;
}
