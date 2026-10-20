import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getCampaignGenerationProgress } from "./campaign.functions";

/** Poll persisted server progress; never advance a simulated percentage. */
export function useCampaignProgress() {
  const read = useServerFn(getCampaignGenerationProgress);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  useEffect(() => {
    if (!requestId) return;
    let disposed = false;
    let busy = false;
    const poll = async () => {
      if (busy || disposed) return;
      busy = true;
      try {
        const progress = await read({ data: { requestId } });
        if (!disposed && progress)
          setLabel(
            progress.status === "failed"
              ? `${progress.completedWeeks} hét piszkozata megőrizve; a generálás megállt.`
              : progress.completedWeeks >= progress.totalWeeks
                ? "Minden hét kész, mentés…"
                : `${progress.completedWeeks ? `${progress.completedWeeks}. hét kész, ` : ""}${progress.completedWeeks + 1}. hét generálása…`,
          );
      } catch {
        /* The primary mutation reports errors; a temporary poll failure is not success. */
      } finally {
        busy = false;
      }
    };
    void poll();
    const timer = setInterval(() => void poll(), 1500);
    return () => {
      disposed = true;
      clearInterval(timer);
    };
  }, [requestId, read]);
  return {
    label,
    begin: () => {
      const id = crypto.randomUUID();
      setLabel("1. hét generálása…");
      setRequestId(id);
      return id;
    },
    end: () => setRequestId(null),
  };
}
