import { createFileRoute } from "@tanstack/react-router";
import { LandingPage } from "@/components/landing-page";

const SITE_URL = "https://marketingai-self.vercel.app";
export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MarketingPilot — AI marketing-munkatér kisvállalkozásoknak" },
      {
        name: "description",
        content:
          "Egy rövid ötletből szerkeszthető posztok, saját márkahang és 30 napos tartalomterv. Ismerd meg a MarketingPilot díjmentes bétáját.",
      },
      { property: "og:title", content: "MarketingPilot — A márkád. Egy helyen." },
      {
        property: "og:description",
        content:
          "Valódi termékelőnézet: AI posztkészítő, platformváltozatok, kampányok és tartalomnaptár kisvállalkozásoknak.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: SITE_URL },
      { property: "og:image", content: `${SITE_URL}/images/marketingpilot-share.png` },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      {
        property: "og:image:alt",
        content: "MarketingPilot: AI posztkészítő, márkahang és tartalomterv",
      },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: `${SITE_URL}/images/marketingpilot-share.png` },
    ],
    links: [{ rel: "canonical", href: SITE_URL }],
  }),
  component: LandingPage,
});
