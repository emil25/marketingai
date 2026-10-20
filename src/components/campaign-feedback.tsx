import { useEffect, useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { retryCampaignPlan, type CampaignSnapshot } from "@/lib/campaign.functions";
import { Button } from "@/components/ui/button";
import { Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";

export function CampaignFeedback({ campaign }: { campaign: CampaignSnapshot }) {
  const retry = useServerFn(retryCampaignPlan);
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (campaign.generation?.status !== "running") return;
    const timer = window.setInterval(() => {
      void router.invalidate().catch(() => undefined);
    }, 10_000);
    return () => window.clearInterval(timer);
  }, [campaign.generation?.status, router]);
  async function retryPlan() {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      await retry({ data: { campaignId: campaign.id } });
      toast.success("A kampányterv elkészült. A posztokat a tervből készítheted el.");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "A generálás nem sikerült. Próbáld újra később.",
      );
    } finally {
      setPending(false);
      await router.invalidate();
    }
  }
  const blocked = campaign.contentBlockers;
  const missing = [
    ...new Set(blocked.flatMap((item) => item.missing.map((value) => value.slice(1, -1)))),
  ];
  if (!campaign.generation && !blocked.length && campaign.status !== "paused") return null;
  return (
    <div className="campaign-feedback space-y-3">
      {campaign.generation && (
        <div className="rounded-xl border bg-secondary/30 p-3 text-sm">
          <strong>
            {pending || campaign.generation.status === "running"
              ? "A kampányterv készül…"
              : "Nem sikerült elkészíteni a kampánytervet."}
          </strong>
          <p className="mt-1">
            A megadott adatok és az elkészült hetek megmaradtak. Az újrapróbálás ezt a kampányt
            folytatja.
          </p>
          {campaign.generation.status === "failed" && (
            <Button
              type="button"
              variant="outline"
              className="campaign-submit mt-3"
              disabled={pending}
              onClick={() => void retryPlan()}
            >
              {pending ? <Loader2 className="animate-spin" /> : <RotateCcw />}
              {pending ? "Újrapróbálás…" : "Újrapróbálom"}
            </Button>
          )}
          {error && (
            <p role="alert" className="mt-2 text-destructive">
              {error}
            </p>
          )}
        </div>
      )}
      {blocked.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
          <Link
            to="/app/posts/$id"
            params={{ id: blocked[0].postId }}
            hash={`review-${blocked[0].platform}`}
            className="font-medium underline underline-offset-4"
          >
            {blocked.length} poszt vár kitöltésre. Hiányzó adat: {missing.join(", ")} →
          </Link>
          <p className="mt-1">
            Ütemezés előtt töltsd ki a hiányzó adatokat, majd mentsd a posztot.
          </p>
        </div>
      )}
      {campaign.status === "paused" && (
        <p className="text-sm text-muted-foreground">
          {blocked.length
            ? "A hiányzó adatok pótlása után a kampány szüneteltetését is fel kell oldanod. "
            : "A kampány mentett állapota szüneteltetett; külön ok nincs megadva. "}
          <Link
            to="/app/campaigns/$id"
            params={{ id: campaign.id }}
            hash="campaign-status"
            className="font-medium underline underline-offset-4"
          >
            Folytatás: válaszd az Aktív állapotot →
          </Link>
        </p>
      )}
    </div>
  );
}
