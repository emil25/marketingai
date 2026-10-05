import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type {
  AiJobRecord,
  AppData,
  BrandProfileRecord,
  BrandRecord,
  MembershipRecord,
  WorkspaceSnapshot,
  UserRecord,
  WorkspaceRecord,
} from "@/lib/data-model";
import { normalizeBusinessType } from "@/lib/business-types";
import { createMediaStorage } from "./media-storage.server";

const dataDirectory = process.env["MARKETINGPILOT_DATA_DIR"] || path.join(process.cwd(), "data");
const dataFile = path.join(dataDirectory, "marketingpilot.json");
export const mediaDirectory = path.join(dataDirectory, "media");
const mediaStorage = createMediaStorage(mediaDirectory);

const emptyData = (): AppData => ({
  users: [],
  workspaces: [],
  memberships: [],
  brands: [],
  brandProfiles: [],
  aiJobs: [],
  posts: [],
  postVariants: [],
  postVersions: [],
  mediaAssets: [],
  analyticsSnapshots: [],
  campaigns: [],
  planItems: [],
  channelConnections: [],
  channelOAuthStates: [],
  channelOAuthSelections: [],
  publishAttempts: [],
});

async function ensureStore() {
  await mkdir(dataDirectory, { recursive: true });
  await mkdir(mediaDirectory, { recursive: true });
  try {
    await readFile(dataFile, "utf8");
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
    await writeFile(dataFile, `${JSON.stringify(emptyData(), null, 2)}\n`, "utf8");
  }
}

export async function readData(): Promise<AppData> {
  if (isPostgresEnabled()) {
    const { readPostgresData } = await import("./postgres-store.server");
    return readPostgresData();
  }
  if (process.env["VERCEL"]) {
    throw new Error("Az online adatbázis nincs beállítva. Ideiglenes JSON-tárolót nem használunk.");
  }
  await ensureStore();
  const raw = await readFile(dataFile, "utf8");
  const parsed = JSON.parse(raw) as Partial<AppData>;
  return {
    users: parsed.users ?? [],
    workspaces: parsed.workspaces ?? [],
    memberships: parsed.memberships ?? [],
    brands: parsed.brands ?? [],
    brandProfiles: parsed.brandProfiles ?? [],
    aiJobs: parsed.aiJobs ?? [],
    posts: parsed.posts ?? [],
    postVariants: parsed.postVariants ?? [],
    postVersions: parsed.postVersions ?? [],
    mediaAssets: parsed.mediaAssets ?? [],
    analyticsSnapshots: parsed.analyticsSnapshots ?? [],
    campaigns: parsed.campaigns ?? [],
    planItems: parsed.planItems ?? [],
    channelConnections: parsed.channelConnections ?? [],
    channelOAuthStates: parsed.channelOAuthStates ?? [],
    channelOAuthSelections: parsed.channelOAuthSelections ?? [],
    publishAttempts: parsed.publishAttempts ?? [],
  };
}

export async function writeData(data: AppData): Promise<void> {
  if (isPostgresEnabled()) {
    throw new Error(
      "PostgreSQL esetén a writeData közvetlen hívása nem támogatott; használd a transact függvényt.",
    );
  }
  await ensureStore();
  const temporaryFile = `${dataFile}.${randomUUID()}.tmp`;
  await writeFile(temporaryFile, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  await rename(temporaryFile, dataFile);
}

// The local JSON store is shared by concurrent server functions. Serialize
// read/modify/write transactions so Windows cannot race while replacing the
// data file and no successful mutation gets overwritten by a stale snapshot.
let transactionQueue: Promise<unknown> = Promise.resolve();

export async function transact<T>(mutator: (data: AppData) => Promise<T> | T): Promise<T> {
  if (isPostgresEnabled()) {
    const { postgresTransact } = await import("./postgres-store.server");
    return postgresTransact(mutator);
  }
  const run = transactionQueue.then(async () => {
    const data = await readData();
    const result = await mutator(data);
    await writeData(data);
    return result;
  });
  transactionQueue = run.catch(() => undefined);
  return run;
}

function isPostgresEnabled() {
  return Boolean(process.env["DATABASE_URL"]?.trim() || process.env["DIRECT_URL"]?.trim());
}

export function nowIso() {
  return new Date().toISOString();
}

export function newId(prefix: string) {
  return `${prefix}_${randomUUID()}`;
}

export function publicUser(user: UserRecord) {
  const { passwordHash: _passwordHash, ...safe } = user;
  return safe;
}

export function getWorkspaceSnapshot(
  data: AppData,
  userId: string,
  workspaceId: string,
  activeBrandId?: string,
): WorkspaceSnapshot | null {
  const user = data.users.find((candidate) => candidate.id === userId);
  const workspace = data.workspaces.find((candidate) => candidate.id === workspaceId);
  const membership = data.memberships.find(
    (candidate) => candidate.userId === userId && candidate.workspaceId === workspaceId,
  );
  if (!user || !workspace || !membership) return null;

  const brands = data.brands
    .filter((brand) => brand.workspaceId === workspaceId)
    .map((brand) => ({
      ...brand,
      profile: (() => {
        const profile = data.brandProfiles.find((candidate) => candidate.brandId === brand.id) ?? defaultBrandProfile(brand.id);
        return { ...profile, businessType: normalizeBusinessType(profile.businessType) };
      })(),
    }));
  const activeBrand = brands.find((brand) => brand.id === activeBrandId) ?? brands[0] ?? null;

  return { user: publicUser(user), workspace, membership, brands, activeBrand };
}

export function defaultBrandProfile(brandId: string): BrandProfileRecord {
  const timestamp = nowIso();
  return {
    id: `profile_${brandId}`,
    brandId,
    businessType: "other",
    tone: "Barátságos",
    ctaStyle: "Barátságos és közvetlen",
    values: "",
    preferredPhrases: "",
    avoidedPhrases: "",
    description: "",
    approvedExamples: "",
    aiGuardrails: "Ne találj ki árakat, akciókat, nyitvatartást vagy ügyfélvéleményeket.",
    logoUrl: "",
    colors: [],
    fontFamily: "Plus Jakarta Sans",
    learningSamples: [],
    learnedSummary: "",
    learnedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function createAiJob(
  data: AppData,
  input: Omit<AiJobRecord, "id" | "createdAt" | "status">,
) {
  const job: AiJobRecord = {
    ...input,
    id: newId("ai"),
    status: "pending",
    createdAt: nowIso(),
  };
  data.aiJobs.push(job);
  return job;
}

export function startAiJob(data: AppData, jobId: string) {
  const job = data.aiJobs.find((candidate) => candidate.id === jobId);
  if (job && job.status === "pending") job.status = "running";
}

export function completeAiJob(data: AppData, jobId: string, error?: string) {
  const job = data.aiJobs.find((candidate) => candidate.id === jobId);
  if (!job) return;
  job.status = error ? "failed" : "completed";
  job.completedAt = nowIso();
  if (error) job.error = error.slice(0, 500);
}

export function mediaPathForId(id: string) {
  if (!/^media_[a-f0-9-]+$/i.test(id)) throw new Error("Érvénytelen médiaazonosító.");
  return path.join(mediaDirectory, id);
}

export async function writeMediaFile(id: string, bytes: Uint8Array) {
  await mediaStorage.write(id, bytes);
}

export async function readMediaFile(id: string) {
  return mediaStorage.read(id);
}

export async function removeMediaFile(id: string) {
  await mediaStorage.remove(id);
}
