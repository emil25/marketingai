import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app-chrome";
import { getWorkspace } from "@/lib/workspace.functions";
import { getAnalytics, type AnalyticsDays, type AnalyticsMetric, type AnalyticsResult } from "@/lib/analytics.functions";
import { BarChart3, ChevronRight, Radio, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/analytics")({ loader: async () => ({ workspace: await getWorkspace(), analytics: await getAnalytics({ data: { days: 30 } }) }), component: Analytics });

const METRIC_LABELS: Record<AnalyticsMetric, string> = { impressions: "Megjelenések", reach: "Elérés", engagement: "Engagement", clicks: "Kattintások", likes: "Kedvelések", comments: "Kommentek", shares: "Megosztások", saves: "Mentések", videoViews: "Videómegtekintések" };
const PRIMARY_METRICS: AnalyticsMetric[] = ["impressions", "reach", "engagement", "clicks"];
const PERIODS: AnalyticsDays[] = [7, 30, 90];

function formatMetric(value: number) {
  return new Intl.NumberFormat("hu-HU", { notation: value > 9999 ? "compact" : "standard", maximumFractionDigits: 1 }).format(value);
}

function Analytics() {
  const loaded = Route.useLoaderData();
  const data = loaded.workspace;
  const brand = data.activeBrand;
  const get = useServerFn(getAnalytics);
  const [days, setDays] = useState<AnalyticsDays>(30);
  const [result, setResult] = useState<AnalyticsResult>(loaded.analytics);
  const [loading, setLoading] = useState(false);

  async function changePeriod(next: AnalyticsDays) {
    if (next === days || loading) return;
    setLoading(true);
    try {
      setResult(await get({ data: { days: next } }));
      setDays(next);
    }
    catch (cause) { toast.error(cause instanceof Error ? cause.message : "Nem sikerült betölteni a mérési adatokat."); }
    finally { setLoading(false); }
  }

  const hasData = result.dataSource.hasData;
  return <div className="space-y-6">
    <PageHeader title="Analytics" sub="Ellenőrizhető teljesítményadatok a kapcsolt csatornákból." action={<Link to="/app/channels"><Button variant="outline" className="tt-outline"><Radio className="mr-1 h-4 w-4" />Csatornák kezelése</Button></Link>} />
    <Card className="tt-onboarding rounded-2xl p-6 md:p-7"><div className="flex flex-wrap items-start justify-between gap-5"><div><div className="tt-eyebrow">MÉRÉSI KÖZPONT · VALÓDI ADATOK</div><h2 className="mt-3 font-display text-2xl font-extrabold tracking-tight">Lásd, mi mozgatja a márkádat.</h2><p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">Az Analytics kizárólag a kapcsolt csatornákból érkező mérési snapshotokra épül. A felület nem tölt ki hiányzó számokat.</p></div><div className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-soft text-primary"><BarChart3 className="h-6 w-6" /></div></div></Card>
    <Card className="tt-card p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><strong className="font-display text-sm">Időszak</strong><p className="mt-1 text-xs text-muted-foreground">{loading ? "Mérési adatok betöltése…" : `${result.dateFrom} – ${result.dateTo}`}</p></div><div className="flex rounded-lg border border-border bg-secondary/30 p-1" role="group" aria-label="Analytics időszak">{PERIODS.map((period) => <Button key={period} type="button" size="sm" variant={days === period ? "default" : "ghost"} className="rounded-md px-4 text-xs" onClick={() => void changePeriod(period)} disabled={loading}>{period} nap</Button>)}</div></div></Card>
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{PRIMARY_METRICS.map((metric) => <Metric key={metric} label={METRIC_LABELS[metric]} value={hasData ? formatMetric(result.totals[metric]) : null} detail={hasData ? `${result.dataSource.snapshotCount} szerveroldali snapshot` : "Mérési snapshot szükséges"} />)}</section>
    <Card className="tt-card p-6"><div className="tt-cardhead"><div><h2>Teljesítmény az elmúlt {days} napban</h2><p>{brand ? `${brand.name} · összes kapcsolt platform` : "Aktív márka nélkül nincs mérési kontextus."}</p></div><span className="tt-badge rounded-full px-2 py-1">{days} nap</span></div>{hasData ? <div className="mt-5 space-y-3"><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{Object.entries(result.totals).map(([metric, value]) => <div key={metric} className="rounded-xl border border-border bg-secondary/20 p-3"><small className="block text-xs text-muted-foreground">{METRIC_LABELS[metric as AnalyticsMetric]}</small><strong className="mt-1 block font-display text-lg">{formatMetric(value)}</strong></div>)}</div><p className="text-xs text-muted-foreground">Forrás: {result.dataSource.platforms.map((platform) => platform.replace("google-business", "Google Business")).join(", ")} · {result.dataSource.snapshotCount} snapshot.</p></div> : <div className="tt-empty mt-5 min-h-48 justify-center"><BarChart3 className="h-6 w-6 text-primary" /><strong className="mt-3 text-sm">Nincs mérési adat</strong><span className="mt-1 max-w-md text-center text-xs text-muted-foreground">A kiválasztott időszakban nincs szerveroldali metric snapshot. Kapcsolj csatornát, majd a platformból érkező valós adat tölti fel ezt a nézetet.</span><Link to="/app/channels" className="tt-link mt-3">Csatornák előkészítése <ChevronRight className="ml-0.5 inline h-3.5 w-3.5" /></Link></div>}</Card>
    {hasData && <Card className="tt-card p-6"><div className="tt-cardhead"><div><h2>Platformonként</h2><p>Az aktív brandhez tartozó snapshotok összesítése.</p></div></div><div className="mt-4 space-y-2">{result.byPlatform.map((entry) => <div key={entry.platform} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border px-3 py-3"><div><strong className="text-sm">{entry.platform.replace("google-business", "Google Business")}</strong><span className="ml-2 text-xs text-muted-foreground">{entry.snapshots} snapshot</span></div><div className="flex flex-wrap gap-3 text-xs text-muted-foreground">{PRIMARY_METRICS.map((metric) => <span key={metric}>{METRIC_LABELS[metric]}: <strong className="text-foreground">{formatMetric(entry.totals[metric])}</strong></span>)}</div></div>)}</div></Card>}
    <Card className="tt-card p-6"><div className="flex flex-wrap items-center gap-3"><span className="tt-quick-icon"><Sparkles className="h-4 w-4" /></span><div className="min-w-0 flex-1"><h2 className="font-display text-base font-extrabold">AI-ajánlásokhoz szükséges alap</h2><p className="mt-1 text-xs text-muted-foreground">{hasData ? "Az AI-ajánlások most már valós mérési snapshotokra építhetők." : "AI insight csak valós metric snapshotokból indulhat; hiányzó adatokból nem készül ajánlás."}</p></div><Link to="/app/recommendations" className="tt-link">Ajánlások <ChevronRight className="ml-0.5 inline h-3.5 w-3.5" /></Link></div></Card>
  </div>;
}

function Metric({ label, value, detail }: { label: string; value: string | null; detail: string }) {
  return <Card className="tt-card tt-stat p-5"><div className="flex items-center gap-3"><span className="tt-stat-icon purple"><BarChart3 className="h-5 w-5" /></span><div><small className="block text-xs text-muted-foreground">{label}</small><strong className="mt-1 block font-display text-2xl font-extrabold">{value ?? "Nincs adat"}</strong><em className="mt-1 block text-[11px] not-italic text-muted-foreground">{detail}</em></div></div></Card>;
}
