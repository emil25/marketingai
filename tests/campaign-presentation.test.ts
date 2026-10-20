import assert from "node:assert/strict";
import { test } from "node:test";
import {
  campaignContentBlockers,
  campaignDateLabel,
  campaignDisplayNames,
  campaignGeneration,
  campaignJobs,
  campaignStatusLabel,
  campaignTitle,
  uniqueCampaignName,
} from "../src/lib/campaign-presentation";
import type {
  CampaignRecord,
  AiJobRecord,
  PostRecord,
  PostVariantRecord,
} from "../src/lib/data-model";

const campaign = {
  id: "c",
  workspaceId: "w",
  brandId: "b",
  name: "Heti marketing · 2026-10-06",
  status: "draft",
  strategy: null,
  createdAt: "2026-10-06T10:00:00Z",
} as CampaignRecord;
const job = {
  id: "j",
  workspaceId: "w",
  brandId: "b",
  type: "campaign",
  status: "failed",
  input: { campaignId: "c" },
  createdAt: campaign.createdAt,
} as AiJobRecord;

test("failed empty generations are identified from owned jobs, not presented as normal drafts", () => {
  assert.deepEqual(campaignGeneration(campaign, [job], 0), { status: "failed" });
  assert.equal(campaignGeneration(campaign, [{ ...job, workspaceId: "foreign" }], 0), null);
  assert.equal(campaignGeneration(campaign, [{ ...job, brandId: "foreign" }], 0), null);
  assert.equal(campaignGeneration(campaign, [job], 4), null);
  assert.equal(
    campaignGeneration({ ...campaign, strategy: {} as CampaignRecord["strategy"] }, [job], 0),
    null,
  );
  const running = { ...job, status: "running" as const, createdAt: new Date().toISOString() };
  assert.deepEqual(campaignGeneration(campaign, [job, running], 0), { status: "running" });
  assert.deepEqual(
    campaignGeneration(campaign, [{ ...running, createdAt: "2000-01-01T00:00:00Z" }], 0),
    { status: "failed" },
  );
  assert.deepEqual(campaignJobs(campaign, [job, { ...job, type: "content" }]), [job]);
});

test("weekly display titles omit only matching automatic dates and retain collision numbering", () => {
  assert.equal(campaignDateLabel("2026-10-06"), "2026. okt. 6.");
  for (const invalid of ["2026-02-30", "invalid", "", "2026-10-06T12:00:00Z"])
    assert.equal(campaignDateLabel(invalid), "Dátum megadása szükséges");
  const weekly = { name: "Heti marketing · 2026-10-06", startDate: "2026-10-06" };
  assert.equal(campaignTitle(weekly), "Heti marketing");
  assert.equal(campaignTitle({ ...weekly, name: `${weekly.name} · 3` }), "Heti marketing · 3");
  assert.equal(campaignTitle({ ...weekly, startDate: "2026-10-07" }), weekly.name);
  assert.equal(campaignTitle({ ...weekly, name: "Nyitás · 2026-10-06" }), "Nyitás · 2026-10-06");
  assert.equal(
    campaignTitle({ name: "Heti marketing · 2026-02-30", startDate: "2026-02-30" }),
    "Heti marketing · 2026-02-30",
  );
  assert.equal(weekly.name, "Heti marketing · 2026-10-06");
});

test("content readiness does not invent a pause reason or override completed and failed states", () => {
  const active = { status: "active" as const, generation: null, contentBlockers: [] };
  const blocked = [{ postId: "p" }];
  assert.equal(campaignStatusLabel(active), "Aktív");
  assert.equal(campaignStatusLabel({ ...active, contentBlockers: blocked }), "Kitöltésre vár");
  assert.equal(
    campaignStatusLabel({ ...active, status: "paused", contentBlockers: blocked }),
    "Kitöltésre vár",
  );
  assert.equal(campaignStatusLabel({ ...active, status: "paused" }), "Szüneteltetve");
  assert.equal(
    campaignStatusLabel({ ...active, status: "completed", contentBlockers: blocked }),
    "Lezárva",
  );
  assert.equal(
    campaignStatusLabel({ ...active, status: "archived", contentBlockers: blocked }),
    "Archiválva",
  );
  assert.equal(
    campaignStatusLabel({ ...active, generation: { status: "failed" }, contentBlockers: blocked }),
    "Nem sikerült",
  );
  assert.equal(
    campaignStatusLabel({ ...active, generation: { status: "running" } }),
    "Tervezés alatt",
  );
});

test("name collision numbering is stable, bounded and preserves saved legacy names", () => {
  assert.equal(uniqueCampaignName(" Kampány ", ["kampány", "Kampány · 2"]), "Kampány · 3");
  const long = "x".repeat(200);
  assert.equal(uniqueCampaignName(long, [long]).length, 200);
  assert.ok(uniqueCampaignName(long, [long]).endsWith(" · 2"));
  const duplicate = { ...campaign, id: "second", createdAt: "2026-10-06T11:00:00Z" };
  const third = { ...duplicate, id: "third", name: `${campaign.name} · 2` };
  const names = campaignDisplayNames([third, duplicate, campaign]);
  assert.equal(names.get(campaign.id), campaign.name);
  assert.equal(names.get(duplicate.id), `${campaign.name} · 3`);
  assert.equal(new Set(names.values()).size, 3);
  assert.equal(duplicate.name, campaign.name);
});

test("missing-data counts use current saved variant text, count each post once and exclude published posts", () => {
  const posts = [
    { id: "p1", status: "draft" },
    { id: "p2", status: "draft" },
    { id: "p3", status: "published" },
  ] as PostRecord[];
  const variant = { content: "Cím: [cím]", hashtags: [], cta: "", status: "draft" };
  const variants = [
    { ...variant, postId: "p1", platform: "instagram" },
    { ...variant, postId: "p1", platform: "facebook", cta: "[telefon]" },
    {
      ...variant,
      postId: "p2",
      platform: "facebook",
      content: "Kitöltött cím.",
      verificationWarnings: ["[cím]"],
    },
    { ...variant, postId: "p3", platform: "facebook" },
    { ...variant, postId: "foreign", platform: "facebook" },
  ] as PostVariantRecord[];
  assert.deepEqual(campaignContentBlockers(posts, variants), [
    { postId: "p1", platform: "instagram", missing: ["[cím]", "[telefon]"] },
  ]);
});
