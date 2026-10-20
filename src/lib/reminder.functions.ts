import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuthContext } from "./server/auth-context.server";
import { transact } from "./server/store.server";
import { consumeAuthLimit } from "./server/auth-security.server";
import {
  reminderAvailable,
  readReminderToken,
  setReminderPreference,
  unsubscribeReminder,
} from "./server/weekly-reminder.server";

export const getReminderPreference = createServerFn({ method: "GET" }).handler(async () => {
  const context = await requireAuthContext();
  const { readData } = await import("./server/store.server");
  const user = (await readData()).users.find((u) => u.id === context.user.id);
  return {
    enabled: user?.auth?.weeklyReminder?.enabled === true,
    available: reminderAvailable(process.env),
  };
});
export const saveReminderPreference = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ enabled: z.boolean() }).strict().parse(data))
  .handler(async ({ data }) => {
    const context = await requireAuthContext();
    if (data.enabled && !reminderAvailable(process.env))
      throw new Error("A heti e-mailes emlékeztető még nincs bekapcsolva.");
    await transact((db) => {
      const user = db.users.find((u) => u.id === context.user.id);
      if (!user) throw new Error("Jelentkezz be újra a beállítás mentéséhez.");
      setReminderPreference(user, data.enabled);
    });
    return { enabled: data.enabled };
  });
export const unsubscribeWeeklyReminder = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({ token: z.string().min(1).max(512) })
      .strict()
      .parse(data),
  )
  .handler(async ({ data }) => {
    const parsed = readReminderToken(data.token, process.env.SESSION_SECRET || "");
    if (!parsed)
      throw new Error(
        "Ez a leiratkozási hivatkozás nem érvényes. A Vállalkozásom oldalon is kikapcsolhatod az emlékeztetőt.",
      );
    await consumeAuthLimit(`weekly-unsubscribe:${parsed.userId}`, 10, 15);
    const ok = await transact((db) =>
      unsubscribeReminder(
        db.users.find((u) => u.id === parsed.userId),
        parsed.subscriptionId,
      ),
    );
    if (!ok)
      throw new Error(
        "Ez a hivatkozás már nem érvényes. A Vállalkozásom oldalon kikapcsolhatod az emlékeztetőt.",
      );
    return { ok: true };
  });
