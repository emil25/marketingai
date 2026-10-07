import { Pool, type PoolClient, type QueryResultRow } from "pg";
import type {
  AiJobRecord,
  AnalyticsSnapshotRecord,
  AppData,
  BrandProfileRecord,
  BrandRecord,
  CampaignRecord,
  ChannelConnectionRecord,
  ChannelOAuthSelectionRecord,
  ChannelOAuthStateRecord,
  MediaAssetRecord,
  MembershipRecord,
  PlanItemRecord,
  PostRecord,
  PostVariantRecord,
  PostVersionRecord,
  PublishAttemptRecord,
  UserRecord,
  WorkspaceRecord,
} from "@/lib/data-model";
import { normalizeBusinessType } from "@/lib/business-types";

/**
 * PostgreSQL adapter for the existing AppData abstraction.
 *
 * Keeping the read/modify/write boundary here means route functions do not
 * know whether data is stored in JSON or PostgreSQL. A transaction-wide
 * advisory lock serializes the snapshot write across multiple app processes;
 * this is deliberately conservative while the domain functions are migrated
 * incrementally to narrower repository queries.
 */

type Row = QueryResultRow & Record<string, unknown>;

let pool: Pool | undefined;

export function isPostgresConfigured() {
  return Boolean(process.env["DATABASE_URL"]?.trim() || process.env["DIRECT_URL"]?.trim());
}

function getConnectionString() {
  const value = process.env["DATABASE_URL"]?.trim() || process.env["DIRECT_URL"]?.trim();
  if (!value) throw new Error("DATABASE_URL vagy DIRECT_URL szükséges a PostgreSQL használatához.");
  return value;
}

function getPool() {
  if (pool) return pool;
  const connectionString = getConnectionString();
  const sslRequired =
    process.env["DATABASE_SSL"] === "require" ||
    /(?:[?&]sslmode=require\b)/i.test(connectionString);
  const configuredPoolMax = Number(process.env["DATABASE_POOL_MAX"] || 10);
  const poolMax =
    Number.isInteger(configuredPoolMax) && configuredPoolMax > 0 ? configuredPoolMax : 10;
  pool = new Pool({
    connectionString,
    max: poolMax,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    ...(sslRequired ? { ssl: { rejectUnauthorized: false } } : {}),
  });
  return pool;
}

function iso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return String(value ?? "");
}

function dateOnly(value: unknown): string {
  const valueAsString = iso(value);
  return valueAsString.slice(0, 10);
}

function optionalString(value: unknown): string | null {
  return value == null ? null : String(value);
}

// pg returns timestamptz columns as Date objects. String(Date) is a human-readable
// timezone label that PostgreSQL cannot reliably parse on the next snapshot write.
function optionalIso(value: unknown): string | null {
  return value == null ? null : iso(value);
}

function numberOrNull(value: unknown): number | null {
  if (value == null) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function json(value: unknown): string {
  return JSON.stringify(value ?? null);
}

async function rows(client: PoolClient, table: string): Promise<Row[]> {
  // Table names are compile-time constants from this module, never user input.
  const result = await client.query<Row>(`SELECT * FROM ${table}`);
  return result.rows;
}

async function readDataFromClient(client: PoolClient): Promise<AppData> {
  const [
    userRows,
    workspaceRows,
    membershipRows,
    brandRows,
    profileRows,
    campaignRows,
    postRows,
    variantRows,
    versionRows,
    planRows,
    mediaRows,
    analyticsRows,
    aiRows,
    connectionRows,
    oauthStateRows,
    oauthSelectionRows,
    publishRows,
  ] = await Promise.all([
    rows(client, "users"),
    rows(client, "workspaces"),
    rows(client, "memberships"),
    rows(client, "brands"),
    rows(client, "brand_profiles"),
    rows(client, "campaigns"),
    rows(client, "posts"),
    rows(client, "post_variants"),
    rows(client, "post_versions"),
    rows(client, "plan_items"),
    rows(client, "media_assets"),
    rows(client, "analytics_snapshots"),
    rows(client, "ai_jobs"),
    rows(client, "channel_connections"),
    rows(client, "channel_oauth_states"),
    rows(client, "channel_oauth_selections"),
    rows(client, "publish_attempts"),
  ]);

  const users: UserRecord[] = userRows.map((row) => ({
    id: String(row.id),
    email: String(row.email),
    displayName: String(row.display_name),
    passwordHash: String(row.password_hash),
    createdAt: iso(row.created_at),
  }));
  const workspaces: WorkspaceRecord[] = workspaceRows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  }));
  const memberships: MembershipRecord[] = membershipRows.map((row) => ({
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    userId: String(row.user_id),
    role: row.role as MembershipRecord["role"],
    createdAt: iso(row.created_at),
  }));
  const brands: BrandRecord[] = brandRows.map((row) => ({
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    name: String(row.name),
    website: String(row.website ?? ""),
    cityRegion: String(row.city_region ?? ""),
    languageMarket: String(row.language_market ?? ""),
    industry: String(row.industry ?? ""),
    products: String(row.products ?? ""),
    services: String(row.services ?? ""),
    offers: String(row.offers ?? ""),
    audience: String(row.audience ?? ""),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  }));
  const brandProfiles: BrandProfileRecord[] = profileRows.map((row) => ({
    id: String(row.id),
    brandId: String(row.brand_id),
    businessType: normalizeBusinessType(optionalString(row.business_type)),
    tone: String(row.tone ?? ""),
    ctaStyle: String(row.cta_style ?? ""),
    values: String(row.values ?? ""),
    preferredPhrases: String(row.preferred_phrases ?? ""),
    avoidedPhrases: String(row.avoided_phrases ?? ""),
    description: String(row.description ?? ""),
    approvedExamples: String(row.approved_examples ?? ""),
    aiGuardrails: String(row.ai_guardrails ?? ""),
    logoUrl: String(row.logo_url ?? ""),
    colors: stringArray(row.colors),
    fontFamily: String(row.font_family ?? ""),
    learningSamples: stringArray(row.learning_samples),
    learnedSummary: String(row.learned_summary ?? ""),
    learnedAt: optionalIso(row.learned_at),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  }));
  const campaigns: CampaignRecord[] = campaignRows.map((row) => ({
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    brandId: String(row.brand_id),
    name: String(row.name),
    objective: String(row.objective),
    audience: String(row.audience),
    offer: String(row.offer),
    description: String(row.description),
    startDate: dateOnly(row.start_date),
    endDate: dateOnly(row.end_date),
    timezone: String(row.timezone),
    status: row.status as CampaignRecord["status"],
    budget: numberOrNull(row.budget),
    successCriteria: String(row.success_criteria),
    channels: stringArray(row.channels) as CampaignRecord["channels"],
    cta: String(row.cta),
    strategy: (row.strategy ?? null) as CampaignRecord["strategy"],
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  }));
  const posts: PostRecord[] = postRows.map((row) => ({
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    brandId: String(row.brand_id),
    campaignId: optionalString(row.campaign_id),
    title: String(row.title),
    goal: String(row.goal),
    audience: String(row.audience),
    language: String(row.language),
    tone: String(row.tone),
    status: row.status as PostRecord["status"],
    scheduledAt: optionalIso(row.scheduled_at),
    timezone: String(row.timezone),
    mediaAssetIds: stringArray(row.media_asset_ids),
    platforms: stringArray(row.platforms) as PostRecord["platforms"],
    hooks: stringArray(row.hooks),
    selectedHook: optionalString(row.selected_hook),
    abVariants: (Array.isArray(row.ab_variants) ? row.ab_variants : []) as PostRecord["abVariants"],
    adCopies: (Array.isArray(row.ad_copies) ? row.ad_copies : []) as PostRecord["adCopies"],
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  }));
  const postVariants: PostVariantRecord[] = variantRows.map((row) => ({
    id: String(row.id),
    postId: String(row.post_id),
    platform: row.platform as PostVariantRecord["platform"],
    content: String(row.content),
    hashtags: stringArray(row.hashtags),
    cta: String(row.cta),
    status: row.status as PostVariantRecord["status"],
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  }));
  const postVersions: PostVersionRecord[] = versionRows.map((row) => ({
    id: String(row.id),
    postId: String(row.post_id),
    variantId: optionalString(row.variant_id),
    content: String(row.content),
    createdAt: iso(row.created_at),
    createdBy: String(row.created_by),
  }));
  const planItems: PlanItemRecord[] = planRows.map((row) => ({
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    brandId: String(row.brand_id),
    campaignId: optionalString(row.campaign_id),
    postId: optionalString(row.post_id),
    date: dateOnly(row.date),
    time: optionalString(row.time),
    timezone: String(row.timezone),
    platform: row.platform as PlanItemRecord["platform"],
    contentType: String(row.content_type),
    topic: String(row.topic),
    objective: String(row.objective),
    status: row.status as PlanItemRecord["status"],
    aiGenerated: Boolean(row.ai_generated),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  }));
  const mediaAssets: MediaAssetRecord[] = mediaRows.map((row) => ({
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    brandId: String(row.brand_id),
    filename: String(row.filename),
    mimeType: String(row.mime_type),
    size: Number(row.size),
    width: numberOrNull(row.width),
    height: numberOrNull(row.height),
    path: String(row.path),
    altText: String(row.alt_text ?? ""),
    source: row.source as MediaAssetRecord["source"],
    createdAt: iso(row.created_at),
  }));
  const analyticsSnapshots: AnalyticsSnapshotRecord[] = analyticsRows.map((row) => ({
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    brandId: String(row.brand_id),
    platform: row.platform as AnalyticsSnapshotRecord["platform"],
    postId: optionalString(row.post_id),
    date: dateOnly(row.date),
    impressions: numberOrNull(row.impressions),
    reach: numberOrNull(row.reach),
    engagement: numberOrNull(row.engagement),
    clicks: numberOrNull(row.clicks),
    likes: numberOrNull(row.likes),
    comments: numberOrNull(row.comments),
    shares: numberOrNull(row.shares),
    saves: numberOrNull(row.saves),
    videoViews: numberOrNull(row.video_views),
    source: row.source as AnalyticsSnapshotRecord["source"],
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  }));
  const aiJobs: AiJobRecord[] = aiRows.map((row) => ({
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    brandId: String(row.brand_id),
    type: row.type as AiJobRecord["type"],
    status: row.status as AiJobRecord["status"],
    input: (row.input ?? {}) as Record<string, unknown>,
    createdAt: iso(row.created_at),
    completedAt: optionalIso(row.completed_at) ?? undefined,
    error: optionalString(row.error) ?? undefined,
  }));
  const channelConnections: ChannelConnectionRecord[] = connectionRows.map((row) => ({
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    brandId: String(row.brand_id),
    provider: row.provider as ChannelConnectionRecord["provider"],
    status: row.status as ChannelConnectionRecord["status"],
    externalAccountId: optionalString(row.external_account_id),
    externalAccountName: optionalString(row.external_account_name),
    accessToken: optionalString(row.access_token),
    refreshToken: optionalString(row.refresh_token),
    tokenExpiresAt: optionalIso(row.token_expires_at),
    scopes: stringArray(row.scopes),
    connectedAt: optionalIso(row.connected_at),
    updatedAt: iso(row.updated_at),
    lastError: optionalString(row.last_error),
  }));
  const channelOAuthStates: ChannelOAuthStateRecord[] = oauthStateRows.map((row) => ({
    state: String(row.state),
    userId: String(row.user_id),
    workspaceId: String(row.workspace_id),
    brandId: String(row.brand_id),
    provider: row.provider as ChannelOAuthStateRecord["provider"],
    connectionId: String(row.connection_id),
    createdAt: iso(row.created_at),
    expiresAt: iso(row.expires_at),
  }));
  const channelOAuthSelections: ChannelOAuthSelectionRecord[] = oauthSelectionRows.map((row) => ({
    id: String(row.id),
    userId: String(row.user_id),
    workspaceId: String(row.workspace_id),
    brandId: String(row.brand_id),
    provider: row.provider as ChannelOAuthSelectionRecord["provider"],
    connectionId: String(row.connection_id),
    candidates: (Array.isArray(row.candidates)
      ? row.candidates
      : []) as ChannelOAuthSelectionRecord["candidates"],
    createdAt: iso(row.created_at),
    expiresAt: iso(row.expires_at),
  }));
  const publishAttempts: PublishAttemptRecord[] = publishRows.map((row) => ({
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    brandId: String(row.brand_id),
    postId: String(row.post_id),
    connectionId: optionalString(row.connection_id),
    platform: row.platform as PublishAttemptRecord["platform"],
    status: row.status as PublishAttemptRecord["status"],
    requestedAt: iso(row.requested_at),
    startedAt: optionalIso(row.started_at) ?? undefined,
    completedAt: optionalIso(row.completed_at) ?? undefined,
    externalId: optionalString(row.external_id) ?? undefined,
    error: optionalString(row.error) ?? undefined,
    retryOf: optionalString(row.retry_of) ?? undefined,
  }));

  return {
    users,
    workspaces,
    memberships,
    brands,
    brandProfiles,
    aiJobs,
    posts,
    postVariants,
    postVersions,
    mediaAssets,
    analyticsSnapshots,
    campaigns,
    planItems,
    channelConnections,
    channelOAuthStates,
    channelOAuthSelections,
    publishAttempts,
  };
}

type InsertRow = Record<string, unknown>;

async function insertRows(
  client: PoolClient,
  table: string,
  columns: string[],
  records: InsertRow[],
) {
  if (!records.length) return;
  const quotedColumns = columns.map((column) => `"${column}"`).join(", ");
  const placeholders = columns.map((_, index) => `$${index + 1}`).join(", ");
  const statement = `INSERT INTO ${table} (${quotedColumns}) VALUES (${placeholders})`;
  for (const record of records)
    await client.query(
      statement,
      columns.map((column) => record[column]),
    );
}

function rowsFor<T>(records: T[], mapper: (record: T) => InsertRow) {
  return records.map(mapper);
}

async function replaceDataInClient(client: PoolClient, data: AppData) {
  // Preserve any future server-side sessions while replacing the domain
  // snapshot. Sessions belonging to deleted users/workspaces are discarded.
  const existingSessions = (
    await client.query<Row>(
      "SELECT id, user_id, workspace_id, token_hash, expires_at, created_at, last_seen_at FROM sessions",
    )
  ).rows;
  for (const table of [
    "publish_attempts",
    "channel_oauth_selections",
    "channel_oauth_states",
    "channel_connections",
    "analytics_snapshots",
    "post_versions",
    "post_variants",
    "plan_items",
    "posts",
    "campaigns",
    "media_assets",
    "ai_jobs",
    "brand_profiles",
    "brands",
    "memberships",
    "workspaces",
    "users",
  ])
    await client.query(`DELETE FROM ${table}`);

  await insertRows(
    client,
    "users",
    ["id", "email", "display_name", "password_hash", "created_at"],
    rowsFor(data.users, (item) => ({
      id: item.id,
      email: item.email,
      display_name: item.displayName,
      password_hash: item.passwordHash,
      created_at: item.createdAt,
    })),
  );
  await insertRows(
    client,
    "workspaces",
    ["id", "name", "created_at", "updated_at"],
    rowsFor(data.workspaces, (item) => ({
      id: item.id,
      name: item.name,
      created_at: item.createdAt,
      updated_at: item.updatedAt,
    })),
  );
  await insertRows(
    client,
    "sessions",
    ["id", "user_id", "workspace_id", "token_hash", "expires_at", "created_at", "last_seen_at"],
    existingSessions
      .filter(
        (item) =>
          data.users.some((user) => user.id === item.user_id) &&
          (item.workspace_id == null ||
            data.workspaces.some((workspace) => workspace.id === item.workspace_id)),
      )
      .map((item) => ({
        id: item.id,
        user_id: item.user_id,
        workspace_id: item.workspace_id,
        token_hash: item.token_hash,
        expires_at: item.expires_at,
        created_at: item.created_at,
        last_seen_at: item.last_seen_at,
      })),
  );
  await insertRows(
    client,
    "memberships",
    ["id", "workspace_id", "user_id", "role", "created_at"],
    rowsFor(data.memberships, (item) => ({
      id: item.id,
      workspace_id: item.workspaceId,
      user_id: item.userId,
      role: item.role,
      created_at: item.createdAt,
    })),
  );
  await insertRows(
    client,
    "brands",
    [
      "id",
      "workspace_id",
      "name",
      "website",
      "city_region",
      "language_market",
      "industry",
      "products",
      "services",
      "offers",
      "audience",
      "created_at",
      "updated_at",
    ],
    rowsFor(data.brands, (item) => ({
      id: item.id,
      workspace_id: item.workspaceId,
      name: item.name,
      website: item.website,
      city_region: item.cityRegion,
      language_market: item.languageMarket,
      industry: item.industry,
      products: item.products,
      services: item.services,
      offers: item.offers,
      audience: item.audience,
      created_at: item.createdAt,
      updated_at: item.updatedAt,
    })),
  );
  await insertRows(
    client,
    "brand_profiles",
    [
      "id",
      "brand_id",
      "business_type",
      "tone",
      "cta_style",
      "values",
      "preferred_phrases",
      "avoided_phrases",
      "description",
      "approved_examples",
      "ai_guardrails",
      "logo_url",
      "colors",
      "font_family",
      "learning_samples",
      "learned_summary",
      "learned_at",
      "created_at",
      "updated_at",
    ],
    rowsFor(data.brandProfiles, (item) => ({
      id: item.id,
      brand_id: item.brandId,
      business_type: normalizeBusinessType(item.businessType),
      tone: item.tone,
      cta_style: item.ctaStyle,
      values: item.values,
      preferred_phrases: item.preferredPhrases,
      avoided_phrases: item.avoidedPhrases,
      description: item.description,
      approved_examples: item.approvedExamples,
      ai_guardrails: item.aiGuardrails,
      logo_url: item.logoUrl,
      colors: json(item.colors),
      font_family: item.fontFamily,
      learning_samples: json(item.learningSamples ?? []),
      learned_summary: item.learnedSummary ?? "",
      learned_at: item.learnedAt ?? null,
      created_at: item.createdAt,
      updated_at: item.updatedAt,
    })),
  );
  await insertRows(
    client,
    "campaigns",
    [
      "id",
      "workspace_id",
      "brand_id",
      "name",
      "objective",
      "audience",
      "offer",
      "description",
      "start_date",
      "end_date",
      "timezone",
      "status",
      "budget",
      "success_criteria",
      "channels",
      "cta",
      "strategy",
      "created_at",
      "updated_at",
    ],
    rowsFor(data.campaigns, (item) => ({
      id: item.id,
      workspace_id: item.workspaceId,
      brand_id: item.brandId,
      name: item.name,
      objective: item.objective,
      audience: item.audience,
      offer: item.offer,
      description: item.description,
      start_date: item.startDate,
      end_date: item.endDate,
      timezone: item.timezone,
      status: item.status,
      budget: item.budget,
      success_criteria: item.successCriteria,
      channels: json(item.channels),
      cta: item.cta,
      strategy: item.strategy == null ? null : json(item.strategy),
      created_at: item.createdAt,
      updated_at: item.updatedAt,
    })),
  );
  await insertRows(
    client,
    "posts",
    [
      "id",
      "workspace_id",
      "brand_id",
      "campaign_id",
      "title",
      "goal",
      "audience",
      "language",
      "tone",
      "status",
      "scheduled_at",
      "timezone",
      "media_asset_ids",
      "platforms",
      "hooks",
      "selected_hook",
      "ab_variants",
      "ad_copies",
      "created_at",
      "updated_at",
    ],
    rowsFor(data.posts, (item) => ({
      id: item.id,
      workspace_id: item.workspaceId,
      brand_id: item.brandId,
      campaign_id: item.campaignId ?? null,
      title: item.title,
      goal: item.goal,
      audience: item.audience,
      language: item.language,
      tone: item.tone,
      status: item.status,
      scheduled_at: item.scheduledAt ?? null,
      timezone: item.timezone,
      media_asset_ids: json(item.mediaAssetIds),
      platforms: json(item.platforms ?? []),
      hooks: json(item.hooks ?? []),
      selected_hook: item.selectedHook ?? null,
      ab_variants: json(item.abVariants ?? []),
      ad_copies: json(item.adCopies ?? []),
      created_at: item.createdAt,
      updated_at: item.updatedAt,
    })),
  );
  await insertRows(
    client,
    "post_variants",
    [
      "id",
      "post_id",
      "platform",
      "content",
      "hashtags",
      "cta",
      "status",
      "created_at",
      "updated_at",
    ],
    rowsFor(data.postVariants, (item) => ({
      id: item.id,
      post_id: item.postId,
      platform: item.platform,
      content: item.content,
      hashtags: json(item.hashtags),
      cta: item.cta,
      status: item.status,
      created_at: item.createdAt,
      updated_at: item.updatedAt,
    })),
  );
  await insertRows(
    client,
    "post_versions",
    ["id", "post_id", "variant_id", "content", "created_at", "created_by"],
    rowsFor(data.postVersions, (item) => ({
      id: item.id,
      post_id: item.postId,
      variant_id: item.variantId ?? null,
      content: item.content,
      created_at: item.createdAt,
      created_by: item.createdBy,
    })),
  );
  await insertRows(
    client,
    "plan_items",
    [
      "id",
      "workspace_id",
      "brand_id",
      "campaign_id",
      "post_id",
      "date",
      "time",
      "timezone",
      "platform",
      "content_type",
      "topic",
      "objective",
      "status",
      "ai_generated",
      "created_at",
      "updated_at",
    ],
    rowsFor(data.planItems, (item) => ({
      id: item.id,
      workspace_id: item.workspaceId,
      brand_id: item.brandId,
      campaign_id: item.campaignId ?? null,
      post_id: item.postId ?? null,
      date: item.date,
      time: item.time ?? null,
      timezone: item.timezone,
      platform: item.platform,
      content_type: item.contentType,
      topic: item.topic,
      objective: item.objective,
      status: item.status,
      ai_generated: item.aiGenerated,
      created_at: item.createdAt,
      updated_at: item.updatedAt,
    })),
  );
  await insertRows(
    client,
    "media_assets",
    [
      "id",
      "workspace_id",
      "brand_id",
      "filename",
      "mime_type",
      "size",
      "width",
      "height",
      "path",
      "alt_text",
      "source",
      "created_at",
    ],
    rowsFor(data.mediaAssets, (item) => ({
      id: item.id,
      workspace_id: item.workspaceId,
      brand_id: item.brandId,
      filename: item.filename,
      mime_type: item.mimeType,
      size: item.size,
      width: item.width,
      height: item.height,
      path: item.path,
      alt_text: item.altText,
      source: item.source,
      created_at: item.createdAt,
    })),
  );
  await insertRows(
    client,
    "analytics_snapshots",
    [
      "id",
      "workspace_id",
      "brand_id",
      "platform",
      "post_id",
      "date",
      "impressions",
      "reach",
      "engagement",
      "clicks",
      "likes",
      "comments",
      "shares",
      "saves",
      "video_views",
      "source",
      "created_at",
      "updated_at",
    ],
    rowsFor(data.analyticsSnapshots, (item) => ({
      id: item.id,
      workspace_id: item.workspaceId,
      brand_id: item.brandId,
      platform: item.platform,
      post_id: item.postId ?? null,
      date: item.date,
      impressions: item.impressions,
      reach: item.reach,
      engagement: item.engagement,
      clicks: item.clicks,
      likes: item.likes,
      comments: item.comments,
      shares: item.shares,
      saves: item.saves,
      video_views: item.videoViews,
      source: item.source,
      created_at: item.createdAt,
      updated_at: item.updatedAt,
    })),
  );
  await insertRows(
    client,
    "ai_jobs",
    [
      "id",
      "workspace_id",
      "brand_id",
      "type",
      "status",
      "input",
      "created_at",
      "completed_at",
      "error",
    ],
    rowsFor(data.aiJobs, (item) => ({
      id: item.id,
      workspace_id: item.workspaceId,
      brand_id: item.brandId,
      type: item.type,
      status: item.status,
      input: json(item.input),
      created_at: item.createdAt,
      completed_at: item.completedAt ?? null,
      error: item.error ?? null,
    })),
  );
  await insertRows(
    client,
    "channel_connections",
    [
      "id",
      "workspace_id",
      "brand_id",
      "provider",
      "status",
      "external_account_id",
      "external_account_name",
      "access_token",
      "refresh_token",
      "token_expires_at",
      "scopes",
      "connected_at",
      "updated_at",
      "last_error",
    ],
    rowsFor(data.channelConnections, (item) => ({
      id: item.id,
      workspace_id: item.workspaceId,
      brand_id: item.brandId,
      provider: item.provider,
      status: item.status,
      external_account_id: item.externalAccountId,
      external_account_name: item.externalAccountName,
      access_token: item.accessToken,
      refresh_token: item.refreshToken,
      token_expires_at: item.tokenExpiresAt,
      scopes: json(item.scopes),
      connected_at: item.connectedAt,
      updated_at: item.updatedAt,
      last_error: item.lastError,
    })),
  );
  await insertRows(
    client,
    "channel_oauth_states",
    [
      "state",
      "user_id",
      "workspace_id",
      "brand_id",
      "provider",
      "connection_id",
      "created_at",
      "expires_at",
    ],
    rowsFor(data.channelOAuthStates, (item) => ({
      state: item.state,
      user_id: item.userId,
      workspace_id: item.workspaceId,
      brand_id: item.brandId,
      provider: item.provider,
      connection_id: item.connectionId,
      created_at: item.createdAt,
      expires_at: item.expiresAt,
    })),
  );
  await insertRows(
    client,
    "channel_oauth_selections",
    [
      "id",
      "user_id",
      "workspace_id",
      "brand_id",
      "provider",
      "connection_id",
      "candidates",
      "created_at",
      "expires_at",
    ],
    rowsFor(data.channelOAuthSelections, (item) => ({
      id: item.id,
      user_id: item.userId,
      workspace_id: item.workspaceId,
      brand_id: item.brandId,
      provider: item.provider,
      connection_id: item.connectionId,
      candidates: json(item.candidates),
      created_at: item.createdAt,
      expires_at: item.expiresAt,
    })),
  );
  await insertRows(
    client,
    "publish_attempts",
    [
      "id",
      "workspace_id",
      "brand_id",
      "post_id",
      "connection_id",
      "platform",
      "status",
      "requested_at",
      "started_at",
      "completed_at",
      "external_id",
      "error",
      "retry_of",
    ],
    rowsFor(data.publishAttempts, (item) => ({
      id: item.id,
      workspace_id: item.workspaceId,
      brand_id: item.brandId,
      post_id: item.postId,
      connection_id: item.connectionId,
      platform: item.platform,
      status: item.status,
      requested_at: item.requestedAt,
      started_at: item.startedAt ?? null,
      completed_at: item.completedAt ?? null,
      external_id: item.externalId ?? null,
      error: item.error ?? null,
      retry_of: item.retryOf ?? null,
    })),
  );
}

export async function readPostgresData(): Promise<AppData> {
  const client = await getPool().connect();
  try {
    return await readDataFromClient(client);
  } finally {
    client.release();
  }
}

export async function postgresTransact<T>(mutator: (data: AppData) => Promise<T> | T): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query("SET CONSTRAINTS ALL DEFERRED");
    await client.query("SELECT pg_advisory_xact_lock(hashtext('marketingpilot:appdata'))");
    const data = await readDataFromClient(client);
    const result = await mutator(data);
    await replaceDataInClient(client, data);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/** Import a complete JSON snapshot after the schema migration has run. */
export async function importPostgresData(
  data: AppData,
  options: { allowExisting?: boolean } = {},
): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query("SET CONSTRAINTS ALL DEFERRED");
    await client.query("SELECT pg_advisory_xact_lock(hashtext('marketingpilot:appdata'))");
    if (!options.allowExisting) {
      const existing = await readDataFromClient(client);
      const existingRecordCount = Object.values(existing).reduce(
        (total, value) => total + (Array.isArray(value) ? value.length : 0),
        0,
      );
      if (existingRecordCount > 0) {
        throw new Error(
          "A cél PostgreSQL adatbázis már tartalmaz adatot; az import biztonsági okból leállt.",
        );
      }
    }
    await replaceDataInClient(client, data);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function closePostgresPool() {
  if (!pool) return;
  const current = pool;
  pool = undefined;
  await current.end();
}
