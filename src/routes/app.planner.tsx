import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/app-chrome";
import { getWorkspace } from "@/lib/workspace.functions";
import { getCampaigns, getPlanner, createPostFromPlanItem, generatePlanItems, regeneratePlanItem, updatePlanItem } from "@/lib/campaign.functions";
import type { PlanItemStatus, PostPlatform, PostStatus } from "@/lib/data-model";
import { Calendar, Check, ChevronDown, Edit3, Loader2, Megaphone, Play, RefreshCw, SkipForward, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/planner")({ loader: async () => ({ workspace: await getWorkspace(), campaigns: await getCampaigns(), items: await getPlanner({ data: {} }) }), component: Planner });

const CHANNELS: Array<{ id: PostPlatform; label: string }> = [{ id: "facebook", label: "Facebook" }, { id: "instagram", label: "Instagram" }, { id: "tiktok", label: "TikTok" }, { id: "linkedin", label: "LinkedIn" }, { id: "youtube", label: "YouTube" }, { id: "google-business", label: "Google Business" }];
const STATUS_LABELS: Record<PlanItemStatus, string> = { idea: "Ötlet", planned: "Tervezett", draft: "Piszkozat", ready: "Jóváhagyás", scheduled: "Időzített", published: "Publikált", skipped: "Kihagyva" };
function statusLabel(status: PlanItemStatus, postStatus: PostStatus | null) { if (postStatus === "failed") return "Hiba"; if (postStatus === "published") return "Publikált"; return STATUS_LABELS[status]; }

function Planner() {
  const data = Route.useLoaderData();
  const router = useRouter();
  const navigate = useNavigate();
  const create = useServerFn(createPostFromPlanItem);
  const generate = useServerFn(generatePlanItems);
  const regenerate = useServerFn(regeneratePlanItem);
  const update = useServerFn(updatePlanItem);
  const [campaignId, setCampaignId] = useState("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const items = useMemo(() => data.items.filter((item) => campaignId === "all" || item.campaignId === campaignId), [data.items, campaignId]);
  useEffect(() => { setSelected([]); }, [campaignId]);
  const firstDate = items[0]?.date;
  const weekItems = useMemo(() => firstDate ? items.filter((item) => Math.floor((new Date(`${item.date}T00:00:00Z`).getTime() - new Date(`${firstDate}T00:00:00Z`).getTime()) / 86400000) < 7) : [], [items, firstDate]);
  const pendingItems = items.filter((item) => !item.postId && item.status !== "skipped");
  async function make(itemId: string, again = false) {
    if (pending) return;
    setPending(itemId);
    try { const result = again ? await regenerate({ data: { planItemId: itemId } }) : await create({ data: { planItemId: itemId } }); toast.success("A posztváltozat elkészült."); await router.invalidate(); if (result?.postId) await navigate({ to: "/app/posts/$id", params: { id: result.postId } }); }
    catch (cause) { toast.error(cause instanceof Error ? cause.message : "Nem sikerült elkészíteni a tartalmat."); }
    finally { setPending(null); }
  }
  async function makeWeek() {
    const ids = selected.length ? selected : weekItems.filter((item) => !item.postId && item.status !== "skipped").map((item) => item.id);
    if (!ids.length || pending) return;
    setPending("week");
    try { const result = await generate({ data: { planItemIds: ids.slice(0, 90) } }); toast.success(`${result.completed.length} heti tartalom elkészült${result.failed.length ? `, ${result.failed.length} hibával` : ""}.`); setSelected([]); await router.invalidate(); }
    catch (cause) { toast.error(cause instanceof Error ? cause.message : "Nem sikerült a heti tartalmakat elkészíteni."); }
    finally { setPending(null); }
  }
  async function setStatus(itemId: string, status: PlanItemStatus) { try { await update({ data: { planItemId: itemId, fields: { status } } }); await router.invalidate(); } catch (cause) { toast.error(cause instanceof Error ? cause.message : "Nem sikerült módosítani a tervtételt."); } }
  async function saveEdit(event: React.FormEvent<HTMLFormElement>, itemId: string) { event.preventDefault(); const form = new FormData(event.currentTarget); try { await update({ data: { planItemId: itemId, fields: { date: String(form.get("date")), time: String(form.get("time") || "") || null, platform: String(form.get("platform")) as PostPlatform, topic: String(form.get("topic")) } } }); setEditing(null); await router.invalidate(); toast.success("Tervtétel frissítve."); } catch (cause) { toast.error(cause instanceof Error ? cause.message : "Nem sikerült menteni a tervtételt."); } }
  const brand = data.workspace.activeBrand;
  if (!brand) return <Card className="rounded-3xl p-10 text-center"><Calendar className="mx-auto h-8 w-8 text-brand" /><h2 className="mt-3 text-lg font-semibold">Még nincs aktív márkád</h2><p className="mx-auto mt-1 max-w-lg text-sm text-muted-foreground">A 30 napos terv az aktív márka és Brand Voice alapján készül.</p><Link to="/app/brand"><Button className="mt-5 rounded-full">Márka beállítása</Button></Link></Card>;
  return <div className="space-y-6"><PageHeader title="30 napos marketingterv" sub="AI-tartalomterv valódi kampány- és tervtételekből." action={<div className="flex flex-wrap gap-2"><Link to="/app/campaigns"><Button variant="outline" className="rounded-full"><Megaphone className="mr-1 h-4 w-4" />Kampányok</Button></Link><Button className="rounded-full" disabled={!pendingItems.length || pending === "week"} onClick={() => void makeWeek()}>{pending === "week" ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Play className="mr-1 h-4 w-4" />}{selected.length ? `Kijelölt ${selected.length} készítése` : "Készítsd el ezt a hetet"}</Button></div>} /><Card className="rounded-3xl p-4"><div className="flex flex-wrap items-center gap-3"><select className="h-10 rounded-2xl border bg-card px-3 text-sm" value={campaignId} onChange={(event) => setCampaignId(event.target.value)}><option value="all">Minden kampány</option>{data.campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}</select><span className="text-sm text-muted-foreground">{items.length} tervtétel · {pendingItems.length} még nincs elkészítve</span></div></Card>{items.length === 0 ? <Card className="rounded-3xl p-10 text-center"><Calendar className="mx-auto h-8 w-8 text-brand" /><h2 className="mt-3 text-lg font-semibold">Még nincs 30 napos terved</h2><p className="mx-auto mt-1 max-w-lg text-sm text-muted-foreground">Hozz létre kampányt, majd indítsd el az AI marketingtervet.</p><Link to="/app/campaigns"><Button className="mt-5 rounded-full"><SparklesIcon />Kampány indítása</Button></Link></Card> : <div className="space-y-6">{groupByWeek(items).map((week) => <section key={week.label}><div className="mb-3 flex items-center gap-2"><ChevronDown className="h-4 w-4 text-muted-foreground" /><h2 className="font-semibold">{week.label}</h2><span className="text-xs text-muted-foreground">{week.items.length} tétel</span></div><div className="grid gap-3 md:grid-cols-2">{week.items.map((item) => <PlanCard key={item.id} item={item} selected={selected.includes(item.id)} editing={editing === item.id} pending={pending === item.id} onSelect={() => setSelected((current) => current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id])} onCreate={() => void make(item.id)} onRegenerate={() => void make(item.id, true)} onSkip={() => void setStatus(item.id, item.status === "skipped" ? "planned" : "skipped")} onEdit={() => setEditing(item.id)} onCancel={() => setEditing(null)} onSave={(event) => void saveEdit(event, item.id)} />)}</div></section>)}</div>}</div>;
}

function groupByWeek(items: PlannerItem[]) { const first = items[0]; if (!first) return []; const groups: Array<{ label: string; items: PlannerItem[] }> = []; for (const item of items) { const start = new Date(`${first.date}T00:00:00Z`); const index = Math.floor((new Date(`${item.date}T00:00:00Z`).getTime() - start.getTime()) / 86400000); const label = `${Math.floor(index / 7) + 1}. hét`; const group = groups.find((candidate) => candidate.label === label); if (group) group.items.push(item); else groups.push({ label, items: [item] }); } return groups; }
type PlannerItem = { id: string; date: string; time: string | null; platform: PostPlatform; contentType: string; topic: string; status: PlanItemStatus; postId: string | null; postTitle: string | null; postStatus: PostStatus | null; campaignName: string | null };
function PlanCard({ item, selected, editing, pending, onSelect, onCreate, onRegenerate, onSkip, onEdit, onCancel, onSave }: { item: PlannerItem; selected: boolean; editing: boolean; pending: boolean; onSelect: () => void; onCreate: () => void; onRegenerate: () => void; onSkip: () => void; onEdit: () => void; onCancel: () => void; onSave: (event: React.FormEvent<HTMLFormElement>) => void }) { const label = statusLabel(item.status, item.postStatus); const isError = item.postStatus === "failed"; return <Card className={"rounded-3xl p-4 " + (selected ? "ring-2 ring-primary/30" : "")}><div className="flex items-start gap-3"><input type="checkbox" checked={selected} onChange={onSelect} disabled={Boolean(item.postId) || item.status === "skipped"} className="mt-1 h-4 w-4" /><div className="min-w-0 flex-1">{editing ? <form onSubmit={onSave} className="space-y-3"><div className="grid gap-2 sm:grid-cols-2"><Input type="date" name="date" defaultValue={item.date} required /><Input type="time" name="time" defaultValue={item.time ?? ""} /></div><select name="platform" defaultValue={item.platform} className="h-10 w-full rounded-2xl border bg-card px-3 text-sm">{CHANNELS.map((channel) => <option key={channel.id} value={channel.id}>{channel.label}</option>)}</select><Input name="topic" defaultValue={item.topic} required /><div className="flex gap-2"><Button type="submit" size="sm" className="rounded-full"><Check className="mr-1 h-3.5 w-3.5" />Mentés</Button><Button type="button" size="sm" variant="ghost" className="rounded-full" onClick={onCancel}>Mégse</Button></div></form> : <><div className="flex flex-wrap items-center gap-2"><span className="text-xs text-muted-foreground">{item.date}{item.time ? ` · ${item.time}` : ""}</span><Badge className="rounded-full" variant="outline">{CHANNELS.find((channel) => channel.id === item.platform)?.label ?? item.platform}</Badge><Badge className="rounded-full" variant={isError || item.status === "skipped" ? "secondary" : item.postStatus === "published" || item.postId ? "default" : "outline"}>{label}</Badge></div><div className="mt-2 font-medium">{item.topic}</div><div className="mt-1 text-xs text-muted-foreground">{item.contentType}{item.campaignName ? ` · ${item.campaignName}` : ""}</div></>}</div></div>{!editing && <div className="mt-4 flex flex-wrap gap-2">{item.postId ? <Link to="/app/posts/$id" params={{ id: item.postId }}><Button size="sm" className="rounded-full">Megnyitás</Button></Link> : item.status !== "skipped" && <Button size="sm" className="rounded-full" disabled={pending} onClick={onCreate}>{pending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <SparklesIcon />}{pending ? "Készül…" : "Készítsd el"}</Button>}{item.postId && <Button size="sm" variant="outline" className="rounded-full" disabled={pending} onClick={onRegenerate}><RefreshCw className="mr-1 h-3.5 w-3.5" />Újragenerálás</Button>}<Button size="sm" variant="ghost" className="rounded-full" onClick={onEdit}><Edit3 className="mr-1 h-3.5 w-3.5" />Szerkesztés</Button><Button size="sm" variant="ghost" className="rounded-full" onClick={onSkip}>{item.status === "skipped" ? "Visszaállítás" : <><SkipForward className="mr-1 h-3.5 w-3.5" />Kihagyás</>}</Button></div>}</Card>; }
function SparklesIcon() { return <Sparkles className="mr-1 h-3.5 w-3.5" />; }
