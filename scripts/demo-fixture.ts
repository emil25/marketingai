import { randomBytes, randomUUID } from "node:crypto";
import { hashPassword } from "../src/lib/server/password.server";
import { brandVoiceGuardrails } from "../src/lib/onboarding-brand";
import type { AppData } from "../src/lib/data-model";

/** Fictional inputs only. No external contact details, testimonials or performance numbers. */
export const QA_BRANDS = [
  {
    type: "bakery_cafe",
    name: "Példa Pékség",
    products: "Kovászos kenyér, kakaós csiga, sajtos pogácsa",
    services: "Elviteles reggeli",
    audience: "helyi dolgozók",
    idea: "Mutasd be a kakaós csigát reggeli választásként.",
  },
  {
    type: "beauty_salon",
    name: "Példa Kozmetika",
    products: "",
    services: "Arctisztítás, szemöldökformázás, arcápolási tanácsadás",
    audience: "helyi felnőttek",
    idea: "Mutasd be az arcápolási tanácsadást és kérj időpontfoglalást.",
  },
  {
    type: "accommodation",
    name: "Példa Panzió",
    products: "",
    services: "Szállás, reggeli, hétvégi pihenés",
    audience: "párok és családok",
    idea: "Mutasd be a hétvégi pihenés lehetőségét, foglalási érdeklődést kérve.",
  },
  {
    type: "auto_service",
    name: "Példa Autószerviz",
    products: "",
    services: "Olajcsere, fékellenőrzés, időszakos átvizsgálás",
    audience: "helyi autótulajdonosok",
    idea: "Írj a fékellenőrzésről, időpont-egyeztetést kérve.",
  },
  {
    type: "ecommerce",
    name: "Példa Webáruház",
    products: "Kerámia bögre, vászontáska, jegyzetfüzet",
    services: "Online rendelés",
    audience: "ajándékot kereső vásárlók",
    idea: "Mutasd be a kerámia bögrét ajándékötletként.",
  },
] as const;

export function demoFixture(includeContent: boolean) {
  const db: AppData = {
    users: [],
    workspaces: [],
    memberships: [],
    brands: [],
    brandProfiles: [],
    posts: [],
    postVariants: [],
    postVersions: [],
    campaigns: [],
    planItems: [],
    aiJobs: [],
    mediaAssets: [],
    analyticsSnapshots: [],
    channelConnections: [],
    channelOAuthStates: [],
    channelOAuthSelections: [],
    publishAttempts: [],
  };
  const credentials: Array<{
    email: string;
    password: string;
    brandId: string;
    workspaceId: string;
  }> = [];
  const at = new Date().toISOString(),
    id = (prefix: string) => `${prefix}_${randomUUID()}`;
  for (const [index, item] of (includeContent ? QA_BRANDS.slice(0, 1) : QA_BRANDS).entries()) {
    const userId = id("user"),
      workspaceId = id("workspace"),
      brandId = id("brand");
    const password = randomBytes(32).toString("base64url");
    const email = `fictional-${index}@example.invalid`;
    credentials.push({ email, password, brandId, workspaceId });
    db.users.push({
      id: userId,
      email,
      displayName: "Példa",
      passwordHash: hashPassword(password),
      createdAt: at,
      uiMode: "simple",
      uiModeSuggestionDismissed: true,
      auth: { emailVerifiedAt: at, sessionVersion: 0 },
    });
    db.workspaces.push({ id: workspaceId, name: item.name, createdAt: at, updatedAt: at });
    db.memberships.push({
      id: id("membership"),
      userId,
      workspaceId,
      role: "owner",
      createdAt: at,
    });
    db.brands.push({
      id: brandId,
      workspaceId,
      name: item.name,
      website: "",
      cityRegion: "Csíkszereda",
      languageMarket: "magyar",
      industry: "",
      products: item.products,
      services: item.services,
      offers: "Nincs megadott kedvezmény vagy ár.",
      audience: item.audience,
      createdAt: at,
      updatedAt: at,
    });
    db.brandProfiles.push({
      id: id("voice"),
      brandId,
      businessType: item.type,
      mainChannel: "facebook",
      address: "Példa utca 1. (kitalált cím)",
      openingHours: "Hétfő–péntek 08:00–16:00; szombat és vasárnap zárva",
      tone: "Barátságos",
      ctaStyle: "Írj nekünk privát üzenetet!",
      values: "",
      preferredPhrases: "",
      avoidedPhrases: "",
      description: "Kitalált QA-márka, nem valódi vállalkozás.",
      approvedExamples: "",
      aiGuardrails: brandVoiceGuardrails("te"),
      logoUrl: "",
      colors: ["#ed674d"],
      fontFamily: "Plus Jakarta Sans",
      createdAt: at,
      updatedAt: at,
    });
    if (!includeContent) continue;
    const start = new Date();
    start.setUTCHours(12, 0, 0, 0);
    const date = (day: number) =>
      new Date(start.getTime() + day * 86400000).toISOString().slice(0, 10);
    for (const days of [7, 30]) {
      const campaignId = id("campaign");
      db.campaigns.push({
        id: campaignId,
        workspaceId,
        brandId,
        name: days === 7 ? "Reggeli ötletek a hétre" : "A pékség kínálatának bemutatása",
        objective: "A megadott kínálat bemutatása",
        audience: item.audience,
        offer: "Kenyér és péksütemény",
        description: "Kitalált, kézzel készített bemutató tartalom; nem AI-eredmény.",
        startDate: date(0),
        endDate: date(days - 1),
        timezone: "Europe/Bucharest",
        status: "active",
        budget: null,
        successCriteria: "Átnézett, kész posztok",
        channels: ["facebook", "instagram"],
        cta: "Írj nekünk!",
        strategy: {
          summary: "Kínálatbemutató példa",
          mainMessage: "Kenyér, kakaós csiga és pogácsa",
          cta: "Írj nekünk!",
          contentPillars: ["Kínálat", "Kérdés", "Elviteles reggeli"],
          recommendedFrequency: "Hetente három poszt",
          channelStrategies: { facebook: "Beszélgetős", instagram: "Rövid, vizuális" },
        },
        createdAt: at,
        updatedAt: at,
      });
      for (let i = 0; i < 3; i++) {
        const postId = id("post"),
          variantId = id("variant");
        const content = [
          "Kakaós csiga a reggeli mellé? A Példa Pékség kínálatában kenyér és sajtos pogácsa is szerepel.\n\nTe mit választanál? [aktuális választék]",
          "Kovászos kenyér, kakaós csiga vagy sajtos pogácsa. Ezekből választhatsz nálunk.\n\nÍrj nekünk privát üzenetet!",
          "Köszönet, hogy követed a Példa Pékséget.\n\nMelyik termékünkről olvasnál legközelebb?",
        ][i];
        const postStatus = i === 0 ? "draft" : i === 1 ? "review" : "published";
        db.posts.push({
          id: postId,
          workspaceId,
          brandId,
          campaignId,
          title: ["Reggeli választás", "Kínálatunk", "Köszönet"][i],
          goal: "Kapcsolattartás",
          audience: item.audience,
          language: "magyar",
          tone: "Barátságos",
          status: postStatus,
          timezone: "Europe/Bucharest",
          mediaAssetIds: [],
          platforms: ["facebook"],
          createdAt: at,
          updatedAt: at,
        });
        db.postVariants.push({
          id: variantId,
          postId,
          platform: "facebook",
          content,
          cta: "",
          hashtags: [],
          status: i === 0 ? "draft" : i === 1 ? "prepared" : "published",
          ...(i === 2 ? { manualPublishedAt: at } : {}),
          createdAt: at,
          updatedAt: at,
        });
        db.postVersions.push({
          id: id("version"),
          postId,
          variantId,
          content,
          createdBy: userId,
          createdAt: at,
        });
        db.planItems.push({
          id: id("plan"),
          workspaceId,
          brandId,
          campaignId,
          postId,
          date: date(i * 2),
          time: "09:00",
          timezone: "Europe/Bucharest",
          platform: "facebook",
          contentType: "egyképes",
          topic: db.posts.at(-1)!.title,
          objective: "Kapcsolattartás",
          status: i === 0 ? "draft" : i === 1 ? "ready" : "published",
          draftContent: content,
          aiGenerated: false,
          createdAt: at,
          updatedAt: at,
        });
      }
    }
  }
  return { db, credentials };
}
