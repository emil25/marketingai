import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, Outlet, useLocation, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CalendarDays, Loader2, Megaphone, Plus, Sparkles, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/app-chrome";
import { getWorkspace } from "@/lib/workspace.functions";
import {
  createCampaignAndPlan,
  deleteCampaign,
  getCampaigns,
  type CampaignSnapshot,
} from "@/lib/campaign.functions";
import type { PostPlatform } from "@/lib/data-model";
import { WeeklyMarketingForm } from "@/components/weekly-marketing-form";
import { toast } from "sonner";

export const Route = createFileRoute("/app/campaigns")({
  validateSearch: (search: Record<string, unknown>): { mode?: "weekly" } => ({
    mode: search.mode === "weekly" ? "weekly" : undefined,
  }),
  loader: async () => ({ workspace: await getWorkspace(), campaigns: await getCampaigns() }),
  component: Campaigns,
});

const CHANNELS: Array<{ id: PostPlatform; label: string }> = [
  { id: "facebook", label: "Facebook" },
  { id: "instagram", label: "Instagram" },
  { id: "tiktok", label: "TikTok" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "youtube", label: "YouTube" },
  { id: "google-business", label: "Google Business" },
];
const STATUS_LABELS = {
  draft: "Piszkozat",
  planning: "Tervezés alatt",
  active: "Aktív",
  paused: "Szüneteltetve",
  completed: "Lezárva",
  archived: "Archiválva",
} as const;
function dateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}
function campaignDateLabel(value: string) {
  const date = new Date(`${value}T12:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(date.getTime()) ||
    dateInput(date) !== value
  )
    return "Dátum megadása szükséges";
  return date.toLocaleDateString("hu-HU", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}
function initialForm() {
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Bucharest" }).format(
    new Date(),
  );
  const start = new Date(`${today}T12:00:00Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 29);
  return {
    name: "",
    objective: "",
    audience: "",
    offer: "",
    description: "",
    startDate: dateInput(start),
    endDate: dateInput(end),
    timezone: "Europe/Bucharest",
    budget: "",
    successCriteria: "",
    channels: ["facebook", "instagram"] as PostPlatform[],
    cta: "",
  };
}

function Campaigns() {
  const data = Route.useLoaderData();
  const { mode } = Route.useSearch();
  const router = useRouter();
  const create = useServerFn(createCampaignAndPlan);
  const remove = useServerFn(deleteCampaign);
  const location = useLocation();
  const [form, setForm] = useState(initialForm);
  const [showForm, setShowForm] = useState(data.campaigns.length === 0);
  const [pending, setPending] = useState(false);
  const [weeklyPending, setWeeklyPending] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const startDateRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!data.campaigns.length) setShowForm(true);
  }, [data.campaigns.length]);
  if (location.pathname.startsWith("/app/campaigns/")) return <Outlet />;
  const brand = data.workspace.activeBrand;
  if (!brand)
    return (
      <Card className="v2-empty-state rounded-3xl p-10 text-center">
        <Megaphone className="mx-auto h-8 w-8 text-brand" />
        <h2 className="mt-3 text-lg font-semibold">Még nincs aktív márkád</h2>
        <p className="mx-auto mt-1 max-w-lg text-sm text-muted-foreground">
          Kampányterv csak mentett márka és Brand Voice alapján készíthető.
        </p>
        <Link to="/app/brand">
          <Button className="mt-5 rounded-full">Márka beállítása</Button>
        </Link>
      </Card>
    );
  function update(key: keyof ReturnType<typeof initialForm>, value: string | PostPlatform[]) {
    setForm((current) => ({ ...current, [key]: value }) as ReturnType<typeof initialForm>);
  }
  function toggleChannel(channel: PostPlatform) {
    update(
      "channels",
      form.channels.includes(channel)
        ? form.channels.filter((item) => item !== channel)
        : [...form.channels, channel],
    );
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !form.channels.length) return;
    setPending(true);
    try {
      await create({ data: { ...form, budget: form.budget.trim() ? Number(form.budget) : null } });
      toast.success("A kampány és a 30 napos AI-terv elkészült.");
      await router.invalidate();
      setShowForm(false);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Nem sikerült kampánytervet készíteni.");
    } finally {
      setPending(false);
    }
  }
  async function removeCampaign(id: string) {
    if (
      !window.confirm(
        "Törlöd a kampányt és a hozzá tartozó tervtételeket? A már elkészült posztok megmaradnak.",
      )
    )
      return;
    try {
      await remove({ data: { campaignId: id } });
      await router.invalidate();
      toast.success("Kampány törölve.");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Nem sikerült törölni a kampányt.");
    }
  }
  return (
    <div className="space-y-8">
      <PageHeader
        title={showForm || mode === "weekly" ? "Új kampány" : "Kampányaid"}
        sub="Válassz 7 napos posztcsomagot vagy 30 napos tartalomtervet a vállalkozásodnak."
        action={
          <Button
            variant="outline"
            className="rounded-full"
            disabled={pending || weeklyPending}
            onClick={async () => {
              if (mode === "weekly") {
                setShowForm(false);
                await router.navigate({ to: "/app/campaigns", search: {} });
              } else setShowForm((value) => !value);
            }}
          >
            <Plus className="mr-1 h-4 w-4" />
            {showForm || mode === "weekly" ? "Kampánylista" : "Új kampány"}
          </Button>
        }
      />
      {(showForm || mode === "weekly") && (
        <fieldset className="campaign-duration" disabled={pending || weeklyPending}>
          <legend>Időtartam</legend>
          <div className="flex flex-wrap gap-2">
            {([7, 30] as const).map((days) => (
              <Button
                key={days}
                type="button"
                variant={(mode === "weekly" ? 7 : 30) === days ? "default" : "outline"}
                aria-pressed={(mode === "weekly" ? 7 : 30) === days}
                onClick={async () => {
                  setShowForm(true);
                  await router.navigate({
                    to: "/app/campaigns",
                    search: days === 7 ? { mode: "weekly" } : {},
                  });
                }}
              >
                {days} nap
              </Button>
            ))}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {mode === "weekly"
              ? "4 poszt szövege is elkészül, piszkozatként. Közzététel előtt ellenőrizheted őket."
              : "A kampány és a 30 napos terv készül el. A posztokat a tervből külön kérheted le."}
          </p>
        </fieldset>
      )}
      {mode === "weekly" && (
        <WeeklyMarketingForm brandName={brand.name} onPendingChange={setWeeklyPending} />
      )}
      {showForm && mode !== "weekly" && (
        <Card className="v2-feature-card campaign-form-card rounded-3xl border-0 p-6 md:p-8">
          <div className="mb-6 flex items-start gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-soft text-brand">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">30 napos kampányterv</h2>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Az ajánlatodból elkészül a kampány és a 30 napos terv. A posztokat a tervből külön
                kérheted le.
              </p>
            </div>
          </div>
          <form onSubmit={submit} className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="campaign-name">Kampány neve</Label>
                <Input
                  className="mt-2"
                  required
                  id="campaign-name"
                  value={form.name}
                  onChange={(event) => update("name", event.target.value)}
                  placeholder="Pl. tavaszi ajánlat"
                />
              </div>
              <div>
                <Label htmlFor="campaign-objective">Kampány célja</Label>
                <Input
                  className="mt-2"
                  required
                  id="campaign-objective"
                  value={form.objective}
                  onChange={(event) => update("objective", event.target.value)}
                  placeholder="Pl. érdeklődőszerzés"
                />
              </div>
              <div>
                <Label htmlFor="campaign-offer">Ajánlat</Label>
                <Textarea
                  id="campaign-offer"
                  required
                  className="mt-2 min-h-24"
                  value={form.offer}
                  onChange={(event) => update("offer", event.target.value)}
                  placeholder="Mit szeretnél kommunikálni?"
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
              <span>
                {campaignDateLabel(form.startDate)} – {campaignDateLabel(form.endDate)} ·{" "}
                {form.channels
                  .map((id) => CHANNELS.find((channel) => channel.id === id)?.label)
                  .join(", ") || "Válassz csatornát a részleteknél."}
              </span>
              <button
                type="button"
                className="font-semibold text-brand underline underline-offset-4"
                aria-controls="campaign-details"
                aria-expanded={detailsOpen}
                onClick={() => {
                  setDetailsOpen(true);
                  requestAnimationFrame(() => startDateRef.current?.focus());
                }}
              >
                Dátum és csatornák módosítása
              </button>
              <p className="w-full">A mentett márkaprofilodat automatikusan használjuk.</p>
            </div>
            <details
              id="campaign-details"
              className="workspace-details"
              open={detailsOpen}
              onToggle={(event) => setDetailsOpen(event.currentTarget.open)}
            >
              <summary>Részletek — opcionális</summary>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <Label>Célközönség</Label>
                  <Textarea
                    className="mt-2 min-h-24"
                    value={form.audience}
                    onChange={(event) => update("audience", event.target.value)}
                    placeholder="Az aktív márka közönsége alapértelmezett."
                  />
                </div>
                <div>
                  <Label>Leírás / brief</Label>
                  <Textarea
                    className="mt-2 min-h-24"
                    value={form.description}
                    onChange={(event) => update("description", event.target.value)}
                    placeholder="További kampánykontekstus…"
                  />
                </div>
                <div>
                  <Label>Sikerfeltétel</Label>
                  <Textarea
                    className="mt-2 min-h-24"
                    value={form.successCriteria}
                    onChange={(event) => update("successCriteria", event.target.value)}
                    placeholder="Pl. több ajánlatkérés"
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <Label htmlFor="campaign-start">Kezdés</Label>
                  <Input
                    id="campaign-start"
                    ref={startDateRef}
                    type="date"
                    className="mt-2"
                    value={form.startDate}
                    onChange={(event) => update("startDate", event.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="campaign-end">Befejezés</Label>
                  <Input
                    id="campaign-end"
                    type="date"
                    className="mt-2"
                    value={form.endDate}
                    onChange={(event) => update("endDate", event.target.value)}
                  />
                </div>
                <div>
                  <Label>Tervezett költségkeret (RON, opcionális)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    className="mt-2"
                    value={form.budget}
                    onChange={(event) => update("budget", event.target.value)}
                    placeholder="0"
                  />
                </div>
              </div>
              <div>
                <Label>Csatornák</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {CHANNELS.map((channel) => (
                    <button
                      type="button"
                      key={channel.id}
                      aria-pressed={form.channels.includes(channel.id)}
                      onClick={() => toggleChannel(channel.id)}
                    >
                      <Badge
                        variant={form.channels.includes(channel.id) ? "default" : "outline"}
                        className="rounded-full"
                      >
                        {channel.label}
                      </Badge>
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  A terv csak a kiválasztott csatornákra készít tételeket.
                </p>
              </div>
              <div>
                <Label>Cselekvésre hívás (opcionális)</Label>
                <Input
                  className="mt-2"
                  value={form.cta}
                  onChange={(event) => update("cta", event.target.value)}
                  placeholder="Pl. Foglalj most, vagy írj nekünk!"
                />
              </div>
            </details>
            <div className="flex justify-end">
              <Button
                type="submit"
                className="rounded-full"
                disabled={pending || !form.channels.length}
              >
                {pending ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-1 h-4 w-4" />
                )}
                {pending ? "AI-terv készül…" : "Kampányterv készítése"}
              </Button>
            </div>
          </form>
        </Card>
      )}
      <div className="space-y-4">
        {data.campaigns.length === 0 && !showForm ? (
          <Card className="v2-empty-state rounded-3xl p-10 text-center">
            <Megaphone className="mx-auto h-8 w-8 text-brand" />
            <h2 className="mt-3 text-lg font-semibold">Még nincs kampányod</h2>
            <Button className="mt-5 rounded-full" onClick={() => setShowForm(true)}>
              Első kampány létrehozása
            </Button>
          </Card>
        ) : (
          data.campaigns.map((campaign) => (
            <CampaignCard
              key={campaign.id}
              campaign={campaign}
              onRemove={() => void removeCampaign(campaign.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function CampaignCard({
  campaign,
  onRemove,
}: {
  campaign: CampaignSnapshot;
  onRemove: () => void;
}) {
  const progress =
    campaign.counts.planned > 0
      ? Math.round((campaign.counts.created / campaign.counts.planned) * 100)
      : 0;
  return (
    <Card className="v2-feature-card rounded-3xl border-0 p-5">
      <div className="grid gap-5 md:grid-cols-[190px_minmax(0,1fr)]">
        <div className="v2-campaign-visual flex min-h-44 flex-col justify-between rounded-2xl p-4 text-white">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold tracking-[0.16em] text-white/60">
              CAMPAIGN
            </span>
            <Sparkles className="h-4 w-4 text-white/70" />
          </div>
          <div>
            <div className="text-4xl font-bold">{campaign.name.slice(0, 1).toUpperCase()}</div>
            <div className="mt-1 truncate text-xs text-white/70">{campaign.objective}</div>
          </div>
        </div>
        <div>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <Link
                to="/app/campaigns/$id"
                params={{ id: campaign.id }}
                className="text-xl font-semibold hover:underline"
              >
                {campaign.name}
              </Link>
              <div className="mt-1 text-sm text-muted-foreground">
                {campaign.brandName} · {campaignDateLabel(campaign.startDate)} –{" "}
                {campaignDateLabel(campaign.endDate)}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                className="rounded-full"
                variant={campaign.status === "active" ? "default" : "secondary"}
              >
                {STATUS_LABELS[campaign.status as keyof typeof STATUS_LABELS]}
              </Badge>
              <Button
                size="icon"
                variant="ghost"
                className="rounded-full text-destructive"
                onClick={onRemove}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-4">
            <Metric label="Terv" value={campaign.counts.planned} />
            <Metric label="Elkészült" value={campaign.counts.created} />
            <Metric label="Piszkozat" value={campaign.counts.drafts} />
            <Metric label="Hátra" value={campaign.counts.remaining} />
          </div>
          <div className="mt-5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Haladás</span>
              <span>{progress}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary via-sky-400 to-orange-400 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {campaign.channels.map((channel: PostPlatform) => (
              <Badge key={channel} variant="outline" className="rounded-full">
                {CHANNELS.find((item) => item.id === channel)?.label ?? channel}
              </Badge>
            ))}
            <Link
              to="/app/planner"
              className="ml-auto text-sm font-semibold text-primary hover:underline"
            >
              <CalendarDays className="mr-1 inline h-4 w-4" />
              Terv megnyitása
            </Link>
          </div>
        </div>
      </div>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-secondary/50 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  );
}
