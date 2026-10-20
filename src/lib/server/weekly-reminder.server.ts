import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { AppData, UserRecord } from "../data-model";
import { cronAuthorized } from "./operations-monitor.server";
import { readData, transact } from "./store.server";

type Environment = Record<string, string | undefined>;
type Reminder = NonNullable<NonNullable<UserRecord["auth"]>["weeklyReminder"]>;
type Delivery = {
  userId: string;
  email: string;
  subscriptionId: string;
  week: string;
  lease: string;
};
export type ReminderRepository = {
  claim: (week: string, now: Date) => Promise<Delivery | null>;
  current: (delivery: Delivery) => Promise<boolean>;
  finish: (delivery: Delivery, sent: boolean) => Promise<void>;
  pending: (week: string) => Promise<boolean>;
};

export function reminderAvailable(env: Environment) {
  return (
    env.WEEKLY_REMINDERS_ENABLED === "true" &&
    !!env.RESEND_API_KEY?.trim() &&
    !!env.EMAIL_FROM?.trim() &&
    (env.SESSION_SECRET?.trim().length ?? 0) >= 32 &&
    validOrigin(env.PUBLIC_APP_URL) !== null
  );
}
function validOrigin(value: string | undefined) {
  try {
    const url = new URL(value || "");
    if (url.username || url.password || url.search || url.hash || url.pathname !== "/") return null;
    if (
      url.protocol !== "https:" &&
      !(url.protocol === "http:" && ["127.0.0.1", "localhost"].includes(url.hostname))
    )
      return null;
    return url.origin;
  } catch {
    return null;
  }
}
export function mondayDate(now: Date, timezone = "Europe/Bucharest") {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value;
  return part("weekday") === "Mon" ? `${part("year")}-${part("month")}-${part("day")}` : null;
}
export function setReminderPreference(user: UserRecord, enabled: boolean) {
  if (user.auth?.deleting) throw new Error("Ez a fiók már nem módosítható.");
  // Legacy accounts already count as verified; preserve that existing decision.
  user.auth ??= { emailVerifiedAt: user.createdAt, sessionVersion: 0 };
  const previous = user.auth.weeklyReminder;
  if (previous?.enabled === enabled) return;
  user.auth.weeklyReminder = {
    enabled,
    subscriptionId: randomUUID(),
    lastSentWeek: previous?.lastSentWeek,
  };
}
export function reminderToken(userId: string, subscriptionId: string, secret: string) {
  if (secret.length < 32) throw new Error("Az emlékeztető biztonsági beállítása hiányzik.");
  const payload = Buffer.from(JSON.stringify({ userId, subscriptionId })).toString("base64url");
  const signature = createHmac("sha256", secret)
    .update(`weekly-reminder:${payload}`)
    .digest("base64url");
  return `${payload}.${signature}`;
}
export function readReminderToken(token: string, secret: string) {
  if (secret.length < 32 || token.length > 512 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token))
    return null;
  const [payload, signature] = token.split(".");
  const expected = createHmac("sha256", secret).update(`weekly-reminder:${payload}`).digest();
  const actual = Buffer.from(signature, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const value = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (
      typeof value.userId !== "string" ||
      value.userId.length > 100 ||
      typeof value.subscriptionId !== "string" ||
      value.subscriptionId.length > 100
    )
      return null;
    return { userId: value.userId as string, subscriptionId: value.subscriptionId as string };
  } catch {
    return null;
  }
}
export function unsubscribeReminder(user: UserRecord | undefined, subscriptionId: string) {
  const reminder = user?.auth?.weeklyReminder;
  if (!reminder || reminder.subscriptionId !== subscriptionId) return false;
  reminder.enabled = false;
  delete reminder.delivery;
  return true;
}
function eligible(db: AppData, user: UserRecord) {
  return (
    !!user.auth?.emailVerifiedAt &&
    !user.auth.deleting &&
    user.auth.weeklyReminder?.enabled === true &&
    db.memberships.some(
      (m) => m.userId === user.id && db.brands.some((b) => b.workspaceId === m.workspaceId),
    )
  );
}
export function claimReminder(db: AppData, week: string, now: Date): Delivery | null {
  const user = db.users.find((u) => {
    if (!eligible(db, u)) return false;
    const reminder = u.auth!.weeklyReminder!;
    return (
      reminder.lastSentWeek !== week &&
      (!reminder.delivery || Date.parse(reminder.delivery.leaseUntil) <= now.getTime())
    );
  });
  if (!user) return null;
  const reminder = user.auth!.weeklyReminder!;
  const lease = randomUUID();
  reminder.delivery = {
    week,
    lease,
    leaseUntil: new Date(now.getTime() + 5 * 60000).toISOString(),
    preparedAt: reminder.delivery?.week === week ? reminder.delivery.preparedAt : now.toISOString(),
  };
  return {
    userId: user.id,
    email: user.email,
    subscriptionId: reminder.subscriptionId,
    week,
    lease,
  };
}
function matches(reminder: Reminder | undefined, delivery: Delivery) {
  return (
    reminder?.enabled &&
    reminder.subscriptionId === delivery.subscriptionId &&
    reminder.delivery?.lease === delivery.lease &&
    reminder.delivery.week === delivery.week
  );
}
export function finishReminder(db: AppData, delivery: Delivery, sent: boolean) {
  const reminder = db.users.find((u) => u.id === delivery.userId)?.auth?.weeklyReminder;
  if (!matches(reminder, delivery)) return;
  if (sent) reminder!.lastSentWeek = delivery.week;
  delete reminder!.delivery;
}
const storeRepository: ReminderRepository = {
  claim: (week, now) => transact((db) => claimReminder(db, week, now)),
  current: async (delivery) => {
    const db = await readData(),
      user = db.users.find((u) => u.id === delivery.userId);
    return (
      !!user &&
      eligible(db, user) &&
      user.email === delivery.email &&
      !!matches(user.auth?.weeklyReminder, delivery)
    );
  },
  finish: (delivery, sent) => transact((db) => finishReminder(db, delivery, sent)),
  pending: async (week) => {
    const db = await readData();
    return db.users.some(
      (user) => eligible(db, user) && user.auth!.weeklyReminder!.lastSentWeek !== week,
    );
  },
};
export function reminderEmail(delivery: Delivery, env: Environment) {
  const origin = validOrigin(env.PUBLIC_APP_URL);
  if (!origin) throw new Error("Az emlékeztető beállítása hiányzik.");
  const plan = new URL("/app/weekly", origin).href;
  // Fragment is removed by the page; no unsubscribe token in HTTP URLs/access logs.
  const unsubscribe = new URL("/weekly-reminder", origin);
  unsubscribe.hash = reminderToken(
    delivery.userId,
    delivery.subscriptionId,
    env.SESSION_SECRET || "",
  );
  const text = `Szia!\n\nEgy rövid terv segít, hogy a héten se maradjon el a posztolás. Nézd át a heti terved, vagy készíts 3–4 posztötletet a vállalkozásodnak.\n\nMegnézem a heti tervemet: ${plan}\n\nAzért kaptad, mert bekapcsoltad a heti emlékeztetőt. Bármikor kikapcsolhatod a Vállalkozásom oldalon.\nLeiratkozás: ${unsubscribe.href}`;
  const escape = (value: string) =>
    value
      .replaceAll("&", "&amp;")
      .replaceAll('"', "&quot;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  return {
    from: env.EMAIL_FROM,
    to: [delivery.email],
    subject: "Egy kis segítség a heti posztjaidhoz",
    text,
    html: `<p>Szia!</p><p>Egy rövid terv segít, hogy a héten se maradjon el a posztolás.</p><p>Nézd át a heti terved, vagy készíts 3–4 posztötletet a vállalkozásodnak.</p><p><a href="${escape(plan)}" style="display:inline-block;padding:14px 20px;background:#133b30;color:#fff;border-radius:10px;text-decoration:none">Megnézem a heti tervemet</a></p><p>Azért kaptad, mert bekapcsoltad a heti emlékeztetőt. Bármikor kikapcsolhatod a Vállalkozásom oldalon.</p><p><a href="${escape(unsubscribe.href)}">Leiratkozás</a></p>`,
  };
}
export async function handleWeeklyReminders(
  request: Request,
  dependencies: {
    env?: Environment;
    now?: () => Date;
    repository?: ReminderRepository;
    fetcher?: typeof fetch;
  } = {},
) {
  const env = dependencies.env ?? process.env;
  const json = (body: unknown, status = 200) =>
    Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
  if (request.method !== "GET") return json({ error: "METHOD_NOT_ALLOWED" }, 405);
  if (!cronAuthorized(request, env)) return json({ error: "UNAUTHORIZED" }, 401);
  if (env.WEEKLY_REMINDERS_ENABLED !== "true") return json({ status: "disabled" });
  let sent = 0,
    failed = 0;
  try {
    if (!reminderAvailable(env)) throw new Error();
    const now = (dependencies.now ?? (() => new Date()))();
    const week = mondayDate(now, env.WEEKLY_REMINDER_TIMEZONE || "Europe/Bucharest");
    if (!week) return json({ status: "not_monday" });
    const repo = dependencies.repository ?? storeRepository;
    const attempted = new Set<string>();
    const started = Date.now();
    // Bound each invocation; leases and provider idempotency protect repeated calls.
    while (Date.now() - started < 60000) {
      const delivery = await repo.claim(week, now);
      if (!delivery) break;
      if (attempted.has(delivery.userId)) {
        await repo.finish(delivery, false);
        break;
      }
      attempted.add(delivery.userId);
      if (!(await repo.current(delivery))) {
        await repo.finish(delivery, false);
        continue;
      }
      let success = false;
      try {
        const key = createHash("sha256")
          .update(`${delivery.userId}:${delivery.subscriptionId}:${week}`)
          .digest("hex");
        const response = await (dependencies.fetcher ?? fetch)("https://api.resend.com/emails", {
          method: "POST",
          redirect: "error",
          signal: AbortSignal.timeout(12000),
          headers: {
            Authorization: `Bearer ${env.RESEND_API_KEY}`,
            "Content-Type": "application/json",
            "Idempotency-Key": `marketingpilot-weekly/${key}`,
          },
          body: JSON.stringify(reminderEmail(delivery, env)),
        });
        if (!response.ok) throw new Error();
        success = true;
        sent++;
      } catch {
        failed++;
      }
      await repo.finish(delivery, success);
      // On failure, leave other users for a fresh invocation rather than tight retries.
      if (!success) break;
    }
    const pending = await repo.pending(week);
    console.info(
      JSON.stringify({
        event: "WEEKLY_REMINDERS_COMPLETE",
        sent,
        failed,
        pending,
        at: now.toISOString(),
      }),
    );
    return json(
      { status: pending ? "retry_required" : "checked", sent, failed },
      failed || pending ? 503 : 200,
    );
  } catch {
    console.error(
      JSON.stringify({ event: "WEEKLY_REMINDERS_FAILED", at: new Date().toISOString() }),
    );
    return json({ error: "Az emlékeztetőt most nem sikerült elküldeni.", sent, failed }, 503);
  }
}
