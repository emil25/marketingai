import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  ImagePlus,
  Layers,
  Loader2,
  Save,
  Sparkles,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CREATIVE_FORMATS, CreativeDraftSchema, type CreativeDraft } from "@/lib/post-creative";
import { downloadCreativeBlob, paintCreative, renderCreativeBlobs } from "@/lib/creative-canvas";
import { creativeZip } from "@/lib/creative-zip";
import {
  generatePostCreative,
  getPostCreative,
  savePostCreative,
  saveRenderedCreative,
} from "@/lib/creative.functions";
import type { MediaAssetRecord } from "@/lib/data-model";

type Brand = { id: string; name: string; profile: { colors: string[]; logoUrl: string } };
type SavedResult = { mediaAssetIds: string[]; caption: string };

export function PostCreativeComposer({
  postId,
  brand,
  title,
  content,
  assets,
  locked,
  onPrepare,
  onSaved,
  onBusyChange,
}: {
  postId?: string;
  brand: Brand;
  title: string;
  content: string;
  assets: MediaAssetRecord[];
  locked: boolean;
  onPrepare: () => Promise<boolean>;
  onSaved: (result: SavedResult) => Promise<void>;
  onBusyChange: (busy: boolean) => void;
}) {
  const load = useServerFn(getPostCreative),
    generate = useServerFn(generatePostCreative),
    save = useServerFn(savePostCreative),
    exportSave = useServerFn(saveRenderedCreative);
  const [draft, setDraft] = useState<CreativeDraft>({
    format: "portrait",
    template: "editorial",
    caption: "",
    slides: [{ headline: "", body: "", cta: "", imageId: null }],
  });
  const [page, setPage] = useState(0),
    [busy, setBusy] = useState<string | null>(postId ? "load" : null),
    [error, setError] = useState("");
  const [previewError, setPreviewError] = useState(""),
    [previewLoading, setPreviewLoading] = useState(false),
    [uploaded, setUploaded] = useState<MediaAssetRecord[]>([]);
  const canvas = useRef<HTMLCanvasElement>(null),
    inFlight = useRef(false);
  const current = draft.slides[page] ?? draft.slides[0];
  const photos = [
    ...assets,
    ...uploaded.filter((asset) => !assets.some((item) => item.id === asset.id)),
  ].filter((asset) =>
    ["image/jpeg", "image/png", "image/webp", "image/avif"].includes(asset.mimeType),
  );

  useEffect(() => {
    let active = true;
    setPage(0);
    setError("");
    setUploaded([]);
    const initial: CreativeDraft = {
      format: "portrait",
      template: "editorial",
      caption: content.slice(0, 2200),
      slides: [{ headline: title.slice(0, 100), body: "", cta: "", imageId: null }],
    };
    setDraft(initial);
    if (!postId) return;
    setBusy("load");
    load({ data: { postId } })
      .then((saved) => {
        if (active && saved) setDraft(saved);
      })
      .catch(() => {
        if (active) setError("A mentett képszerkesztő nem tölthető be. Töltsd újra az oldalt.");
      })
      .finally(() => {
        if (active) setBusy(null);
      });
    return () => {
      active = false;
    };
    // Content edits are intentionally not allowed to overwrite a locally edited creative draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId, brand.id, load]);

  useEffect(() => {
    let active = true;
    setPreviewLoading(true);
    setPreviewError("");
    const offscreen = document.createElement("canvas");
    paintCreative(offscreen, draft, current, { name: brand.name, ...brand.profile }, page)
      .then(() => {
        if (active && canvas.current) {
          canvas.current.width = offscreen.width;
          canvas.current.height = offscreen.height;
          canvas.current.getContext("2d")?.drawImage(offscreen, 0, 0);
        }
      })
      .catch((cause) => {
        if (active)
          setPreviewError(
            cause instanceof Error ? cause.message : "Az előnézet nem készíthető el.",
          );
      })
      .finally(() => {
        if (active) setPreviewLoading(false);
      });
    return () => {
      active = false;
    };
  }, [draft, current, page, brand.name, brand.profile]);

  function editSlide(key: keyof typeof current, value: string | null) {
    setDraft((valueDraft) => ({
      ...valueDraft,
      slides: valueDraft.slides.map((slide, index) =>
        index === page ? { ...slide, [key]: value } : slide,
      ),
    }));
  }
  function countSlides(count: number) {
    setDraft((value) => ({
      ...value,
      slides: Array.from(
        { length: count },
        (_, index) =>
          value.slides[index] ?? {
            headline: "",
            body: "",
            cta: "",
            imageId: value.slides[0].imageId,
          },
      ),
    }));
    setPage((value) => Math.min(value, count - 1));
  }
  async function run(name: string, action: () => Promise<void>) {
    if (inFlight.current || locked || busy) return;
    inFlight.current = true;
    setBusy(name);
    setError("");
    onBusyChange(true);
    try {
      await action();
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "A művelet sikertelen. Próbáld újra.";
      setError(message);
      toast.error(message);
    } finally {
      inFlight.current = false;
      setBusy(null);
      onBusyChange(false);
    }
  }
  function validatedDraft() {
    const parsed = CreativeDraftSchema.safeParse(draft);
    if (!parsed.success)
      throw new Error(
        "Írj minden laphoz címet. A cím legfeljebb 100, a leírás 260, a CTA 70, a posztszöveg 2200 karakter lehet.",
      );
    return parsed.data;
  }
  async function generateDraft() {
    if (!postId) return;
    // Empty editor pages are legitimate AI inputs; generated pages must pass the full schema.
    const inputDraft = {
      ...draft,
      slides: draft.slides.map((slide) => ({
        ...slide,
        headline: slide.headline.trim() || title.slice(0, 100) || "Új poszt",
      })),
    };
    const result = await generate({
      data: { postId, draft: inputDraft, content: content.slice(0, 6000) || title },
    });
    setDraft(result.draft);
    setPage(0);
    toast.success(
      "A képfeliratok és a posztszöveg elkészültek. Ellenőrizd, majd mentsd a képeket.",
    );
  }
  async function saveDraft() {
    if (!postId) return;
    const result = await save({ data: { postId, draft: validatedDraft() } });
    await onSaved({ mediaAssetIds: [], caption: result.draft.caption });
    toast.success("A szerkeszthető kreatív és a posztszöveg mentve.");
  }
  async function saveImages() {
    if (!postId) return;
    const valid = validatedDraft(),
      blobs = await renderCreativeBlobs(valid, { name: brand.name, ...brand.profile });
    const images = await Promise.all(
      blobs.map(
        (blob) =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result).split(",")[1]);
            reader.onerror = () => reject(new Error("A képfájl nem olvasható."));
            reader.readAsDataURL(blob);
          }),
      ),
    );
    const result = await exportSave({ data: { postId, draft: valid, images } });
    try {
      await onSaved(result);
    } catch {
      setError("A képek mentve, de a poszt nézete nem frissült. Töltsd újra az oldalt.");
    }
    toast.success(`${result.assets.length} kép elmentve a Médiatárba és a poszthoz rendelve.`);
  }
  async function download() {
    const valid = validatedDraft(),
      blobs = await renderCreativeBlobs(valid, { name: brand.name, ...brand.profile });
    if (blobs.length === 1) downloadCreativeBlob(blobs[0], "marketingpilot-instagram.jpg");
    else {
      const entries = await Promise.all(
        blobs.map(async (blob, index) => ({
          name: `instagram-${String(index + 1).padStart(2, "0")}.jpg`,
          bytes: new Uint8Array(await blob.arrayBuffer()),
        })),
      );
      entries.push({ name: "posztszoveg.txt", bytes: new TextEncoder().encode(valid.caption) });
      downloadCreativeBlob(
        new Blob([creativeZip(entries).buffer as ArrayBuffer], { type: "application/zip" }),
        "marketingpilot-carousel.zip",
      );
    }
  }
  async function upload(file: File) {
    if (file.size > 10 * 1024 * 1024) throw new Error("A fotó legfeljebb 10 MB lehet.");
    const form = new FormData();
    form.append("file", file);
    form.append("brandId", brand.id);
    const response = await fetch("/api/media", { method: "POST", body: form });
    const result = (await response.json()) as { error?: string; asset?: MediaAssetRecord };
    if (!response.ok || !result.asset)
      throw new Error(result.error || "A fotó feltöltése sikertelen.");
    setUploaded((values) => [...values, result.asset!]);
    editSlide("imageId", result.asset.id);
    toast.success("A fotó elmentve a Médiatárba.");
  }
  const disabled = Boolean(busy) || locked;
  return (
    <section
      className="mt-5 rounded-2xl border bg-card p-4 sm:p-5"
      aria-labelledby="creative-heading"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="creative-heading" className="flex items-center gap-2 text-xl font-semibold">
            <Layers className="h-5 w-5 text-primary" /> Képposzt és carousel
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Saját fotó, márkaszínek, szerkeszthető feliratok. A képek készítéséhez nem kell
            AI-képkredit.
          </p>
        </div>
        {!postId && (
          <Button variant="outline" disabled={locked} onClick={() => void onPrepare()}>
            Poszt mentése és képszerkesztés
          </Button>
        )}
      </div>
      {!postId ? (
        <p className="mt-3 text-sm">
          Írd le az ajánlatodat fent, majd készítsd el vagy mentsd a posztot. Itt utána a
          reklámképet is összeállíthatod.
        </p>
      ) : busy === "load" ? (
        <p className="mt-4 flex items-center gap-2 text-sm" role="status">
          <Loader2 className="h-4 w-4 animate-spin" /> Mentett kreatív betöltése…
        </p>
      ) : (
        <>
          <fieldset disabled={disabled} className="mt-4 min-w-0 space-y-4">
            <div className="flex flex-wrap gap-2">
              <select
                aria-label="Kreatív típusa"
                className="h-10 max-w-full rounded-xl border bg-background px-3 text-sm"
                value={draft.slides.length === 1 ? "1" : String(draft.slides.length)}
                onChange={(event) => countSlides(Number(event.target.value))}
              >
                <option value="1">Képposzt · 1 kép</option>
                {[2, 3, 4, 5, 6].map((count) => (
                  <option key={count} value={count}>
                    Carousel · {count} lap
                  </option>
                ))}
              </select>
              <select
                aria-label="Kreatív mérete"
                className="h-10 rounded-xl border bg-background px-3 text-sm"
                value={draft.format}
                onChange={(event) =>
                  setDraft((value) => ({
                    ...value,
                    format: event.target.value as CreativeDraft["format"],
                  }))
                }
              >
                {Object.entries(CREATIVE_FORMATS).map(([id, format]) => (
                  <option value={id} key={id}>
                    {format.label}
                  </option>
                ))}
              </select>
              <select
                aria-label="Kreatív elrendezése"
                className="h-10 rounded-xl border bg-background px-3 text-sm"
                value={draft.template}
                onChange={(event) =>
                  setDraft((value) => ({
                    ...value,
                    template: event.target.value as CreativeDraft["template"],
                  }))
                }
              >
                <option value="editorial">Szerkesztőségi</option>
                <option value="overlay">Fotó és felirat</option>
                <option value="minimal">Letisztult</option>
              </select>
              <Button
                variant="outline"
                onClick={() => void run("ai", generateDraft)}
                disabled={content.trim().length < 2 && title.trim().length < 2}
              >
                {busy === "ai" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}{" "}
                AI: állítsd össze
              </Button>
            </div>
            <div className="grid min-w-0 gap-5 lg:grid-cols-2">
              <div className="min-w-0">
                <div className="relative mx-auto max-w-[390px] overflow-hidden rounded-xl border bg-secondary/20">
                  <canvas
                    ref={canvas}
                    aria-label={`${page + 1}. kreatív lap előnézete`}
                    className="block h-auto w-full"
                  />
                  {(previewLoading || previewError) && (
                    <div
                      className="absolute inset-0 grid place-items-center bg-background/95 p-5 text-center text-sm"
                      role={previewError ? "alert" : "status"}
                    >
                      {previewError || "Előnézet készítése…"}
                    </div>
                  )}
                </div>
                <div className="mt-3 flex items-center justify-center gap-3">
                  <Button
                    size="icon"
                    variant="outline"
                    aria-label="Előző kreatív lap"
                    disabled={page === 0}
                    onClick={() => setPage((value) => value - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm font-medium">
                    {page + 1} / {draft.slides.length}
                  </span>
                  <Button
                    size="icon"
                    variant="outline"
                    aria-label="Következő kreatív lap"
                    disabled={page >= draft.slides.length - 1}
                    onClick={() => setPage((value) => value + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="min-w-0 space-y-3">
                <label className="block text-sm font-medium">
                  {page + 1}. lap címe
                  <Input
                    aria-label="Képre kerülő cím"
                    value={current.headline}
                    maxLength={100}
                    onChange={(event) => editSlide("headline", event.target.value)}
                  />
                </label>
                <label className="block text-sm font-medium">
                  Rövid leírás a képen
                  <Textarea
                    aria-label="Képre kerülő leírás"
                    rows={3}
                    value={current.body}
                    maxLength={260}
                    onChange={(event) => editSlide("body", event.target.value)}
                  />
                </label>
                <label className="block text-sm font-medium">
                  Felhívás / ajánlat
                  <Input
                    aria-label="Képre kerülő CTA"
                    value={current.cta}
                    maxLength={70}
                    onChange={(event) => editSlide("cta", event.target.value)}
                  />
                </label>
                <label className="block text-sm font-medium">
                  Háttérfotó
                  <select
                    aria-label="Kreatív háttérfotója"
                    className="mt-1 h-10 w-full min-w-0 rounded-xl border bg-background px-3 text-sm"
                    value={current.imageId ?? ""}
                    onChange={(event) => editSlide("imageId", event.target.value || null)}
                  >
                    <option value="">Márkaszínes grafika · fotó nélkül</option>
                    {photos.map((photo) => (
                      <option key={photo.id} value={photo.id}>
                        {photo.filename}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex cursor-pointer items-center gap-2 rounded-xl border p-3 text-sm">
                  <Upload className="h-4 w-4" /> Saját fotó feltöltése
                  <input
                    aria-label="Fotó feltöltése a kreatívhoz"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/avif"
                    className="min-w-0 flex-1 text-xs"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void run("upload", () => upload(file));
                      event.target.value = "";
                    }}
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 0}
                    onClick={() => {
                      setDraft((value) => {
                        const slides = [...value.slides];
                        [slides[page - 1], slides[page]] = [slides[page], slides[page - 1]];
                        return { ...value, slides };
                      });
                      setPage(page - 1);
                    }}
                  >
                    Lap előrébb
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= draft.slides.length - 1}
                    onClick={() => {
                      setDraft((value) => {
                        const slides = [...value.slides];
                        [slides[page + 1], slides[page]] = [slides[page], slides[page + 1]];
                        return { ...value, slides };
                      });
                      setPage(page + 1);
                    }}
                  >
                    Lap hátrébb
                  </Button>
                </div>
              </div>
            </div>
            <label className="block text-sm font-medium">
              Instagram-posztszöveg
              <Textarea
                aria-label="Kreatív posztszövege"
                rows={5}
                maxLength={2200}
                value={draft.caption}
                onChange={(event) =>
                  setDraft((value) => ({ ...value, caption: event.target.value }))
                }
              />
              <span className="mt-1 block text-xs text-muted-foreground">
                {draft.caption.length} / 2200 · mentéskor az Instagram-változatba kerül
              </span>
            </label>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDraft((value) => ({ ...value, caption: content.slice(0, 2200) }))}
              >
                Aktuális posztszöveg használata
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!draft.caption.trim()}
                onClick={() =>
                  void run("copy", async () => {
                    if (!navigator.clipboard?.writeText)
                      throw new Error(
                        "A böngésző nem engedi a másolást. Jelöld ki a posztszöveget, és másold kézzel.",
                      );
                    await new Promise<void>((resolve, reject) => {
                      const timeout = setTimeout(
                        () =>
                          reject(
                            new Error(
                              "A böngésző nem fejezte be a másolást. Jelöld ki a posztszöveget, és másold kézzel.",
                            ),
                          ),
                        6000,
                      );
                      navigator.clipboard.writeText(draft.caption).then(
                        () => {
                          clearTimeout(timeout);
                          resolve();
                        },
                        (cause) => {
                          clearTimeout(timeout);
                          reject(cause);
                        },
                      );
                    });
                    toast.success("A szerkesztett posztszöveg másolva.");
                  })
                }
              >
                <Copy className="mr-1 h-4 w-4" /> Szöveg másolása
              </Button>
            </div>
          </fieldset>
          {error && (
            <p
              className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
              role="alert"
            >
              {error}
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              disabled={disabled || previewLoading || Boolean(previewError)}
              onClick={() => void run("render", saveImages)}
            >
              {busy === "render" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ImagePlus className="mr-2 h-4 w-4" />
              )}{" "}
              Képek mentése a poszthoz
            </Button>
            <Button
              variant="outline"
              disabled={disabled}
              onClick={() => void run("save", saveDraft)}
            >
              <Save className="mr-2 h-4 w-4" /> Szerkesztés mentése
            </Button>
            <Button
              variant="outline"
              disabled={disabled || previewLoading || Boolean(previewError)}
              onClick={() => void run("download", download)}
            >
              <Download className="mr-2 h-4 w-4" />
              {draft.slides.length === 1 ? "JPEG letöltése" : "Összes lap letöltése · ZIP"}
            </Button>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Mentéskor ezek lesznek a poszt képei; a forrásfotók megmaradnak a Médiatárban. Időzítés
            és közzététel a poszt meglévő gombjaival; kapcsolt csatorna szükséges.
          </p>
        </>
      )}
    </section>
  );
}
