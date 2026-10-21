import type {
  AppData,
  BrandProfileRecord,
  BrandRecord,
  MembershipRecord,
  UserRecord,
  WorkspaceRecord,
} from "@/lib/data-model";

const PREVIEW_BRANCH = "codex/mobile-simple-preview";
const DEMO_USER_ID = "user_preview_demo";
const DEMO_WORKSPACE_ID = "workspace_preview_demo";
const DEMO_BRAND_ID = "brand_preview_demo";
const DEMO_EMAIL = "preview-demo@example.invalid";

type Environment = Record<string, string | undefined>;

/** The shared demo entry is enabled only on the one private-beta Preview branch. */
export function previewDemoLoginEnabled(env: Environment = process.env) {
  return (
    env.VERCEL_ENV === "preview" &&
    env.VERCEL === "1" &&
    env.VERCEL_GIT_COMMIT_REF === PREVIEW_BRANCH &&
    env.BETA_MODE === "private" &&
    !!env.BETA_INVITE_CODE?.trim()
  );
}

/** Creates a fictional, persistent account once and never resets its saved work. */
export async function ensurePreviewDemoAccount(
  data: AppData,
  createPasswordHash: () => Promise<string>,
  timestamp = new Date().toISOString(),
) {
  const conflictingEmail = data.users.find(
    (user) => user.email === DEMO_EMAIL && user.id !== DEMO_USER_ID,
  );
  if (conflictingEmail) throw new Error("A próba-fiók jelenleg nem érhető el.");

  let user = data.users.find((row) => row.id === DEMO_USER_ID);
  if (!user) {
    user = {
      id: DEMO_USER_ID,
      email: DEMO_EMAIL,
      displayName: "Próba-felhasználó",
      passwordHash: await createPasswordHash(),
      uiMode: "simple",
      uiModeSuggestionDismissed: true,
      auth: { emailVerifiedAt: null, sessionVersion: 0, betaInvitedAt: timestamp },
      createdAt: timestamp,
    } satisfies UserRecord;
    data.users.push(user);
  }

  let workspace = data.workspaces.find((row) => row.id === DEMO_WORKSPACE_ID);
  if (!workspace) {
    workspace = {
      id: DEMO_WORKSPACE_ID,
      name: "Példa Pékség · közös próba-fiók",
      createdAt: timestamp,
      updatedAt: timestamp,
    } satisfies WorkspaceRecord;
    data.workspaces.push(workspace);
  }

  let membership = data.memberships.find(
    (row) => row.userId === DEMO_USER_ID && row.workspaceId === DEMO_WORKSPACE_ID,
  );
  if (!membership) {
    membership = {
      id: "membership_preview_demo",
      userId: DEMO_USER_ID,
      workspaceId: DEMO_WORKSPACE_ID,
      role: "owner",
      createdAt: timestamp,
    } satisfies MembershipRecord;
    data.memberships.push(membership);
  }

  let brand = data.brands.find((row) => row.id === DEMO_BRAND_ID);
  if (!brand) {
    brand = {
      id: DEMO_BRAND_ID,
      workspaceId: DEMO_WORKSPACE_ID,
      name: "Példa Pékség",
      website: "",
      cityRegion: "Csíkszereda",
      languageMarket: "magyar",
      industry: "",
      products: "Kovászos kenyér, kakaós csiga, sajtos pogácsa",
      services: "Elviteles reggeli",
      offers: "Nincs megadott ár vagy kedvezmény.",
      audience: "helyi vásárlók",
      createdAt: timestamp,
      updatedAt: timestamp,
    } satisfies BrandRecord;
    data.brands.push(brand);
  }

  if (!data.brandProfiles.some((row) => row.brandId === DEMO_BRAND_ID)) {
    data.brandProfiles.push({
      id: "profile_preview_demo",
      brandId: DEMO_BRAND_ID,
      businessType: "bakery_cafe",
      mainChannel: "facebook",
      tone: "Barátságos",
      ctaStyle: "A poszt témájához illő, egyetlen konkrét felhívás",
      values: "",
      preferredPhrases: "",
      avoidedPhrases: "",
      description: "Kitalált pékségmárka a MarketingPilot kipróbálásához.",
      approvedExamples: "",
      aiGuardrails: "Ne találj ki árat, kedvezményt, címet, nyitvatartást vagy vásárlói véleményt.",
      logoUrl: "",
      colors: ["#ed674d"],
      fontFamily: "Plus Jakarta Sans",
      learningSamples: [],
      learnedSummary: "",
      learnedAt: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    } satisfies BrandProfileRecord);
  }

  return { user, workspace, membership, brand };
}
