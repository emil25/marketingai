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

/**
 * Seed the shared account with narrow idempotent inserts. The app's general
 * PostgreSQL snapshot transaction rewrites every domain table, which is too
 * broad for a sign-in action and can fail because of unrelated records.
 */
export async function ensurePreviewDemoAccountInPostgres(
  createPasswordHash: () => Promise<string>,
  timestamp = new Date().toISOString(),
) {
  const { getPool } = await import("./postgres-store.server");
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext('marketingpilot:preview-demo-account'))",
    );

    const userResult = await client.query<{
      id: string;
      email: string;
      auth_metadata: UserRecord["auth"] | null;
    }>(
      "SELECT id, email, auth_metadata FROM users WHERE id = $1 OR lower(email) = lower($2) FOR UPDATE",
      [DEMO_USER_ID, DEMO_EMAIL],
    );
    const existingUser = userResult.rows.find((row) => row.id === DEMO_USER_ID);
    if (userResult.rows.some((row) => row.email === DEMO_EMAIL && row.id !== DEMO_USER_ID)) {
      throw new Error("A próba-fiók jelenleg nem érhető el.");
    }

    const auth = existingUser?.auth_metadata ?? {
      emailVerifiedAt: null,
      sessionVersion: 0,
      betaInvitedAt: timestamp,
    };
    if (!existingUser) {
      const passwordHash = await createPasswordHash();
      await client.query(
        `INSERT INTO users (id, email, display_name, password_hash, created_at, auth_metadata, ui_mode, ui_mode_suggestion_dismissed)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, 'simple', true) ON CONFLICT (id) DO NOTHING`,
        [
          DEMO_USER_ID,
          DEMO_EMAIL,
          "Próba-felhasználó",
          passwordHash,
          timestamp,
          JSON.stringify(auth),
        ],
      );
    }

    await client.query(
      `INSERT INTO workspaces (id, name, created_at, updated_at)
       VALUES ($1, $2, $3, $3) ON CONFLICT (id) DO NOTHING`,
      [DEMO_WORKSPACE_ID, "Példa Pékség · közös próba-fiók", timestamp],
    );
    await client.query(
      `INSERT INTO memberships (id, workspace_id, user_id, role, created_at)
       VALUES ('membership_preview_demo', $1, $2, 'owner', $3)
       ON CONFLICT (workspace_id, user_id) DO NOTHING`,
      [DEMO_WORKSPACE_ID, DEMO_USER_ID, timestamp],
    );
    await client.query(
      `INSERT INTO brands (id, workspace_id, name, website, city_region, language_market, industry, products, services, offers, audience, created_at, updated_at)
       VALUES ($1, $2, 'Példa Pékség', '', 'Csíkszereda', 'magyar', '', 'Kovászos kenyér, kakaós csiga, sajtos pogácsa', 'Elviteles reggeli', '', 'helyi vásárlók', $3, $3)
       ON CONFLICT (id) DO NOTHING`,
      [DEMO_BRAND_ID, DEMO_WORKSPACE_ID, timestamp],
    );
    await client.query(
      `INSERT INTO brand_profiles (
         id, brand_id, business_type, tone, cta_style, "values", preferred_phrases,
         avoided_phrases, description, approved_examples, ai_guardrails, logo_url,
         colors, font_family, learning_samples, learned_summary, learned_at, created_at, updated_at
       ) VALUES (
         'profile_preview_demo', $1, 'bakery_cafe', 'Barátságos',
         'A poszt témájához illő, egyetlen konkrét felhívás', '', '', '',
         'Kitalált pékségmárka a MarketingPilot kipróbálásához.', '',
         'Ne találj ki árat, kedvezményt, címet, nyitvatartást vagy vásárlói véleményt.',
         '', '["#ed674d"]'::jsonb, 'Plus Jakarta Sans', '[]'::jsonb, '', NULL, $2, $2
       ) ON CONFLICT (brand_id) DO NOTHING`,
      [DEMO_BRAND_ID, timestamp],
    );
    await client.query("COMMIT");
    return {
      user: { id: DEMO_USER_ID, auth },
      workspace: { id: DEMO_WORKSPACE_ID },
      brand: { id: DEMO_BRAND_ID },
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
