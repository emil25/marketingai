import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createWeeklyMarketingPlan, createMissingPlanItemPost } from "@/lib/campaign.functions";
import type { PostPlatform } from "@/lib/data-model";

const channels: Array<[PostPlatform, string]> = [
  ["facebook", "Facebook"],
  ["instagram", "Instagram"],
  ["linkedin", "LinkedIn"],
  ["google-business", "Google Cégprofil"],
];
export function WeeklyMarketingForm({
  brandName,
  onPendingChange,
}: {
  brandName: string;
  onPendingChange?: (pending: boolean) => void;
}) {
  const router = useRouter();
  const create = useServerFn(createWeeklyMarketingPlan);
  const generate = useServerFn(createMissingPlanItemPost);
  const [brief, setBrief] = useState("");
  const [startDate, setStartDate] = useState(() =>
    new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Bucharest" }).format(new Date()),
  );
  const [platforms, setPlatforms] = useState<PostPlatform[]>(["facebook", "instagram"]);
  const [pending, setPending] = useState(false);
  const [progress, setProgress] = useState("");
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    onPendingChange?.(true);
    setProgress("A heti terv készül…");
    try {
      const campaign = await create({ data: { brief, startDate, channels: platforms } });
      let failed = 0;
      for (const [index, item] of campaign.planItems.entries()) {
        setProgress(`Posztszövegek készülnek: ${index + 1}/${campaign.planItems.length}`);
        try {
          await generate({ data: { planItemId: item.id } });
        } catch {
          failed++;
        }
      }
      if (failed) toast.error(`${failed} poszt nem készült el. A mentett tervnél újrapróbálhatod.`);
      else toast.success("A heti tartalmaid elkészültek. Ellenőrizd őket közzététel előtt.");
      await router.invalidate();
      await router.navigate({ to: "/app/campaigns/$id", params: { id: campaign.id } });
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : "Nem sikerült elkészíteni a heti tervet.",
      );
    } finally {
      setPending(false);
      onPendingChange?.(false);
      setProgress("");
    }
  }
  return (
    <Card className="v2-feature-card rounded-3xl border-0 p-6 md:p-8">
      <h2 className="text-xl font-semibold">Készítsd el a heti marketingemet</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {brandName} márkahangjával 4 különböző poszt készül a következő 7 napra. Egy kérés, kész
        szövegek, közös ellenőrzés.
      </p>
      <form onSubmit={submit} className="mt-5 space-y-4">
        <label className="block font-medium" htmlFor="weekly-brief">
          Mit szeretnél népszerűsíteni ezen a héten?
        </label>
        <Textarea
          id="weekly-brief"
          required
          minLength={10}
          maxLength={4000}
          disabled={pending}
          value={brief}
          onChange={(event) => setBrief(event.target.value)}
          placeholder="Például: szeretném bemutatni az új szolgáltatásunkat, és több érdeklődőt szerezni a környékről."
          className="min-h-28"
        />
        <div className="flex flex-wrap items-end gap-5">
          <div>
            <label htmlFor="weekly-start" className="text-sm font-medium">
              A hét kezdete
            </label>
            <Input
              id="weekly-start"
              type="date"
              required
              disabled={pending}
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="mt-2"
            />
          </div>
          <fieldset disabled={pending}>
            <legend className="text-sm font-medium">Melyik csatornákra készüljön?</legend>
            <div className="mt-2 flex flex-wrap gap-3">
              {channels.map(([id, label]) => (
                <label key={id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={platforms.includes(id)}
                    onChange={(event) =>
                      setPlatforms((current) =>
                        event.target.checked
                          ? [...current, id]
                          : current.filter((platform) => platform !== id),
                      )
                    }
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
        <p className="text-sm text-muted-foreground">
          A posztok piszkozatként mentődnek, és megjelennek a Plannerben és a Naptárban. Saját képet
          a poszt szerkesztőjében adhatsz hozzá. Ez a lépés nem publikál automatikusan.
        </p>
        <Button
          disabled={pending || !platforms.length || brief.trim().length < 10}
          type="submit"
          className="rounded-full"
        >
          {pending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="mr-2 h-4 w-4" />
          )}
          {pending ? progress : "Heti marketing elkészítése"}
        </Button>
        {pending && (
          <p role="status" className="text-sm text-muted-foreground">
            Kérlek, hagyd nyitva az oldalt. A már elkészült tartalmak biztonságosan mentődnek.
          </p>
        )}
      </form>
    </Card>
  );
}
