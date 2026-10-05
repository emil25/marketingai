import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Film, Sparkles, Loader2, ArrowUp, ArrowDown, Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createPostVideo, generateVideoStoryboard, getPostVideoDraft } from "@/lib/video.functions";
import {
  VIDEO_FORMATS,
  VIDEO_IMAGE_TYPES,
  VideoScenesSchema,
  type VideoFormat,
  type VideoScene,
} from "@/lib/video";
import type { MediaAssetRecord } from "@/lib/data-model";

export function PostVideoComposer({
  postId,
  assets,
  content,
  savedVideo,
  onCreated,
}: {
  postId?: string;
  assets: MediaAssetRecord[];
  content: string;
  savedVideo?: MediaAssetRecord;
  onCreated: (asset: MediaAssetRecord) => Promise<void>;
}) {
  const generate = useServerFn(generateVideoStoryboard);
  const render = useServerFn(createPostVideo);
  const load = useServerFn(getPostVideoDraft);
  const [scenes, setScenes] = useState<VideoScene[]>([]);
  const [format, setFormat] = useState<VideoFormat>("portrait");
  const [busy, setBusy] = useState<"ai" | "render" | "load" | null>(null);
  const [error, setError] = useState("");
  const [result, setResult] = useState<MediaAssetRecord | null>(null);
  const photos = assets.filter((item) => VIDEO_IMAGE_TYPES.includes(item.mimeType));
  const preview = result ?? savedVideo;

  useEffect(() => {
    let active = true;
    setScenes([]);
    setResult(null);
    setError("");
    if (!postId) return;
    setBusy("load");
    load({ data: { postId } })
      .then((draft) => {
        if (active && draft) {
          setScenes(draft.scenes);
          setFormat(draft.format);
        }
      })
      .catch(() => {
        if (active) setError("A mentett videóterv nem tölthető be. Próbáld újratölteni az oldalt.");
      })
      .finally(() => {
        if (active) setBusy(null);
      });
    return () => {
      active = false;
    };
  }, [postId, load]);

  function toggle(id: string) {
    if (busy) return;
    setError("");
    setScenes((current) =>
      current.some((item) => item.mediaAssetId === id)
        ? current.filter((item) => item.mediaAssetId !== id)
        : current.length < 6
          ? [...current, { mediaAssetId: id, caption: "", duration: 4 }]
          : current,
    );
  }
  function edit(index: number, changes: Partial<VideoScene>) {
    setScenes((current) =>
      current.map((scene, position) => (position === index ? { ...scene, ...changes } : scene)),
    );
  }
  function move(index: number, delta: number) {
    setScenes((current) => {
      const next = [...current];
      const target = index + delta;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }
  async function makeStoryboard() {
    if (!postId || busy || !scenes.length) return;
    setBusy("ai");
    setError("");
    try {
      const draft = await generate({
        data: {
          postId,
          imageIds: scenes.map((item) => item.mediaAssetId),
          content: content.slice(0, 6000),
          format,
        },
      });
      setScenes(draft.scenes);
      toast.success("A videófeliratok elkészültek. Ellenőrizd őket az MP4 készítése előtt.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Nem sikerült megírni a feliratokat.");
    } finally {
      setBusy(null);
    }
  }
  async function makeVideo() {
    if (!postId || busy) return;
    if (!VideoScenesSchema.safeParse(scenes).success) {
      setError("Válassz képeket, és írj minden jelenethez legfeljebb 160 karakteres feliratot.");
      return;
    }
    setBusy("render");
    setError("");
    try {
      const video = await render({ data: { postId, scenes, format } });
      setResult(video.asset);
      try {
        await onCreated(video.asset);
      } catch {
        setError("Az MP4 elmentve a Médiatárba, de a lista nem frissült. Töltsd újra az oldalt.");
      }
      toast.success("A videó elkészült, elmentve a Médiatárba és a poszthoz rendelve.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "A videó nem készült el.");
    } finally {
      setBusy(null);
    }
  }
  return (
    <section className="space-y-4 border-t pt-6" aria-labelledby="post-video-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="post-video-title" className="flex items-center gap-2 text-xl font-semibold">
            <Film className="h-5 w-5 text-primary" />
            Rövid videó saját képekből
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Válassz 1–6 képet, szerkeszd a feliratokat, és készíts márkaszínes, letölthető MP4-et. A
            képek sorrendje lesz a jelenetek sorrendje.
          </p>
        </div>
        <select
          aria-label="Videó formátuma"
          className="h-10 rounded-2xl border bg-card px-3 text-sm"
          disabled={Boolean(busy)}
          value={format}
          onChange={(event) => setFormat(event.target.value as VideoFormat)}
        >
          {Object.entries(VIDEO_FORMATS).map(([id, option]) => (
            <option key={id} value={id}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      {!postId ? (
        <p className="rounded-xl bg-secondary/50 p-3 text-sm">
          Előbb mentsd piszkozatként a posztot, majd itt elkészítheted a videót.
        </p>
      ) : (
        <>
          {photos.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-5 text-sm text-muted-foreground">
              Tölts fel saját JPG, PNG vagy WebP képeket a Médiatárba. A videóhoz nincs szükség
              AI-képgenerálásra.
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {photos.map((photo) => {
                const index = scenes.findIndex((scene) => scene.mediaAssetId === photo.id);
                return (
                  <button
                    type="button"
                    key={photo.id}
                    aria-label={`Videókép: ${photo.filename}`}
                    aria-pressed={index >= 0}
                    disabled={Boolean(busy) || (scenes.length >= 6 && index < 0)}
                    onClick={() => toggle(photo.id)}
                    className={`relative overflow-hidden rounded-xl border ${index >= 0 ? "ring-2 ring-primary" : "opacity-80 hover:opacity-100"}`}
                  >
                    <img
                      src={`/api/media/${photo.id}`}
                      alt={photo.altText || photo.filename}
                      className="aspect-square w-full object-cover"
                    />
                    {index >= 0 && (
                      <span className="absolute left-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-primary text-xs text-primary-foreground">
                        {index + 1}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
          {scenes.length > 0 && (
            <div className="space-y-3">
              {scenes.map((scene, index) => (
                <div
                  key={scene.mediaAssetId}
                  className="flex gap-3 rounded-2xl border bg-secondary/20 p-3"
                >
                  <img
                    src={`/api/media/${scene.mediaAssetId}`}
                    alt={`Jelenet ${index + 1}`}
                    className="h-20 w-14 shrink-0 rounded-lg object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <label
                      className="mb-1 block text-sm font-medium"
                      htmlFor={`video-caption-${index}`}
                    >
                      {index + 1}. jelenet
                    </label>
                    <Textarea
                      id={`video-caption-${index}`}
                      value={scene.caption}
                      maxLength={160}
                      disabled={Boolean(busy)}
                      onChange={(event) => edit(index, { caption: event.target.value })}
                      placeholder="Rövid felirat, vagy kérj AI-javaslatot…"
                      className="min-h-20"
                    />
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <label className="text-xs">
                        Időtartam{" "}
                        <select
                          aria-label={`${index + 1}. jelenet időtartama`}
                          value={scene.duration}
                          disabled={Boolean(busy)}
                          onChange={(event) =>
                            edit(index, { duration: Number(event.target.value) })
                          }
                          className="rounded-lg border bg-card p-1"
                        >
                          {[3, 4, 5, 6, 7, 8].map((seconds) => (
                            <option key={seconds} value={seconds}>
                              {seconds} mp
                            </option>
                          ))}
                        </select>
                      </label>
                      <span className="text-xs text-muted-foreground">
                        {scene.caption.length}/160
                      </span>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label={`${index + 1}. jelenet előrébb`}
                        disabled={Boolean(busy) || index === 0}
                        onClick={() => move(index, -1)}
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label={`${index + 1}. jelenet hátrébb`}
                        disabled={Boolean(busy) || index === scenes.length - 1}
                        onClick={() => move(index, 1)}
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              disabled={Boolean(busy) || !scenes.length || content.trim().length < 2}
              onClick={() => void makeStoryboard()}
            >
              {busy === "ai" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              AI videófeliratok
            </Button>
            <Button
              type="button"
              className="rounded-full"
              disabled={Boolean(busy) || !scenes.length}
              onClick={() => void makeVideo()}
            >
              {busy === "render" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Film className="mr-2 h-4 w-4" />
              )}
              {busy === "render" ? "MP4 készül…" : "MP4 készítése"}
            </Button>
            {scenes.length > 0 && (
              <span className="text-sm text-muted-foreground">
                {scenes.reduce((sum, item) => sum + item.duration, 0)} mp · hang nélkül
              </span>
            )}
          </div>
          {busy === "render" && (
            <p className="text-sm text-muted-foreground" role="status">
              A szerver összeállítja a videót. Maradj ezen az oldalon; ez legfeljebb két percet
              vehet igénybe.
            </p>
          )}
          {error && (
            <p
              role="alert"
              className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive"
            >
              {error}
            </p>
          )}
          {preview && (
            <div className="space-y-3">
              <video
                key={preview.id}
                src={`/api/media/${preview.id}`}
                controls
                playsInline
                preload="metadata"
                className="mx-auto max-h-96 max-w-full rounded-2xl bg-black"
              />
              <a
                href={`/api/media/${preview.id}`}
                download={preview.filename}
                className="inline-flex items-center gap-2 text-sm font-medium text-primary"
              >
                <Download className="h-4 w-4" />
                MP4 letöltése
              </a>
              <p className="text-xs text-muted-foreground">
                A videó a Médiatárban is megmarad. Elkészítése nem publikálja a posztot.
              </p>
            </div>
          )}
        </>
      )}
    </section>
  );
}
