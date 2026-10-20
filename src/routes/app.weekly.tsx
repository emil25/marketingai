import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { getWorkspace } from "@/lib/workspace.functions";
import {
  getPlanner,
  getCampaigns,
  createWeeklyMarketingPlan,
  createMissingPlanItemPost,
  getCampaignAttempts,
  retryCampaignAttempt,
} from "@/lib/campaign.functions";
import { getPosts } from "@/lib/post.functions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { postCopyText } from "@/lib/post-editor";
import { contentPlaceholders } from "@/lib/content-quality";
import { toast } from "sonner";
import { copyText } from "@/lib/clipboard";
import { mainChannel } from "@/lib/main-channel";
import { useUiMode } from "@/components/ui-mode";
import { getIdeaBank, refreshIdeaBank } from "@/lib/idea-bank.functions";
export const Route = createFileRoute("/app/weekly")({
  loader: async () => ({
    workspace: await getWorkspace(),
    campaigns: await getCampaigns(),
    items: await getPlanner({ data: {} }),
    posts: await getPosts(),
    attempts: await getCampaignAttempts(),
    ideaBank: await getIdeaBank(),
  }),
  component: WeeklyPage,
});
function WeeklyPage() {
  const data = Route.useLoaderData();
  const { mode } = useUiMode();
  const brand = data.workspace.activeBrand;
  const router = useRouter();
  const create = useServerFn(createWeeklyMarketingPlan);
  const generate = useServerFn(createMissingPlanItemPost);
  const retry = useServerFn(retryCampaignAttempt);
  const loadAttempts = useServerFn(getCampaignAttempts);
  const refreshIdeas = useServerFn(refreshIdeaBank);
  const [ideaBank, setIdeaBank] = useState(data.ideaBank.bank);
  const [ideaBankNeedsRefresh, setIdeaBankNeedsRefresh] = useState(data.ideaBank.needsRefresh);
  const [ideaBankBusy, setIdeaBankBusy] = useState(false);
  const [ideaBankError, setIdeaBankError] = useState("");
  const [failedAttemptId, setFailedAttemptId] = useState<string>();
  const [idea, setIdea] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");
  const lock = useRef(false);
  const campaign = data.campaigns
    .filter(
      (c) =>
        c.brandId === brand?.id &&
        Math.round((Date.parse(c.endDate) - Date.parse(c.startDate)) / 86400000) === 6,
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const items = data.items.filter(
    (i) => i.brandId === brand?.id && i.campaignId === campaign?.id && i.status !== "skipped",
  );
  const attempt = data.attempts.find(
    (a) =>
      a.days === 7 && a.brandId === brand?.id && (!campaign || a.createdAt > campaign.createdAt),
  );
  async function make(retryId?: string) {
    if (!brand || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setProgress("Készül a heti terved…");
    try {
      const result = retryId
        ? await retry({ data: { attemptId: retryId } })
        : await create({
            data: {
              requestId: crypto.randomUUID(),
              brief:
                idea.trim().length >= 10
                  ? idea.trim()
                  : `A ${brand.name} ismert termékeinek és szolgáltatásainak bemutatása ezen a héten. ${idea.trim()}`,
              startDate: new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Bucharest" }).format(
                new Date(),
              ),
              channels: [mainChannel(brand.profile)],
            },
          });
      setFailedAttemptId(undefined);
      let failed = 0;
      for (const [index, item] of result.planItems.entries()) {
        setProgress(`Posztszövegek készülnek: ${index + 1}/${result.planItems.length}`);
        try {
          await generate({ data: { planItemId: item.id } });
        } catch {
          failed++;
        }
      }
      if (failed)
        setError(
          `${failed} szöveg még nem készült el. A terv megmaradt; a kártyán újrapróbálhatod.`,
        );
      await router.invalidate();
    } catch (cause) {
      const latest = await loadAttempts().catch(() => []);
      setFailedAttemptId(latest.find((a) => a.brandId === brand.id && a.days === 7)?.id);
      setError(
        cause instanceof Error ? cause.message : "A terv most nem készült el. Próbáld újra.",
      );
      await router.invalidate();
    } finally {
      lock.current = false;
      setBusy(false);
      setProgress("");
    }
  }
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Card className="border-emerald-900/10 bg-emerald-50/60 p-4" aria-label="Heti ritmus tipp">
        <h2 className="font-semibold">Heti ritmus</h2>
        <p className="mt-1 text-sm">Elég hetente 3 poszt. A rendszeresség fontosabb, mint a mennyiség.</p>
      </Card>
      {mode === "detailed" && (
        <Card className="p-5 md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">Ötletbank</h2>
              <p className="mt-1 text-sm text-muted-foreground">Húsz témaötlet a vállalkozásodhoz és a célközönségedhez. Egyszer készül el, és itt marad elmentve.</p>
            </div>
            <Button variant="outline" className="min-h-11" disabled={ideaBankBusy} onClick={async () => {
              setIdeaBankBusy(true);
              setIdeaBankError("");
              try {
                const result = await refreshIdeas({ data: { force: Boolean(ideaBank) || ideaBankNeedsRefresh } });
                setIdeaBank(result.bank);
                setIdeaBankNeedsRefresh(false);
              } catch (cause) {
                setIdeaBankError(cause instanceof Error ? cause.message : "Az ötletbank most nem készült el.");
              } finally {
                setIdeaBankBusy(false);
              }
            }}>{ideaBankBusy ? "Készül…" : ideaBank ? "Ötletbank frissítése" : "Ötletbank készítése"}</Button>
          </div>
          {ideaBankError && <p className="mt-3 text-sm text-destructive" role="alert">{ideaBankError}</p>}
          {ideaBankNeedsRefresh && <p className="mt-3 text-sm text-amber-900">A vállalkozástípus vagy a célközönség megváltozott. Frissítsd az ötleteket.</p>}
          {ideaBank && !ideaBankNeedsRefresh && <ol className="mt-4 grid list-inside list-decimal gap-x-6 gap-y-2 sm:grid-cols-2">{ideaBank.ideas.map((entry, index) => <li key={`${index}-${entry}`} className="rounded-lg bg-secondary/30 p-2">{entry}</li>)}</ol>}
        </Card>
      )}
      <Card className="p-5 md:p-8">
        <h1 className="text-2xl font-semibold">Heti terv</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          3–4 posztötlet és szöveg a vállalkozásodhoz. Közzététel előtt nézd át őket.
        </p>
        <form
          className="mt-5 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void make();
          }}
        >
          <label className="block" htmlFor="easy-week-idea">
            Van valami különleges ezen a héten?{" "}
            <span className="text-sm text-muted-foreground">(nem kötelező)</span>
          </label>
          <Input
            id="easy-week-idea"
            value={idea}
            disabled={busy}
            maxLength={3500}
            onChange={(e) => setIdea(e.target.value)}
            placeholder="Például: új termék vagy hétvégi ajánlat"
          />
          <Button
            className="w-full sm:w-auto"
            disabled={
              busy ||
              !brand ||
              (data.workspace.user.emailVerified === false &&
                data.workspace.user.canUseAi !== true) ||
              attempt?.status === "running"
            }
          >
            {busy ? "Készül…" : "Készíts tervet a hétre"}
          </Button>
        </form>
      </Card>
      {busy && <p role="status">{progress} Kérlek, hagyd nyitva az oldalt.</p>}
      {(error || attempt) && (
        <Card className="p-4">
          <p role="alert">
            {error ||
              (attempt?.status === "running"
                ? "A korábban elindított terved még készül."
                : "A korábbi terv nem készült el. A már elkészült részeket megőriztük.")}
          </p>
          {attempt?.status !== "running" && (
            <Button
              className="mt-2"
              variant="outline"
              disabled={busy}
              onClick={() => void make(failedAttemptId ?? attempt?.id)}
            >
              Újrapróbálom
            </Button>
          )}
        </Card>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {items.map((item) => {
          const post = data.posts.find((p) => p.id === item.postId);
          const variant = post?.variants.find((v) => v.platform === item.platform);
          const text = variant ? postCopyText(variant) : item.draftContent || "";
          return (
            <Card className="flex flex-col p-5" key={item.id}>
              <p className="text-sm text-muted-foreground">
                {new Date(`${item.date}T12:00:00`).toLocaleDateString("hu-HU", {
                  weekday: "long",
                  month: "short",
                  day: "numeric",
                })}
              </p>
              <h2 className="mt-2 text-lg font-semibold">{item.topic}</h2>
              <p className="mt-3 line-clamp-5 whitespace-pre-wrap break-words text-sm">
                {text || "Ehhez még szöveg készül."}
              </p>
              {contentPlaceholders(text).length > 0 && (
                <p className="mt-2 text-sm text-amber-900">Hiányzó adatok várnak kitöltésre.</p>
              )}
              <div className="mt-auto flex flex-wrap gap-2 pt-4">
                {post ? (
                  <>
                    <Link to="/app/posts/$id" params={{ id: post.id }}>
                      <Button variant="outline">Megnyitás és szerkesztés</Button>
                    </Link>
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={async () => {
                        if (contentPlaceholders(text).length) {
                          toast.error("Előbb töltsd ki a hiányzó adatokat a posztban.");
                          return;
                        }
                        try {
                          await copyText(text);
                          toast.success("Szöveg kimásolva.");
                        } catch {
                          toast.error("Nem sikerült másolni. Nyisd meg a posztot.");
                        }
                      }}
                    >
                      Másolás
                    </Button>
                  </>
                ) : (
                  <Button
                    disabled={busy}
                    variant="outline"
                    onClick={async () => {
                      if (lock.current) return;
                      lock.current = true;
                      setBusy(true);
                      try {
                        await generate({ data: { planItemId: item.id } });
                        await router.invalidate();
                      } catch (cause) {
                        setError(
                          cause instanceof Error
                            ? cause.message
                            : "Nem sikerült a szöveg elkészítése.",
                        );
                      } finally {
                        lock.current = false;
                        setBusy(false);
                      }
                    }}
                  >
                    Szöveg elkészítése / újrapróbálás
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
