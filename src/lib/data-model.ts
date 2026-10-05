export type MembershipRole = "owner" | "admin" | "member";

export type UserRecord = {
  id: string;
  email: string;
  displayName: string;
  passwordHash: string;
  createdAt: string;
};

export type WorkspaceRecord = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type MembershipRecord = {
  id: string;
  workspaceId: string;
  userId: string;
  role: MembershipRole;
  createdAt: string;
};

export type BrandRecord = {
  id: string;
  workspaceId: string;
  name: string;
  website: string;
  cityRegion: string;
  languageMarket: string;
  industry: string;
  products: string;
  services: string;
  offers: string;
  audience: string;
  createdAt: string;
  updatedAt: string;
};

export type BrandProfileRecord = {
  id: string;
  brandId: string;
  /** Stable business category used to tailor quick starts and AI context. */
  businessType?: string;
  tone: string;
  ctaStyle: string;
  values: string;
  preferredPhrases: string;
  avoidedPhrases: string;
  description: string;
  approvedExamples: string;
  aiGuardrails: string;
  logoUrl: string;
  colors: string[];
  fontFamily: string;
  /** Pasted or uploaded first-party examples used to learn the brand voice. */
  learningSamples?: string[];
  /** AI-generated style summary derived from learningSamples. */
  learnedSummary?: string;
  learnedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AiJobRecord = {
  id: string;
  workspaceId: string;
  brandId: string;
  type: "content" | "image" | "campaign" | "plan" | "recommendation";
  status: "pending" | "running" | "completed" | "failed";
  input: Record<string, unknown>;
  createdAt: string;
  completedAt?: string;
  error?: string;
};

export type PostStatus = "idea" | "draft" | "review" | "scheduled" | "published" | "failed";
export type PostPlatform =
  "facebook" | "instagram" | "tiktok" | "linkedin" | "youtube" | "google-business";

export type CampaignStatus = "draft" | "planning" | "active" | "paused" | "completed" | "archived";
export type PlanItemStatus =
  "idea" | "planned" | "draft" | "ready" | "scheduled" | "published" | "skipped";

export type CampaignStrategy = {
  summary: string;
  mainMessage: string;
  cta: string;
  contentPillars: string[];
  recommendedFrequency: string;
  channelStrategies: Record<string, string>;
};

export type CampaignRecord = {
  id: string;
  workspaceId: string;
  brandId: string;
  name: string;
  objective: string;
  audience: string;
  offer: string;
  description: string;
  startDate: string;
  endDate: string;
  timezone: string;
  status: CampaignStatus;
  budget: number | null;
  successCriteria: string;
  channels: PostPlatform[];
  cta: string;
  strategy: CampaignStrategy | null;
  createdAt: string;
  updatedAt: string;
};

export type PlanItemRecord = {
  id: string;
  workspaceId: string;
  brandId: string;
  campaignId: string | null;
  postId: string | null;
  date: string;
  time: string | null;
  timezone: string;
  platform: PostPlatform;
  contentType: string;
  topic: string;
  objective: string;
  status: PlanItemStatus;
  aiGenerated: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PostRecord = {
  id: string;
  workspaceId: string;
  brandId: string;
  campaignId?: string | null;
  title: string;
  goal: string;
  audience: string;
  language: string;
  tone: string;
  status: PostStatus;
  scheduledAt?: string | null;
  timezone: string;
  mediaAssetIds: string[];
  /** Platforms selected in the editor, persisted before variants are generated. */
  platforms?: PostPlatform[];
  /** Strong opening ideas generated from the post brief. */
  hooks?: string[];
  selectedHook?: string | null;
  /** Distinct editorial alternatives for the selected platform. */
  abVariants?: PostAbVariantRecord[];
  /** Meta ad copy alternatives associated with this post. */
  adCopies?: PostAdCopyRecord[];
  createdAt: string;
  updatedAt: string;
};

export type PostAbVariantRecord = {
  id: string;
  postId: string;
  platform: PostPlatform;
  label: string;
  content: string;
  hashtags: string[];
  cta: string;
  selected: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PostAdCopyRecord = {
  id: string;
  postId: string;
  label: string;
  primaryText: string;
  headline: string;
  description: string;
  cta: string;
  createdAt: string;
  updatedAt: string;
};

export type PostVariantRecord = {
  id: string;
  postId: string;
  platform: PostPlatform;
  content: string;
  hashtags: string[];
  cta: string;
  status: "draft" | "review" | "prepared" | "published" | "failed";
  createdAt: string;
  updatedAt: string;
};

export type PostVersionRecord = {
  id: string;
  postId: string;
  variantId?: string | null;
  content: string;
  createdAt: string;
  createdBy: string;
};

export type MediaAssetRecord = {
  id: string;
  workspaceId: string;
  brandId: string;
  filename: string;
  mimeType: string;
  size: number;
  width: number | null;
  height: number | null;
  path: string;
  altText: string;
  source: "upload" | "ai" | "import";
  createdAt: string;
};

/**
 * A point-in-time metric snapshot imported from a connected social channel.
 * Values are nullable because providers expose different metric sets.
 * Snapshots are always scoped to the owning workspace and brand.
 */
export type AnalyticsSnapshotRecord = {
  id: string;
  workspaceId: string;
  brandId: string;
  platform: PostPlatform;
  postId: string | null;
  date: string;
  impressions: number | null;
  reach: number | null;
  engagement: number | null;
  clicks: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  videoViews: number | null;
  source: "facebook" | "instagram" | "linkedin" | "tiktok" | "youtube" | "google-business" | "import";
  createdAt: string;
  updatedAt: string;
};

export type ChannelProvider =
  "facebook" | "instagram" | "tiktok" | "youtube" | "linkedin" | "pinterest";
export type ChannelConnectionStatus =
  "not_connected" | "connecting" | "connected" | "expired" | "error" | "revoked";

/**
 * OAuth credentials are encrypted at rest and are server-only values. They
 * must never be included in a client/server-function response.
 */
export type ChannelConnectionRecord = {
  id: string;
  workspaceId: string;
  brandId: string;
  provider: ChannelProvider;
  status: ChannelConnectionStatus;
  externalAccountId: string | null;
  externalAccountName: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  tokenExpiresAt: string | null;
  scopes: string[];
  connectedAt: string | null;
  updatedAt: string;
  lastError: string | null;
};

export type ChannelOAuthStateRecord = {
  state: string;
  userId: string;
  workspaceId: string;
  brandId: string;
  provider: "facebook" | "instagram";
  connectionId: string;
  createdAt: string;
  expiresAt: string;
};

export type ChannelOAuthSelectionCandidate = {
  id: string;
  externalAccountId: string;
  externalAccountName: string;
  pageName: string | null;
  encryptedAccessToken: string;
  tokenExpiresAt: string | null;
  scopes: string[];
};

export type ChannelOAuthSelectionRecord = {
  id: string;
  userId: string;
  workspaceId: string;
  brandId: string;
  provider: "facebook" | "instagram";
  connectionId: string;
  candidates: ChannelOAuthSelectionCandidate[];
  createdAt: string;
  expiresAt: string;
};

export type PublishAttemptStatus = "pending" | "running" | "published" | "failed";

/** Server-side audit trail for every Facebook/Instagram publication attempt. */
export type PublishAttemptRecord = {
  id: string;
  workspaceId: string;
  brandId: string;
  postId: string;
  connectionId: string | null;
  platform: "facebook" | "instagram";
  status: PublishAttemptStatus;
  requestedAt: string;
  startedAt?: string;
  completedAt?: string;
  externalId?: string;
  error?: string;
  retryOf?: string;
};

export type AppData = {
  users: UserRecord[];
  workspaces: WorkspaceRecord[];
  memberships: MembershipRecord[];
  brands: BrandRecord[];
  brandProfiles: BrandProfileRecord[];
  aiJobs: AiJobRecord[];
  posts: PostRecord[];
  postVariants: PostVariantRecord[];
  postVersions: PostVersionRecord[];
  mediaAssets: MediaAssetRecord[];
  analyticsSnapshots: AnalyticsSnapshotRecord[];
  campaigns: CampaignRecord[];
  planItems: PlanItemRecord[];
  channelConnections: ChannelConnectionRecord[];
  channelOAuthStates: ChannelOAuthStateRecord[];
  channelOAuthSelections: ChannelOAuthSelectionRecord[];
  publishAttempts: PublishAttemptRecord[];
};

export type PublicUser = Omit<UserRecord, "passwordHash">;

export type WorkspaceSnapshot = {
  user: PublicUser;
  workspace: WorkspaceRecord;
  membership: MembershipRecord;
  brands: Array<BrandRecord & { profile: BrandProfileRecord }>;
  activeBrand: (BrandRecord & { profile: BrandProfileRecord }) | null;
};
