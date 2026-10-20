import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/cron/ai-monitor")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { handleOperationsMonitor } = await import("@/lib/server/operations-monitor.server");
        const monitor = await handleOperationsMonitor(request);
        if (monitor.status === 401 || monitor.status === 405) return monitor;
        const { handleWeeklyReminders } = await import("@/lib/server/weekly-reminder.server");
        // The monitor failing must not silently prevent opted-in reminders.
        const reminders = await handleWeeklyReminders(request);
        return Response.json(
          { monitor: await monitor.json(), reminders: await reminders.json() },
          {
            status: monitor.ok && reminders.ok ? 200 : 503,
            headers: { "Cache-Control": "no-store" },
          },
        );
      },
    },
  },
});
