import { test } from "node:test";
import assert from "node:assert/strict";
import type { AppData, UserRecord } from "../src/lib/data-model";
import {
  claimReminder,
  finishReminder,
  handleWeeklyReminders,
  mondayDate,
  readReminderToken,
  reminderEmail,
  setReminderPreference,
  unsubscribeReminder,
} from "../src/lib/server/weekly-reminder.server";
import { publicUser } from "../src/lib/server/store.server";

const env = {
  WEEKLY_REMINDERS_ENABLED: "true",
  PUBLIC_APP_URL: "https://preview.example.invalid",
  RESEND_API_KEY: "test-only",
  EMAIL_FROM: "MarketingPilot <test@example.invalid>",
  SESSION_SECRET: "isolated-reminder-session-secret-at-least-32-characters",
  CRON_SECRET: "isolated-reminder-cron-secret-at-least-32-characters",
};
const monday = new Date("2026-10-12T06:00:00Z");
const user = (): UserRecord => ({
  id: "user-test",
  email: "test@example.invalid",
  displayName: "TESZT",
  passwordHash: "test-only",
  createdAt: "2026-10-09T06:00:00Z",
  auth: { emailVerifiedAt: "2026-10-09T06:00:00Z", sessionVersion: 0 },
});
function database() {
  return {
    users: [user()],
    memberships: [{ userId: "user-test", workspaceId: "w1" }],
    brands: [{ workspaceId: "w1" }],
  } as unknown as AppData;
}
const request = () =>
  new Request("https://preview.example.invalid/api/cron/ai-monitor", {
    headers: { Authorization: `Bearer ${env.CRON_SECRET}` },
  });

test("weekly reminders are explicit opt-in, verified only, private and retain legacy session semantics", () => {
  const db = database();
  assert.equal(claimReminder(db, "2026-10-12", monday), null);
  setReminderPreference(db.users[0], true);
  assert.ok(!("auth" in publicUser(db.users[0])));
  db.users[0].auth!.emailVerifiedAt = null;
  assert.equal(claimReminder(db, "2026-10-12", monday), null);
  db.users[0].auth!.emailVerifiedAt = "2026-10-09";
  db.users[0].auth!.deleting = true;
  assert.equal(claimReminder(db, "2026-10-12", monday), null);
  const legacy = user();
  delete legacy.auth;
  setReminderPreference(legacy, true);
  assert.equal(publicUser(legacy).emailVerified, true);
  assert.equal(legacy.auth!.sessionVersion, 0);
});
test("Monday respects configured timezone across UTC boundary and DST", () => {
  assert.equal(mondayDate(new Date("2026-10-11T22:30:00Z")), "2026-10-12");
  assert.equal(mondayDate(new Date("2026-10-12T22:30:00Z")), null);
  assert.equal(mondayDate(new Date("2026-11-02T06:00:00Z")), "2026-11-02");
  assert.throws(() => mondayDate(monday, "invalid"));
});

test("expired delivery recovers without stale completion overwriting a new lease or unsubscribe", () => {
  const db = database();
  setReminderPreference(db.users[0], true);
  const first = claimReminder(db, "2026-10-12", monday)!;
  assert.equal(claimReminder(db, "2026-10-12", new Date(monday.getTime() + 4 * 60000)), null);
  const recovered = claimReminder(db, "2026-10-12", new Date(monday.getTime() + 6 * 60000))!;
  assert.notEqual(first.lease, recovered.lease);
  finishReminder(db, first, true);
  assert.equal(db.users[0].auth!.weeklyReminder!.lastSentWeek, undefined);
  assert.equal(db.users[0].auth!.weeklyReminder!.delivery!.lease, recovered.lease);
  unsubscribeReminder(db.users[0], recovered.subscriptionId);
  finishReminder(db, recovered, true);
  assert.equal(db.users[0].auth!.weeklyReminder!.enabled, false);
  assert.equal(db.users[0].auth!.weeklyReminder!.lastSentWeek, undefined);
  assert.equal(claimReminder(db, "2026-10-12", new Date(monday.getTime() + 7 * 60000)), null);
});
test("lease, retry, weekly idempotency and unsubscribe only affect the authorized subscription", () => {
  const db = database();
  setReminderPreference(db.users[0], true);
  const delivery = claimReminder(db, "2026-10-12", monday)!;
  assert.equal(claimReminder(db, "2026-10-12", monday), null);
  finishReminder(db, delivery, false);
  const retry = claimReminder(db, "2026-10-12", monday)!;
  const body = reminderEmail(retry, env);
  const url = new URL(body.text.split("Leiratkozás: ")[1]);
  assert.equal(url.pathname, "/weekly-reminder");
  assert.equal(url.search, "");
  const token = url.hash.slice(1);
  const parsed = readReminderToken(token, env.SESSION_SECRET)!;
  assert.equal(parsed.userId, "user-test");
  assert.equal(readReminderToken(token + "x", env.SESSION_SECRET), null);
  assert.equal(readReminderToken(token, "another-isolated-secret-at-least-32-characters"), null);
  assert.equal(unsubscribeReminder(db.users[0], "different"), false);
  finishReminder(db, retry, true);
  assert.equal(claimReminder(db, "2026-10-12", monday), null);
  assert.equal(unsubscribeReminder(db.users[0], parsed.subscriptionId), true);
  setReminderPreference(db.users[0], true);
  assert.equal(unsubscribeReminder(db.users[0], parsed.subscriptionId), false);
  assert.equal(claimReminder(db, "2026-10-12", monday), null);
  assert.ok(!body.text.includes(env.RESEND_API_KEY) && !body.text.includes(env.SESSION_SECRET));
  assert.equal((body.html.match(/background:#133b30/g) || []).length, 1);
});
test("protected cron sends once, retries identical email after provider failure, skips disabled and non-Monday", async () => {
  const db = database();
  setReminderPreference(db.users[0], true);
  const repository = {
    claim: async (week: string, now: Date) => claimReminder(db, week, now),
    current: async () => true,
    finish: async (delivery: Parameters<typeof finishReminder>[1], sent: boolean) =>
      finishReminder(db, delivery, sent),
    pending: async (week: string) => db.users[0].auth!.weeklyReminder!.lastSentWeek !== week,
  };
  let calls = 0;
  const payloads: string[] = [],
    keys: string[] = [];
  const fetcher: typeof fetch = async (_input, init) => {
    calls++;
    payloads.push(String(init?.body));
    keys.push(new Headers(init?.headers).get("Idempotency-Key")!);
    return Response.json({}, { status: calls === 1 ? 429 : 200 });
  };
  const deps = { env, repository, fetcher, now: () => monday };
  assert.equal((await handleWeeklyReminders(new Request(request().url), deps)).status, 401);
  assert.equal(calls, 0);
  assert.equal((await handleWeeklyReminders(request(), deps)).status, 503);
  assert.equal((await handleWeeklyReminders(request(), deps)).status, 200);
  await handleWeeklyReminders(request(), deps);
  assert.equal(calls, 2);
  assert.equal(payloads[0], payloads[1]);
  assert.equal(keys[0], keys[1]);
  assert.deepEqual(
    await (
      await handleWeeklyReminders(request(), {
        ...deps,
        env: { ...env, WEEKLY_REMINDERS_ENABLED: "false" },
      })
    ).json(),
    { status: "disabled" },
  );
  assert.deepEqual(
    await (
      await handleWeeklyReminders(request(), {
        ...deps,
        now: () => new Date("2026-10-13T06:00:00Z"),
      })
    ).json(),
    { status: "not_monday" },
  );
});
