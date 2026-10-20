import type { AppData, CampaignRecord, PlanItemRecord } from "../data-model";
import { WeekPlanSchema, campaignWeeks, type WeekPlan } from "./weekly-plan.server";
import { newId, nowIso } from "./store.server";

export function storedCampaignWeeks(input: Record<string, unknown>): WeekPlan[] {
  const parsed = WeekPlanSchema.array().max(5).safeParse(input.weekPlans);
  return parsed.success ? parsed.data : [];
}
export function planDuration(campaign: CampaignRecord): 7 | 30 {
  return Date.parse(campaign.endDate) - Date.parse(campaign.startDate) < 29 * 86400000 ? 7 : 30;
}
/** Keep only compatible, validated staged weeks when retrying a saved campaign. */
export function resumableCampaignWeeks(campaign: CampaignRecord, input: Record<string, unknown>) {
  const ranges = campaignWeeks(campaign.startDate, planDuration(campaign));
  const seen = new Set<number>();
  return storedCampaignWeeks(input).filter((plan) => {
    const range = ranges.find((week) => week.week === plan.het);
    if (
      !range ||
      seen.has(plan.het) ||
      !plan.posztok.every(
        (item) =>
          item.datum >= range.startDate &&
          item.datum <= range.endDate &&
          campaign.channels.includes(
            item.csatorna === "google_business" ? "google-business" : item.csatorna,
          ),
      )
    )
      return false;
    seen.add(plan.het);
    return true;
  });
}
export function applyCompleteCampaignWeeks(
  database: AppData,
  campaign: CampaignRecord,
  plans: WeekPlan[],
  allowExisting = false,
) {
  const expected = campaignWeeks(campaign.startDate, planDuration(campaign));
  if (
    new Set(plans.map((p) => p.het)).size !== plans.length ||
    plans.some((p) => !expected.some((w) => w.week === p.het)) ||
    expected.some(
      (w) =>
        !plans.some((p) => p.het === w.week) &&
        !(
          allowExisting &&
          database.planItems.some(
            (p) =>
              p.campaignId === campaign.id &&
              p.workspaceId === campaign.workspaceId &&
              p.brandId === campaign.brandId &&
              p.date >= w.startDate &&
              p.date <= w.endDate,
          )
        ),
    )
  )
    throw new Error("A kampány még nem teljes. A kész hetek piszkozatát megőriztük.");
  const timestamp = nowIso();
  const owned = database.planItems.filter(
    (p) =>
      p.campaignId === campaign.id &&
      p.workspaceId === campaign.workspaceId &&
      p.brandId === campaign.brandId,
  );
  const additions: PlanItemRecord[] = [];
  // Keep unchanged weeks (and their post links/edits) byte-for-byte. Only callers
  // explicitly replacing an unlinked week remove its rows before invoking this.
  for (const plan of plans) {
    const range = expected.find((w) => w.week === plan.het)!;
    if (owned.some((p) => p.date >= range.startDate && p.date <= range.endDate)) continue;
    for (const [index, item] of plan.posztok.entries()) {
      if (item.datum < range.startDate || item.datum > range.endDate)
        throw new Error("A heti dátumok nem egyeznek a kampánnyal.");
      const platform = item.csatorna === "google_business" ? "google-business" : item.csatorna;
      if (!campaign.channels.includes(platform))
        throw new Error("A heti csatorna nem része a kampánynak.");
      additions.push({
        id: newId("plan"),
        workspaceId: campaign.workspaceId,
        brandId: campaign.brandId,
        campaignId: campaign.id,
        postId: null,
        date: item.datum,
        time: item.idopont,
        timezone: campaign.timezone,
        platform,
        contentType: item.forma,
        topic: item.tema,
        objective: item.cel,
        status: "planned",
        aiGenerated: true,
        draftContent: item.vazlat,
        visualIdea: item.vizualis_otlet,
        verificationWarnings: item.ellenorizendo,
        topicSummary: plan.temak_osszefoglalo[index],
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }
  }
  database.planItems.push(...additions);
  const all = database.planItems.filter(
    (p) =>
      p.campaignId === campaign.id &&
      p.workspaceId === campaign.workspaceId &&
      p.brandId === campaign.brandId,
  );
  campaign.strategy = {
    summary: `${planDuration(campaign)} napos kampány, ${all.length} megtervezett poszttal. Az időpontok javaslatok, nem mért adatok.`,
    mainMessage: campaign.offer || campaign.objective,
    cta: campaign.cta,
    contentPillars: [...new Set(all.map((p) => p.topicSummary || p.topic))].slice(0, 8),
    recommendedFrequency: "Heti 3–4 poszt.",
    channelStrategies: Object.fromEntries(
      campaign.channels.map((p) => [
        p,
        `${all.filter((item) => item.platform === p).length} tervezett poszt.`,
      ]),
    ),
  };
  campaign.status = "active";
  campaign.updatedAt = timestamp;
}
