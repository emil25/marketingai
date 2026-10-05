import { useMemo, useState } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/app-chrome";
import { getMediaAssets } from "@/lib/media.functions";
import { Image as ImageIcon, Upload, Search, Trash2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/media")({
  loader: () => getMediaAssets(),
  component: MediaLibrary,
});

function MediaLibrary() {
  const assets = Route.useLoaderData();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [pending, setPending] = useState(false);
  const filtered = useMemo(
    () =>
      assets.filter(
        (asset) =>
          (!query ||
            (asset.filename + " " + asset.altText).toLowerCase().includes(query.toLowerCase())) &&
          (type === "all" || asset.mimeType.startsWith(type + "/")),
      ),
    [assets, query, type],
  );
  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const uploadForm = event.currentTarget;
    const form = new FormData(uploadForm);
    if (!form.get("file")) return;
    setPending(true);
    try {
      const response = await fetch("/api/media", { method: "POST", body: form });
      if (!response.ok)
        throw new Error((await response.json().catch(() => ({ error: "Feltöltési hiba" }))).error);
      toast.success("Média feltöltve.");
      uploadForm.reset();
      await router.invalidate();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Nem sikerült feltölteni.");
    } finally {
      setPending(false);
    }
  }
  async function remove(id: string) {
    if (!window.confirm("Eltávolítod ezt a médiafájlt?")) return;
    try {
      const response = await fetch("/api/media/" + id, { method: "DELETE" });
      if (!response.ok) throw new Error("A médiafájl törlése sikertelen.");
      await router.invalidate();
      toast.success("Média eltávolítva.");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Nem sikerült törölni.");
    }
  }
  return (
    <div className="space-y-6">
      <PageHeader
        title="Médiatár"
        sub="A munkatérhez és az aktív márkához tartozó valódi fájlok."
        action={
          <Link to="/app/posts">
            <Button variant="outline" className="rounded-full">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Posztok
            </Button>
          </Link>
        }
      />
      <Card className="workspace-media-upload rounded-3xl p-5">
        <div className="mb-4 flex items-center gap-3">
          <span className="workspace-upload-icon">
            <Upload className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-semibold">Adj képet az ötleteidhez</h2>
            <p className="text-sm text-muted-foreground">
              Saját képeid és videóid, készen a következő posztra.
            </p>
          </div>
        </div>
        <form onSubmit={upload} className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto]">
          <Input type="file" name="file" accept="image/*,video/*,audio/*" required />
          <Input name="altText" placeholder="Alternatív szöveg (opcionális)" />
          <Button className="rounded-full" disabled={pending}>
            <Upload className="mr-1 h-4 w-4" />
            {pending ? "Feltöltés…" : "Feltöltés"}
          </Button>
        </form>
        <p className="mt-2 text-xs text-muted-foreground">
          Kép, videó vagy hang, legfeljebb 10 MB. A feltöltött fájlt a posztszerkesztőben
          választhatod ki.
        </p>
      </Card>
      <Card className="rounded-3xl p-4">
        <div className="flex flex-col gap-3 md:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="rounded-2xl pl-9"
              placeholder="Keresés fájlnév vagy alt szöveg alapján…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <select
            className="h-10 rounded-2xl border bg-card px-3 text-sm"
            value={type}
            onChange={(event) => setType(event.target.value)}
          >
            <option value="all">Minden típus</option>
            <option value="image">Képek</option>
            <option value="video">Videók</option>
            <option value="audio">Hangok</option>
          </select>
        </div>
      </Card>
      {filtered.length === 0 ? (
        <Card className="rounded-3xl p-10 text-center">
          <ImageIcon className="mx-auto h-8 w-8 text-brand" />
          <h2 className="mt-3 text-lg font-semibold">Még nincs médiafájlod.</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Tölts fel képet, videót vagy hangot, majd rendeld hozzá a Posztkészítő Média lépésében.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {filtered.map((asset) => (
            <Card key={asset.id} className="overflow-hidden rounded-3xl">
              {asset.mimeType.startsWith("image/") ? (
                <img
                  src={"/api/media/" + asset.id}
                  alt={asset.altText || asset.filename}
                  className="aspect-square w-full object-cover"
                />
              ) : asset.mimeType.startsWith("video/") ? (
                <video
                  src={"/api/media/" + asset.id}
                  controls
                  playsInline
                  preload="metadata"
                  className="aspect-square w-full bg-black object-contain"
                />
              ) : (
                <div className="grid aspect-square place-items-center bg-secondary p-4 text-center text-xs">
                  <span>{asset.mimeType}</span>
                </div>
              )}
              <div className="p-4">
                <div className="truncate text-sm font-medium" title={asset.filename}>
                  {asset.filename}
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <Badge variant="outline" className="rounded-full text-[10px]">
                    {asset.source === "ai"
                      ? "AI"
                      : asset.source === "import"
                        ? "Összeállított"
                        : "Feltöltés"}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">
                    {Math.ceil(asset.size / 1024)} KB
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-3 w-full rounded-full text-destructive"
                  onClick={() => void remove(asset.id)}
                >
                  <Trash2 className="mr-1 h-3.5 w-3.5" />
                  Eltávolítás
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
