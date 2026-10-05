import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/app-chrome";
import { getWorkspace } from "@/lib/workspace.functions";
import { generateContent, type GeneratedContent } from "@/lib/ai-content.functions";
import { Sparkles, Copy, Facebook, Instagram, Music2, Globe, FileText, Mail, Loader2, Image as ImageIcon, RefreshCw, Download } from "lucide-react";
import { toast } from "sonner";
import { streamImage, brandImagePrompt } from "@/lib/stream-image";


export const Route = createFileRoute("/app/content/$type")({
  loader: () => getWorkspace(),
  component: Content,
});

type ContentType = "facebook" | "instagram" | "tiktok" | "google" | "blog" | "newsletter";

const META: Record<string, { icon: any; title: string; sub: string }> = {
  facebook: { icon: Facebook, title: "Facebook", sub: "Poszt, carousel, CTA, emoji verzió, hashtagek." },
  instagram: { icon: Instagram, title: "Instagram", sub: "Poszt, Story, carousel, Reels felirat." },
  tiktok: { icon: Music2, title: "TikTok", sub: "Videó ötletek, forgatókönyv, hook, jelenetek." },
  google: { icon: Globe, title: "Google Cégprofil", sub: "Akció, újdonság, esemény, ajánlat." },
  blog: { icon: FileText, title: "Blog", sub: "SEO cím, meta, kulcsszó, GYIK." },
  newsletter: { icon: Mail, title: "Hírlevél", sub: "Email szöveg, tárgy, CTA." },
};

const MODIFIERS = ["Rövid", "Közepes", "Hosszú", "Emoji", "CTA-val", "Hashtagek"];

function Content() {
  const { type } = Route.useParams();
  const workspace = Route.useLoaderData();
  const brand = workspace.activeBrand;
  const m = META[type] ?? META.facebook;
  const Icon = m.icon;

  const [topic, setTopic] = useState("");
  const [mods, setMods] = useState<string[]>([]);
  const [result, setResult] = useState<GeneratedContent | null>(null);
  const [image, setImage] = useState<{ src: string; final: boolean } | null>(null);
  const [imgBusy, setImgBusy] = useState(false);
  const call = useServerFn(generateContent);

  const gen = useMutation({
    mutationFn: () =>
      call({
        data: {
          type: (META[type] ? type : "facebook") as ContentType,
          topic,
          modifiers: mods,
        },
      }),
    onSuccess: (data) => {
      setResult(data);
      toast.success("A szövegváltozatok elkészültek. A kép külön, explicit műveletként indítható.");
    },
    onError: (e: Error) => toast.error(e.message || "Nem sikerült a generálás."),
  });

  if (!brand) return <Card className="rounded-3xl p-10 text-center"><Sparkles className="mx-auto h-8 w-8 text-brand" /><div className="mt-3 text-lg font-semibold">Még nincs aktív márkád</div><p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">Az AI csak mentett márka- és Brand Voice-adatokkal indítható.</p><Link to="/app/brand"><Button className="mt-4 rounded-full">Márka létrehozása</Button></Link></Card>;
  const activeBrand = brand;

  async function generateImage(forTopic: string) {
    if (imgBusy) return;
    setImgBusy(true);
    setImage({ src: "", final: false });
    try {
      await streamImage(
        brandImagePrompt({
          topic: forTopic,
          brand: activeBrand.name,
          industry: activeBrand.industry,
          businessType: activeBrand.profile.businessType,
          tone: activeBrand.profile.tone,
          colors: activeBrand.profile.colors,
          format: m.title,
        }),
        (dataUrl, isFinal) => setImage({ src: dataUrl, final: isFinal }),
        { brandId: activeBrand.id, format: m.title },
      );
    } catch (e) {
      setImage(null);
      toast.error((e as Error).message || "Nem sikerült a képgenerálás.");
    } finally {
      setImgBusy(false);
    }
  }

  async function saveImageToMedia() {
    if (!image?.final || !image.src) return;
    try {
      const response = await fetch(image.src); const blob = await response.blob(); const form = new FormData();
      form.append("file", blob, `${activeBrand.name}-${m.title}.png`); form.append("brandId", activeBrand.id); form.append("source", "ai"); form.append("altText", `${activeBrand.name} ${m.title} – ${topic}`);
      const upload = await fetch("/api/media", { method: "POST", body: form }); if (!upload.ok) throw new Error("A média mentése sikertelen."); toast.success("A kép bekerült a Médiatárba.");
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : "Nem sikerült menteni a képet."); }
  }


  return (
    <div className="space-y-6">
      <PageHeader
        title={m.title + " generátor"}
        sub={m.sub}
        action={<Badge className="rounded-full" variant="secondary"><Icon className="mr-1 h-3 w-3" /> {m.title}</Badge>}
      />

      <Card className="rounded-3xl p-6">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
          <Input
            className="h-12 rounded-2xl text-base"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Miről szóljon a tartalom?"
            onKeyDown={(e) => { if (e.key === "Enter" && topic.trim().length > 1) gen.mutate(); }}
          />
          <Button
            className="h-12 rounded-2xl px-6"
            disabled={gen.isPending || topic.trim().length < 2}
            onClick={() => gen.mutate()}
          >
            {gen.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1 h-4 w-4" />}
            {gen.isPending ? "Generálás…" : "Generálás"}
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {MODIFIERS.map((c) => {
            const active = mods.includes(c);
            return (
              <button
                key={c}
                onClick={() => setMods((s) => (active ? s.filter((x) => x !== c) : [...s, c]))}
                className={`rounded-full border px-3 py-1 transition ${active ? "border-brand bg-brand/10 text-foreground" : "bg-card hover:border-brand"}`}
              >
                {c}
              </button>
            );
          })}
        </div>
      </Card>

      {gen.isPending && (
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <Card key={i} className="rounded-3xl p-6">
              <div className="h-4 w-32 animate-pulse rounded-full bg-secondary" />
              <div className="mt-4 space-y-2">
                {[0, 1, 2, 3].map((j) => (
                  <div key={j} className="h-3 animate-pulse rounded-full bg-secondary" style={{ width: `${90 - j * 12}%` }} />
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}

      {!gen.isPending && result && (
        <>
          <div className="text-lg font-semibold">{result.title}</div>

          <Card className="rounded-3xl p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 font-semibold">
                  <ImageIcon className="h-4 w-4 text-brand" /> Poszt vizuál
                </div>
                <p className="text-xs text-muted-foreground">
                  Márkaszínek és „{brand.profile.tone}” hangnem alapján generálva.
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="rounded-full" disabled={imgBusy} onClick={() => generateImage(topic)}>
                  {imgBusy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1 h-3.5 w-3.5" />}
                  {image?.final ? "Új variáció" : "Kép generálása"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-full"
                  disabled={!image?.final}
                  onClick={() => {
                    if (!image?.src) return;
                    const a = document.createElement("a");
                    a.href = image.src;
                    a.download = `${brand.name}-${m.title}.png`;
                    a.click();
                  }}
                >
                  <Download className="mr-1 h-3.5 w-3.5" />Letöltés
                </Button>
                <Button variant="outline" size="sm" className="rounded-full" disabled={!image?.final} onClick={() => void saveImageToMedia()}>Médiatárba mentés</Button>
              </div>
            </div>
            {image?.src ? (
              <img
                src={image.src}
                alt={`${brand.name} – ${m.title} vizuál: ${topic}`}
                className={`w-full max-w-md rounded-2xl object-cover transition-[filter] duration-300 ${image.final ? "blur-0" : "blur-2xl"}`}
              />
            ) : (
              <div className="flex aspect-video w-full max-w-md items-center justify-center rounded-2xl bg-secondary">
                {imgBusy ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : <span className="text-sm text-muted-foreground">Kép még nincs generálva</span>}
              </div>
            )}
          </Card>

          <div className="grid gap-4 md:grid-cols-2">

            {result.blocks.map((b, i) => (
              <Card key={i} className="rounded-3xl p-6">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="font-semibold">{b.label}</div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => { navigator.clipboard.writeText(b.body); toast.success("Vágólapra másolva"); }}
                  >
                    <Copy className="mr-1 h-3.5 w-3.5" />Másolás
                  </Button>
                </div>
                <Textarea
                  className="min-h-40 whitespace-pre-line rounded-2xl bg-secondary/50 text-sm"
                  defaultValue={b.body}
                  key={b.label + i + b.body.slice(0, 8)}
                />
              </Card>
            ))}
          </div>
        </>
      )}

      {!gen.isPending && !result && (
        <Card className="rounded-3xl p-10 text-center">
          <Sparkles className="mx-auto h-8 w-8 text-brand" />
          <div className="mt-3 text-lg font-semibold">Írd be a témát és generálj éles AI tartalmat</div>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            A rendszer a márkád nevét ({brand.name}), iparágát és hangnemét ({brand.profile.tone}) is figyelembe veszi.
          </p>
        </Card>
      )}
    </div>
  );
}
