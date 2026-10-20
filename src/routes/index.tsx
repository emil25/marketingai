import { createFileRoute } from "@tanstack/react-router";
import { LandingPage } from "@/components/landing-page";
import { getAuthConfiguration } from "@/lib/account.functions";
import { getPublicOperator } from "@/lib/public-site.functions";
import { brandForLanguage, translate } from "@/i18n";

const brand = brandForLanguage("magyar");
const SITE_URL = brand.defaultOrigin;
export const Route = createFileRoute("/")({
  loader: async () => {
    const [configuration, operator] = await Promise.all([
      getAuthConfiguration(),
      getPublicOperator(),
    ]);
    return {
      ...configuration,
      contactAvailable: Boolean(operator.email),
      siteUrl: operator.origin,
    };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${brand.productName} — ${translate("landing.metaTagline")}` },
      {
        name: "description",
        content: translate("landing.metaDescription"),
      },
      {
        property: "og:title",
        content: `${brand.productName} — ${translate("landing.metaTagline")}`,
      },
      {
        property: "og:description",
        content: translate("landing.socialDescription"),
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: loaderData?.siteUrl || SITE_URL },
      {
        property: "og:image",
        content: `${loaderData?.siteUrl || SITE_URL}${brand.logos.socialShare}`,
      },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      {
        property: "og:image:alt",
        content: `${brand.productName}: ${brand.shortSlogan}`,
      },
      { name: "twitter:card", content: "summary_large_image" },
      {
        name: "twitter:image",
        content: `${loaderData?.siteUrl || SITE_URL}${brand.logos.socialShare}`,
      },
    ],
    links: [{ rel: "canonical", href: loaderData?.siteUrl || SITE_URL }],
  }),
  component: PublicLanding,
});

function PublicLanding() {
  const configuration = Route.useLoaderData();
  return (
    <LandingPage
      privateBeta={configuration.privateBeta}
      contactAvailable={configuration.contactAvailable}
    />
  );
}
