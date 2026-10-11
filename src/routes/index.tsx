import { createFileRoute } from "@tanstack/react-router";
import { LandingPage } from "@/components/landing-page";

const SITE_URL = "https://marketingai-self.vercel.app";
export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MarketingPilot — Egy mondatból kész poszt. Percek alatt." },
      {
        name: "description",
        content:
          "Leírod az ötleted, a MarketingPilot megírja a te hangodon, te átnézed és kiteszed. Posztok és heti terv kisvállalkozóknak, díjmentes bétában.",
      },
      { property: "og:title", content: "MarketingPilot — Egy mondatból kész poszt." },
      {
        property: "og:description",
        content:
          "Posztok a te hangodon, heti terv egy kattintással. Bankkártya és Facebook-kapcsolat nélkül is elkezdheted.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: SITE_URL },
      { property: "og:image", content: `${SITE_URL}/images/marketingpilot-share.png` },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      {
        property: "og:image:alt",
        content: "MarketingPilot: Egy mondatból kész poszt. Posztok egyszerűen, a te hangodon.",
      },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: `${SITE_URL}/images/marketingpilot-share.png` },
    ],
    links: [{ rel: "canonical", href: SITE_URL }],
  }),
  component: LandingPage,
});
