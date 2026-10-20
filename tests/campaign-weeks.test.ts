import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyCompleteCampaignWeeks,
  storedCampaignWeeks,
  resumableCampaignWeeks,
} from "../src/lib/server/campaign-week-store.server";
import { campaignWeeks, type WeekPlan } from "../src/lib/server/weekly-plan.server";
import type { AppData, CampaignRecord } from "../src/lib/data-model";

const campaign = () =>
  ({
    id: "campaign-test",
    workspaceId: "ws-test",
    brandId: "brand-test",
    name: "TESZT",
    startDate: "2026-10-09",
    endDate: "2026-11-07",
    timezone: "Europe/Bucharest",
    status: "planning",
    channels: ["facebook"],
    offer: "kenyér",
    objective: "ismertség",
    cta: "Írj nekünk!",
    strategy: null,
  }) as CampaignRecord;
const database = () => ({ planItems: [] }) as unknown as AppData;
const plans = (): WeekPlan[] =>
  campaignWeeks("2026-10-09", 30).map((w) => ({
    het: w.week,
    szakasz: "ismertség",
    posztok: [
      {
        datum: w.startDate,
        idopont: "10:00",
        csatorna: "facebook",
        tipus: "tipp",
        forma: "egyképes",
        tema: `TESZT hét ${w.week}`,
        cel: "ismertség",
        vazlat: "TESZT kenyér. Írj nekünk!",
        vizualis_otlet: "Fotó a megadott kenyérről.",
        ellenorizendo: [],
      },
    ],
    temak_osszefoglalo: [`TESZT téma ${w.week}`],
  }));

test("partial staged weeks never become active campaign or Planner rows", () => {
  const db = database(),
    item = campaign(),
    first = plans().slice(0, 1);
  assert.equal(storedCampaignWeeks({ weekPlans: first }).length, 1);
  assert.throws(() => applyCompleteCampaignWeeks(db, item, first), /még nem teljes/);
  assert.equal(db.planItems.length, 0);
  assert.equal(item.status, "planning");
  assert.equal(item.strategy, null);
  assert.deepEqual(storedCampaignWeeks({ weekPlans: [{ het: 9 }] }), []);
});

test("retry keeps valid staged weeks, rejects stale dates/channels and does not repeat a week", () => {
  const first = plans()[0];
  const wrongDate = structuredClone(plans()[1]);
  wrongDate.posztok[0].datum = "2030-01-01";
  const wrongChannel = structuredClone(plans()[2]);
  wrongChannel.posztok[0].csatorna = "instagram";
  assert.deepEqual(
    resumableCampaignWeeks(campaign(), { weekPlans: [first, first, wrongDate, wrongChannel] }),
    [first],
  );
  assert.deepEqual(resumableCampaignWeeks(campaign(), { weekPlans: "corrupt" }), []);
});

test("complete weekly plans publish atomically with ownership and actual generated text", () => {
  const db = database(),
    item = campaign(),
    all = plans();
  const malformed = structuredClone(all);
  malformed[4].posztok[0].datum = "2027-01-01";
  assert.throws(() => applyCompleteCampaignWeeks(db, item, malformed), /dátum/);
  assert.equal(db.planItems.length, 0);
  applyCompleteCampaignWeeks(db, item, all);
  assert.equal(db.planItems.length, 5);
  assert.equal(item.status, "active");
  assert.ok(
    db.planItems.every(
      (p) =>
        p.workspaceId === item.workspaceId &&
        p.brandId === item.brandId &&
        p.campaignId === item.id &&
        p.draftContent === all[0].posztok[0].vazlat,
    ),
  );
  assert.ok(item.strategy?.summary.includes("5 megtervezett"));
});

test("regenerating an unlinked week preserves other IDs, edits and post links", () => {
  const db = database(),
    item = campaign(),
    all = plans();
  applyCompleteCampaignWeeks(db, item, all);
  db.planItems[0].postId = "saved-post";
  db.planItems[0].draftContent = "Saját szerkesztés";
  const untouched = JSON.stringify(db.planItems.filter((p) => p.topic !== "TESZT hét 2"));
  db.planItems = db.planItems.filter((p) => p.topic !== "TESZT hét 2");
  all[1].posztok[0].tema = "Új második hét";
  applyCompleteCampaignWeeks(db, item, all, true);
  assert.equal(JSON.stringify(db.planItems.filter((p) => p.topic !== "Új második hét")), untouched);
  assert.equal(db.planItems.filter((p) => p.topic === "Új második hét").length, 1);
  assert.throws(
    () => applyCompleteCampaignWeeks(database(), campaign(), [all[0], all[0]]),
    /még nem teljes/,
  );
});
