import type { AiJobRecord, CampaignRecord, PostRecord, PostVariantRecord } from "./data-model";
import { contentPlaceholders } from "./content-quality";

export function campaignDateLabel(value: string) {
  const date = new Date(`${value}T12:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  )
    return "Dátum megadása szükséges";
  return date.toLocaleDateString("hu-HU", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** Shorten generated weekly titles only; keep saved names and duplicate suffixes intact. */
export function campaignTitle(campaign: Pick<CampaignRecord, "name" | "startDate">) {
  const match = /^Heti marketing · (\d{4}-\d{2}-\d{2})( · \d+)?$/.exec(campaign.name);
  if (!match || match[1] !== campaign.startDate) return campaign.name;
  const date = new Date(`${match[1]}T12:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== match[1])
    return campaign.name;
  return `Heti marketing${match[2] ?? ""}`;
}

export function campaignStatusLabel(campaign: {
  status: CampaignRecord["status"];
  generation: { status: "failed" | "running" } | null;
  contentBlockers: Array<{ postId: string }>;
}) {
  if (campaign.generation)
    return campaign.generation.status === "failed" ? "Nem sikerült" : "Tervezés alatt";
  if (campaign.contentBlockers.length && !["completed", "archived"].includes(campaign.status))
    return "Kitöltésre vár";
  return {
    draft: "Piszkozat",
    planning: "Tervezés alatt",
    active: "Aktív",
    paused: "Szüneteltetve",
    completed: "Lezárva",
    archived: "Archiválva",
  }[campaign.status];
}

export function uniqueCampaignName(name: string, names: string[]) {
  const existing = new Set(names.map((value) => value.trim().toLocaleLowerCase("hu")));
  const base = name.trim().slice(0, 200);
  let candidate = base;
  let suffix = 2;
  while (existing.has(candidate.toLocaleLowerCase("hu"))) {
    const tail = ` · ${suffix++}`;
    candidate = `${base.slice(0, 200 - tail.length)}${tail}`;
  }
  return candidate;
}

/** Disambiguate old duplicates for display without modifying saved customer records. */
export function campaignDisplayNames(campaigns: CampaignRecord[]) {
  const result = new Map<string, string>();
  const reserved = campaigns.map((campaign) => campaign.name);
  const seen = new Set<string>();
  for (const campaign of [...campaigns].sort(
    (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  )) {
    const key = campaign.name.trim().toLocaleLowerCase("hu");
    const name = seen.has(key) ? uniqueCampaignName(campaign.name, reserved) : campaign.name;
    result.set(campaign.id, name);
    reserved.push(name);
    seen.add(key);
  }
  return result;
}

export function campaignJobs(campaign: CampaignRecord, jobs: AiJobRecord[]) {
  return jobs
    .filter(
      (job) =>
        job.type === "campaign" &&
        job.workspaceId === campaign.workspaceId &&
        job.brandId === campaign.brandId &&
        job.input.campaignId === campaign.id,
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
}

export function campaignJobRunning(job: AiJobRecord, now = Date.now()) {
  return ["pending", "running"].includes(job.status) && now - Date.parse(job.createdAt) < 300_000;
}

export function campaignGeneration(campaign: CampaignRecord, jobs: AiJobRecord[], planned: number) {
  // A failed optional regeneration never turns an existing valid campaign into a failed one.
  if (campaign.strategy || planned) return null;
  const latest = campaignJobs(campaign, jobs)[0];
  if (!latest) return null;
  return { status: campaignJobRunning(latest) ? ("running" as const) : ("failed" as const) };
}

export function campaignContentBlockers(posts: PostRecord[], variants: PostVariantRecord[]) {
  return posts
    .filter((post) => post.status !== "published")
    .flatMap((post) => {
      const blocked = variants
        .filter((variant) => variant.postId === post.id && variant.status !== "published")
        .map((variant) => ({
          platform: variant.platform,
          missing: contentPlaceholders(variant.content, variant.cta, ...variant.hashtags),
        }))
        .filter((variant) => variant.missing.length);
      return blocked.length
        ? [
            {
              postId: post.id,
              platform: blocked[0].platform,
              missing: [...new Set(blocked.flatMap((variant) => variant.missing))],
            },
          ]
        : [];
    });
}
