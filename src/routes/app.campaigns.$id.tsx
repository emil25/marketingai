import { useMemo, useState } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/app-chrome";
import { getCampaign, generatePlanItems, generateCampaignContentPackage, updateCampaign } from "@/lib/campaign.functions";
import type { CampaignStatus, PlanItemStatus } from "@/lib/data-model";
import { ArrowLeft, CalendarDays, Loader2, Megaphone, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/campaigns/$id")({ loader: ({ params }) => getCampaign({ data: { campaignId: params.id } }), component: CampaignDetail });

const STATUS_LABELS: Record<PlanItemStatus, string> = { idea: "Ötlet", planned: "Tervezett", draft: "Piszkozat", ready: "Jóváhagyás", scheduled: "Időzített", published: "Publikált", skipped: "Kihagyva" };
const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = { draft: "Piszkozat", planning: "Tervezés alatt", active: "Aktív", paused: "Szüneteltetve", completed: "Lezárva", archived: "Archiválva" };
const PLATFORM_LABELS: Record<string, string> = { facebook: "Facebook", instagram: "Instagram", tiktok: "TikTok", linkedin: "LinkedIn", youtube: "YouTube", "google-business": "Google Business" };

function CampaignDetail() {
  const campaign = Route.useLoaderData();
  const router = useRouter();
  const generate = useServerFn(generatePlanItems);
  const generatePackage = useServerFn(generateCampaignContentPackage);
  const updateStatus = useServerFn(updateCampaign);
  const [pending, setPending] = useState(false);
  const [statusPending, setStatusPending] = useState(false);
  const [packagePending, setPackagePending] = useState(false);
  const remaining = useMemo(() => campaign.planItems.filter((item) => !item.postId && item.status !== "skipped"), [campaign.planItems]);
  async function generateAll() {
    if (!remaining.length || pending) return;
    setPending(true);
    try {
      const result = await generate({ data: { planItemIds: remaining.map((item) => item.id) } });
      toast.success(`${result.completed.length} tartalom elkészült${result.failed.length ? `, ${result.failed.length} hibával` : ""}.`);
      await router.invalidate();
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : "Nem sikerült a kampány tartalmainak elkészítése."); }
    finally { setPending(false); }
  }
  async function changeStatus(event: React.ChangeEvent<HTMLSelectElement>) {
    setStatusPending(true);
    try { await updateStatus({ data: { campaignId: campaign.id, status: event.target.value as CampaignStatus } }); await router.invalidate(); toast.success("Kampány státusza frissítve."); }
    catch (cause) { toast.error(cause instanceof Error ? cause.message : "Nem sikerült frissíteni a kampányt."); }
    finally { setStatusPending(false); }
  }
  async function generateFullPackage() {
    if (packagePending || !remaining.length) return;
    setPackagePending(true);
    try { const result = await generatePackage({ data: { campaignId: campaign.id } }); toast.success(`${result.completed.length} kampánytartalom elkészült${result.failed.length ? `, ${result.failed.length} hibával` : ""}.`); await router.invalidate(); }
    catch (cause) { toast.error(cause instanceof Error ? cause.message : "Nem sikerült elkészíteni a kampánytartalmakat."); }
    finally { setPackagePending(false); }
  }
  return <div className="space-y-6"><PageHeader title={campaign.name} sub={`${campaign.brandName} · ${campaign.startDate} – ${campaign.endDate}`} action={<Link to="/app/campaigns"><Button variant="outline" className="rounded-full"><ArrowLeft className="mr-1 h-4 w-4" />Kampányok</Button></Link>} /><div className="grid gap-4 md:grid-cols-4"><Metric label="Tervtétel" value={campaign.counts.planned} /><Metric label="Elkészült" value={campaign.counts.created} /><Metric label="Piszkozat" value={campaign.counts.drafts} /><Metric label="Még hátra" value={campaign.counts.remaining} /></div><Card className="rounded-3xl p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-lg font-semibold">Kampánystratégia</h2><p className="mt-2 max-w-3xl whitespace-pre-line text-sm text-muted-foreground">{campaign.strategy?.summary ?? "A stratégia még nem készült el."}</p></div><div className="flex items-center gap-2"><Badge className="rounded-full" variant={campaign.status === "active" ? "default" : "secondary"}>{CAMPAIGN_STATUS_LABELS[campaign.status]}</Badge><select aria-label="Kampány státusza" value={campaign.status} disabled={statusPending} onChange={(event) => void changeStatus(event)} className="h-9 rounded-full border bg-card px-3 text-xs"><option value="draft">Piszkozat</option><option value="planning">Tervezés alatt</option><option value="active">Aktív</option><option value="paused">Szüneteltetve</option><option value="completed">Lezárva</option><option value="archived">Archiválva</option></select></div></div>{campaign.strategy && <div className="mt-5 grid gap-4 md:grid-cols-2"><div className="rounded-2xl bg-secondary/50 p-4"><div className="text-xs text-muted-foreground">Fő üzenet</div><div className="mt-1 text-sm font-medium">{campaign.strategy.mainMessage}</div></div><div className="rounded-2xl bg-secondary/50 p-4"><div className="text-xs text-muted-foreground">CTA / gyakoriság</div><div className="mt-1 text-sm font-medium">{campaign.strategy.cta} · {campaign.strategy.recommendedFrequency}</div></div><div><div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tartalmi pillérek</div><div className="mt-2 flex flex-wrap gap-2">{campaign.strategy.contentPillars.map((pillar) => <Badge key={pillar} variant="outline" className="rounded-full">{pillar}</Badge>)}</div></div><div><div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Csatornák</div><div className="mt-2 flex flex-wrap gap-2">{campaign.channels.map((channel) => <Badge key={channel} variant="outline" className="rounded-full">{PLATFORM_LABELS[channel] ?? channel}</Badge>)}</div></div><div className="md:col-span-2"><div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Csatornánkénti stratégia</div><div className="mt-2 grid gap-2 sm:grid-cols-2">{Object.entries(campaign.strategy.channelStrategies).map(([channel, strategy]) => <div key={channel} className="rounded-2xl border p-3"><div className="text-xs font-semibold">{PLATFORM_LABELS[channel] ?? channel}</div><div className="mt-1 text-sm text-muted-foreground">{strategy}</div></div>)}</div></div></div>}</Card><Card className="rounded-3xl p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">30 napos terv</h2><p className="text-sm text-muted-foreground">A tervtételek valódi rekordok, amelyekhez poszt kapcsolható.</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" className="rounded-full" disabled={!remaining.length || packagePending} onClick={() => void generateFullPackage()}>{packagePending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Megaphone className="mr-1 h-4 w-4" />}{packagePending ? "Csomag készül…" : "Teljes tartalomcsomag"}</Button><Button className="rounded-full" disabled={!remaining.length || pending} onClick={() => void generateAll()}>{pending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1 h-4 w-4" />}{pending ? "Tartalmak készülnek…" : "Készítsd el a kampányt"}</Button></div></div><div className="mt-5 grid gap-3 md:grid-cols-2">{campaign.planItems.map((item) => <div key={item.id} className="rounded-2xl border p-4"><div className="flex items-start justify-between gap-3"><div><div className="text-xs text-muted-foreground">{item.date}{item.time ? ` · ${item.time}` : ""}</div><div className="mt-1 font-medium">{item.topic}</div></div><Badge className="rounded-full" variant={item.status === "skipped" ? "secondary" : item.postId ? "default" : "outline"}>{STATUS_LABELS[item.status]}</Badge></div><div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><span>{PLATFORM_LABELS[item.platform] ?? item.platform}</span><span>·</span><span>{item.contentType}</span>{item.postId && <Link to="/app/posts/$id" params={{ id: item.postId }} className="ml-auto text-primary hover:underline">Megnyitás</Link>}</div></div>)}</div></Card>{campaign.posts.length > 0 && <Card className="rounded-3xl p-6"><h2 className="text-lg font-semibold">Elkészült posztok</h2><div className="mt-4 grid gap-2 sm:grid-cols-2">{campaign.posts.map((post) => <Link key={post.id} to="/app/posts/$id" params={{ id: post.id }} className="rounded-2xl border p-3 text-sm hover:bg-secondary/50"><div className="font-medium">{post.title}</div><div className="mt-1 text-xs text-muted-foreground">{post.status}</div></Link>)}</div></Card>}<div className="flex gap-2"><Link to="/app/planner"><Button variant="outline" className="rounded-full"><CalendarDays className="mr-1 h-4 w-4" />Terv megnyitása</Button></Link></div></div>;
}

function Metric({ label, value }: { label: string; value: number }) { return <Card className="rounded-2xl p-5"><div className="text-xs text-muted-foreground">{label}</div><div className="mt-2 text-2xl font-semibold">{value}</div></Card>; }

