import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useRouter } from "@tanstack/react-router";
import {
  getCampaignAttempts,
  retryCampaignAttempt,
  createMissingPlanItemPost,
} from "@/lib/campaign.functions";
import { Button } from "./ui/button";
import { toast } from "sonner";
export function CampaignAttempts({
  attempts,
}: {
  attempts: Awaited<ReturnType<typeof getCampaignAttempts>>;
}) {
  const retry = useServerFn(retryCampaignAttempt);
  const router = useRouter();
  const generate = useServerFn(createMissingPlanItemPost);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState("");
  if (!attempts.length) return null;
  return (
    <section aria-label="Generálási kísérletek" className="space-y-3">
      <h2 className="font-semibold">Folyamatban lévő és megszakadt generálások</h2>
      {attempts.map((attempt) => (
        <div
          key={attempt.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4"
        >
          <div className="min-w-0 flex-1">
            <h3 className="break-words font-semibold">{attempt.name}</h3>
            <p className="text-sm">
              {attempt.status === "running" ? "Terv készül…" : "Nem sikerült"} ·{" "}
              {attempt.completedWeeks} hét piszkozata megőrizve
            </p>
            {attempt.status === "failed" && (
              <p className="mt-1 text-sm text-muted-foreground">{attempt.error}</p>
            )}
          </div>
          <Button
            variant="outline"
            disabled={!!pending || attempt.status === "running"}
            onClick={async () => {
              setPending(attempt.id);
              setError("");
              let navigated = false;
              try {
                const campaign = await retry({ data: { attemptId: attempt.id } });
                if (attempt.days === 7) {
                  let failed = 0;
                  for (const item of campaign.planItems) {
                    try {
                      await generate({ data: { planItemId: item.id } });
                    } catch {
                      failed++;
                    }
                  }
                  if (failed)
                    toast.error(
                      `${failed} poszt nem készült el. A mentett tervnél újrapróbálhatod.`,
                    );
                }
                await router.navigate({ to: "/app/campaigns/$id", params: { id: campaign.id } });
                navigated = true;
              } catch (cause) {
                setError(cause instanceof Error ? cause.message : "A generálás nem sikerült.");
              } finally {
                setPending(null);
                if (!navigated) await router.invalidate();
              }
            }}
          >
            {pending === attempt.id ? "Újrapróbálás…" : "Újrapróbálom"}
          </Button>
        </div>
      ))}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
