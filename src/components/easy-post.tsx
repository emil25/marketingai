import { useEffect, useRef, useState } from "react";
import { Link, useRouter, useBlocker } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Input } from "./ui/input";
import { Card } from "./ui/card";
import { useUiMode } from "./ui-mode";
import {
  generatePostVariants,
  updatePost,
  rewritePostVariant,
  switchPostChannel,
  restorePostChannelText,
  markPostManuallyPublished,
  generatePostOpeningOptions,
  generatePostQuestionClosings,
  improveExistingText,
  generateThreeSimilarPosts,
  generateSimilarPostsFromText,
  getPost,
  type PostSnapshot,
} from "@/lib/post.functions";
import {
  getPostPublicationInfo,
  publishPost,
  type PublishPlatform,
  type SafePublicationInfo,
} from "@/lib/publishing.functions";
import type { WorkspaceSnapshot, PostPlatform } from "@/lib/data-model";
import { businessTypeQuickStarts, normalizeBusinessType } from "@/lib/business-types";
import { contentPlaceholders, needsOfferDetails } from "@/lib/content-quality";
import { postCopyText } from "@/lib/post-editor";
import { copyText } from "@/lib/clipboard";
import { mainChannel, type MainChannel } from "@/lib/main-channel";
import { ContentReviewNotice } from "./content-review-notice";
import { appendQuestionClosing, replaceOpeningLine } from "@/lib/post-quick-actions";
import { saveBrandOfferDetails } from "@/lib/workspace.functions";
const labels: Record<PostPlatform, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
  youtube: "YouTube",
  "google-business": "Google Cégprofil",
};
const destinations: Record<PostPlatform, string> = {
  facebook: "https://www.facebook.com/",
  instagram: "https://www.instagram.com/",
  linkedin: "https://www.linkedin.com/feed/",
  tiktok: "https://www.tiktok.com/",
  youtube: "https://www.youtube.com/",
  "google-business": "https://business.google.com/",
};
export function EasyPost({
  workspace,
  initial = null,
  initialIdea = "",
  initialPlatform,
  showWelcome = false,
}: {
  workspace: WorkspaceSnapshot;
  initial?: PostSnapshot | null;
  initialIdea?: string;
  initialPlatform?: PostPlatform;
  showWelcome?: boolean;
}) {
  const { mode, change, pending: modePending } = useUiMode();
  const router = useRouter();
  const brand = initial
    ? workspace.brands.find((b) => b.id === initial.post.brandId)
    : workspace.activeBrand;
  const [post, setPost] = useState(initial);
  const [idea, setIdea] = useState(initialIdea);
  const [offerAnswer, setOfferAnswer] = useState("");
  const [pastedText, setPastedText] = useState("");
  const [improvementReasons, setImprovementReasons] = useState<Array<{ change: string; reason: string }>>([]);
  const [openingOptions, setOpeningOptions] = useState<Array<{ megkozelites: string; text: string }> | null>(null);
  const [closingQuestions, setClosingQuestions] = useState<string[] | null>(null);
  const [similarPosts, setSimilarPosts] = useState<PostSnapshot[]>([]);
  const [similarText, setSimilarText] = useState("");
  const [similarTextPosts, setSimilarTextPosts] = useState<PostSnapshot[]>([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const [selected, setSelected] = useState(() =>
    Math.max(
      0,
      initial?.variants.findIndex((v) => v.platform === mainChannel(brand?.profile)) ?? 0,
    ),
  );
  const [platforms, setPlatforms] = useState<PostPlatform[]>([
    initialPlatform ?? mainChannel(brand?.profile),
  ]);
  const [previousVersionId, setPreviousVersionId] = useState<string | null>(() => {
    const platform =
      initial?.variants[
        Math.max(
          0,
          initial.variants.findIndex((v) => v.platform === mainChannel(brand?.profile)),
        )
      ]?.platform;
    return (
      initial?.versions
        .slice()
        .reverse()
        .find((version) =>
          initial.variants.some((v) => v.id === version.variantId && v.platform !== platform),
        )?.id ?? null
    );
  });
  const [tone, setTone] = useState("");
  const [energy, setEnergy] = useState("");
  const [saveState, setSaveState] = useState("");
  const [shareAvailable, setShareAvailable] = useState(false);
  const [publicationInfo, setPublicationInfo] = useState<SafePublicationInfo | null>(null);
  const [publicationLoading, setPublicationLoading] = useState(false);
  const [publicationCheckFailed, setPublicationCheckFailed] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const blocked = !!busy || !hydrated;
  useEffect(() => setHydrated(true), []);
  useEffect(() => {
    if (!post) setIdea(initialIdea);
  }, [initialIdea, post]);
  useEffect(() => setShareAvailable(typeof navigator.share === "function"), []);
  const loadPost = useServerFn(getPost);
  const loadPublicationInfo = useServerFn(getPostPublicationInfo);
  const publish = useServerFn(publishPost);
  useEffect(() => {
    let active = true;
    if (!post?.post.id) {
      setPublicationInfo(null);
      setPublicationLoading(false);
      setPublicationCheckFailed(false);
      return;
    }
    setPublicationLoading(true);
    void loadPublicationInfo({ data: { postId: post.post.id } })
      .then((result) => {
        if (active) {
          setPublicationInfo(result);
          setPublicationCheckFailed(false);
        }
      })
      .catch(() => {
        if (active) {
          setPublicationInfo(null);
          setPublicationCheckFailed(true);
        }
      })
      .finally(() => {
        if (active) setPublicationLoading(false);
      });
    return () => {
      active = false;
    };
  }, [post?.post.id, loadPublicationInfo]);
  const [placeholderValues, setPlaceholderValues] = useState<Record<string, string>>({});
  const generation = useServerFn(generatePostVariants);
  const save = useServerFn(updatePost);
  const rewrite = useServerFn(rewritePostVariant);
  const switchChannel = useServerFn(switchPostChannel);
  const restoreChannel = useServerFn(restorePostChannelText);
  const mark = useServerFn(markPostManuallyPublished);
  const getOpenings = useServerFn(generatePostOpeningOptions);
  const getClosings = useServerFn(generatePostQuestionClosings);
  const improveText = useServerFn(improveExistingText);
  const makeSimilar = useServerFn(generateThreeSimilarPosts);
  const makeSimilarFromText = useServerFn(generateSimilarPostsFromText);
  const saveOfferDetails = useServerFn(saveBrandOfferDetails);
  const inFlight = useRef(false);
  useEffect(() => {
    if (initial && !editing && !inFlight.current) setPost(initial);
    // Only a new server revision should replace the local snapshot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial?.post.updatedAt]);
  const ideaTopics = [
    ...new Set([
      ...businessTypeQuickStarts(brand?.profile.businessType).filter(
        (topic) => !/facebook|instagram|google|tiktok|linkedin|youtube|reels?|blog/i.test(topic),
      ),
      "Új termék",
      "Akció",
      "Nyitvatartás",
      "Köszönet a vendégeknek",
      "Hétvégi ajánlat",
    ]),
  ].slice(0, 6);
  const generationBrand = useRef(brand?.id);
  useEffect(() => {
    generationBrand.current = brand?.id;
  }, [brand?.id]);
  // Route identity changes remount this component; mode changes do not discard the draft.
  const variant = post?.variants[selected];
  const fullText = variant ? postCopyText(variant) : "";
  const missing = contentPlaceholders(editing ? text : fullText);
  const published = variant?.status === "published";
  const manualPublishLabel = variant?.platform === "instagram" ? "az Instagramra" : "a Facebookra";
  const questionAlreadyAtEnd = fullText.replace(/#[\p{L}\p{N}_]+/gu, "").trim().endsWith("?");
  const directChannel: PublishPlatform | null =
    variant && (variant.platform === "facebook" || variant.platform === "instagram")
      ? variant.platform
      : null;
  const directConnection = directChannel
    ? publicationInfo?.connections.find((connection) => connection.provider === directChannel)
    : undefined;
  const requiredDirectScope = directChannel === "facebook" ? "pages_manage_posts" : "instagram_content_publish";
  const directChannelReady =
    directConnection?.status === "connected" &&
    directConnection.hasAccessToken &&
    directConnection.scopes.includes(requiredDirectScope);
  const hasInstagramJpeg = Boolean(
    post?.media.some(
      (asset) => post.post.mediaAssetIds.includes(asset.id) && asset.mimeType === "image/jpeg",
    ),
  );
  const dirty = editing && text !== fullText;
  useBlocker({
    enableBeforeUnload: () => dirty,
    shouldBlockFn: async () => {
      if (!dirty) return false;
      if (inFlight.current) {
        toast.error("A szöveg mentése még tart. Egy pillanat múlva folytathatod.");
        return true;
      }
      try {
        inFlight.current = true;
        setBusy("save");
        await persist(text);
        return false;
      } catch {
        setError("A szöveg mentése nem sikerült. Az oldalon maradtunk, hogy ne veszítsd el.");
        return true;
      } finally {
        inFlight.current = false;
        setBusy("");
      }
    },
  });
  async function run(name: string, action: () => Promise<unknown>) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(name);
    setError("");
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Nem sikerült. Próbáld újra.");
    } finally {
      inFlight.current = false;
      setBusy("");
    }
  }
  async function persist(value: string) {
    if (!post || !variant) return;
    setSaveState("Mentés…");
    const next = await save({
      data: {
        postId: post.post.id,
        expectedPostUpdatedAt: post.post.updatedAt,
        fields: {},
        variants: [
          {
            ...variant,
            content: value,
            cta: "",
            hashtags: [],
            status: published
              ? "published"
              : contentPlaceholders(value).length
                ? "draft"
                : "prepared",
          },
        ],
      },
    });
    if (!next) throw new Error("A mentés nem sikerült.");
    setPost(next);
    setSaveState("Automatikusan mentve");
    return next;
  }
  useEffect(() => {
    if (!editing || text === fullText || busy || error) return;
    const timer = setTimeout(() => {
      void run("save", async () => {
        await persist(text);
      });
    }, 800);
    return () => clearTimeout(timer);
    // A failed save is retried explicitly; it must not loop without the user's action.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, editing, busy, fullText, error]);
  async function create() {
    if (!brand) return;
    await run("generate", async () => {
      const activeId = brand.id;
      const result = await generation({
        data: {
          title: idea.trim().slice(0, 240),
          topic: idea,
          goal: "Érdeklődés és kapcsolattartás",
          audience: brand.audience,
          region: brand.cityRegion,
          language: brand.languageMarket,
          tone: mode === "detailed" && tone ? tone : brand.profile.tone,
          ctaStyle: brand.profile.ctaStyle,
          platforms: mode === "detailed" ? platforms : [mainChannel(brand.profile)],
          campaignContext:
            mode === "detailed" && energy ? `Kívánt szöveghangulat: ${energy}.` : undefined,
        },
      });
      if (!result) throw new Error("Nem érkezett posztszöveg. Próbáld újra.");
      if (generationBrand.current !== activeId)
        throw new Error(
          "Közben másik vállalkozásra váltottál. A posztot a Posztjaim között találod.",
        );
      setPost(result);
      setEditing(false);
      setSelected(0);
      setSaveState("Automatikusan mentve");
      await router.invalidate();
      await router.navigate({ to: "/app/posts/$id", params: { id: result.post.id } });
    });
  }
  async function improvePastedText() {
    await run("improve", async () => {
      const result = await improveText({ data: { text: pastedText } });
      if (!result.snapshot) throw new Error("A javított szöveget nem sikerült elmenteni.");
      setPost(result.snapshot);
      setSelected(0);
      setEditing(false);
      setImprovementReasons(result.reasons.slice(0, 3));
      setPastedText("");
      setSaveState("Automatikusan mentve");
      await router.invalidate();
    });
  }
  function asksForOfferDetails(brief: string) {
    return !!brand && (
      needsOfferDetails(
        {
          businessType: brand.profile.businessType,
          industry: brand.industry,
          products: brand.products,
          services: brand.services,
        },
        brief,
      ) || (normalizeBusinessType(brand.profile.businessType) === "other" && !brand.industry.trim())
    );
  }
  async function saveOfferAndRegenerate(destination: "home" | "result") {
    if (!brand) return;
    await run("offer", async () => {
      const answer = offerAnswer.trim();
      if (answer.length < 5) throw new Error("Írj legalább 5 karaktert a tevékenységről vagy a kínálatról.");
      const activeBrandId = brand.id;
      await saveOfferDetails({ data: { brandId: activeBrandId, answer } });
      setOfferAnswer("");
      await router.invalidate();
      if (destination !== "result" || !post || !variant) return;
      const result = await generation({
        data: {
          title: `Pontosított: ${post.post.title}`.slice(0, 240),
          topic: `${post.post.title}\n${answer}`,
          goal: "Érdeklődés és kapcsolattartás",
          audience: brand.audience,
          region: brand.cityRegion,
          language: brand.languageMarket,
          tone: brand.profile.tone,
          ctaStyle: brand.profile.ctaStyle,
          platforms: [variant.platform],
        },
      });
      if (!result) throw new Error("Az adatot elmentettük, de az új poszt nem készült el. Próbáld újra.");
      setPost(result);
      setSelected(0);
      setEditing(false);
      setSaveState("Automatikusan mentve");
      await router.invalidate();
      await router.navigate({ to: "/app/posts/$id", params: { id: result.post.id } });
    });
  }
  async function publishCurrentPost() {
    if (!post || !variant || !directChannel) return;
    await run("publish", async () => {
      if (missing.length) throw new Error("Előbb töltsd ki a jelölt adatokat.");
      let saved = post;
      if (editing && text !== fullText) {
        const updated = await persist(text);
        if (!updated)
          throw new Error("A szerkesztett poszt mentése nem sikerült; nem indult közzététel.");
        saved = updated;
      }
      await publish({ data: { postId: saved.post.id, platform: directChannel } });
      const [refreshedPost, refreshedPublication] = await Promise.all([
        loadPost({ data: { postId: saved.post.id } }),
        loadPublicationInfo({ data: { postId: saved.post.id } }),
      ]);
      setPost(refreshedPost);
      setPublicationInfo(refreshedPublication);
      setEditing(false);
      setSaveState("Közzétéve");
      toast.success(`${labels[directChannel]}-poszt közzétéve.`);
      await router.invalidate();
    });
  }
  async function loadQuickOptions(kind: "opening" | "closing") {
    if (!post || !variant) return;
    await run(kind, async () => {
      const data = {
        postId: post.post.id,
        variantId: variant.id,
        expectedPostUpdatedAt: post.post.updatedAt,
      };
      if (kind === "opening") {
        const result = await getOpenings({ data });
        setOpeningOptions(result.options);
        setClosingQuestions(null);
      } else {
        const result = await getClosings({ data });
        setClosingQuestions(result.questions);
        setOpeningOptions(null);
      }
    });
  }
  async function applyQuickText(value: string, position: "opening" | "closing") {
    if (!post || !variant) return;
    await run("save", async () => {
      const source = postCopyText(variant);
      const nextText = position === "opening"
        ? replaceOpeningLine(source, value)
        : appendQuestionClosing(source, value);
      const next = await save({
        data: {
          postId: post.post.id,
          expectedPostUpdatedAt: post.post.updatedAt,
          fields: {},
          variants: [{
            ...variant,
            content: nextText,
            cta: "",
            hashtags: [],
            status: contentPlaceholders(nextText).length ? "draft" : "prepared",
          }],
        },
      });
      if (!next) throw new Error("A változtatást nem sikerült elmenteni.");
      setPost(next);
      setPreviousVersionId(next.versions.filter((item) => item.variantId === variant.id).at(-1)?.id ?? null);
      setOpeningOptions(null);
      setClosingQuestions(null);
      setEditing(false);
      setSaveState("Automatikusan mentve");
      await router.invalidate();
    });
  }
  async function makeThreeSimilar() {
    if (!post || !variant) return;
    await run("similar", async () => {
      const result = await makeSimilar({
        data: { postId: post.post.id, variantId: variant.id, expectedPostUpdatedAt: post.post.updatedAt },
      });
      setSimilarPosts(result.posts);
      await router.invalidate();
    });
  }
  async function makeSimilarFromPastedText() {
    await run("similar", async () => {
      const result = await makeSimilarFromText({ data: { text: similarText } });
      setSimilarTextPosts(result.posts);
      await router.invalidate();
    });
  }
  async function copy(open = false) {
    await run("copy", async () => {
      if (!variant) return;
      if (missing.length) throw new Error("Másolás előtt töltsd ki a jelölt hiányzó adatokat.");
      const current = editing ? text : fullText;
      // Open synchronously in the user gesture, then close it if copying fails.
      const tab = open ? window.open("about:blank", "_blank") : null;
      try {
        if (editing) await persist(current);
        await copyText(current);
      } catch {
        tab?.close();
        throw new Error(
          "A böngésző nem engedte a másolást. Jelöld ki a szöveget, és másold kézzel.",
        );
      }
      if (tab) {
        tab.opener = null;
        tab.location.href = destinations[variant.platform];
      } else if (open) window.location.assign(destinations[variant.platform]);
      toast.success("A szöveget kimásoltuk.");
    });
  }
  async function selectChannel(channel: MainChannel) {
    if (!post || !variant || channel === variant.platform) return;
    await run("rewrite", async () => {
      // Flush edited text first; send the revision returned by the server, not stale state.
      const saved = editing && text !== fullText ? await persist(text) : post;
      const source = saved?.variants.find((v) => v.id === variant.id);
      if (!saved || !source) throw new Error("A mentett szöveg nem található.");
      const result = await switchChannel({
        data: {
          postId: saved.post.id,
          variantId: source.id,
          channel,
          expectedUpdatedAt: source.updatedAt,
        },
      });
      if (!result.snapshot) throw new Error("A posztot nem sikerült betölteni.");
      setPost(result.snapshot);
      setSelected(result.snapshot.variants.findIndex((v) => v.id === result.variantId));
      setPreviousVersionId(result.previousVersionId);
      setEditing(false);
      setSaveState("Automatikusan mentve");
      await router.invalidate();
    });
  }
  if (!brand)
    return (
      <Card className="p-6">
        <h1 className="text-2xl font-semibold">Add meg a vállalkozásod nevét</h1>
        <Link to="/app/brand" className="inline-flex min-h-11 items-center underline">
          Vállalkozásom →
        </Link>
      </Card>
    );
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      {!post && (
        <Card className="p-5 md:p-8">
          <h1 className="text-2xl font-semibold md:text-3xl">Mit szeretnél ma posztolni?</h1>
          {showWelcome && (
            <p className="mt-2 rounded-xl bg-secondary/40 p-3 text-sm" role="status">
              Üdvözlünk, {brand.name}! Válassz egy ötletet, vagy írd le a sajátodat.
            </p>
          )}
          <p className="mt-2 text-sm text-muted-foreground">
            Írd le pár szóval. A {brand.name} adatait és hangját használjuk.
          </p>
          {asksForOfferDetails(idea) && (
            <div className="mt-4 space-y-2 rounded-xl border border-amber-300 bg-amber-50 p-4">
              <label htmlFor="business-offer-answer" className="font-medium">
                {normalizeBusinessType(brand.profile.businessType) === "other" && !brand.industry.trim()
                  ? "Mivel foglalkozol? Egy-két mondatban"
                  : "Mit kínálsz? Egy mondatban."}
              </label>
              <p className="text-sm text-muted-foreground">
                Így konkrétabb poszt készül, kitalált termék vagy szolgáltatás nélkül.
              </p>
              <Input
                id="business-offer-answer"
                value={offerAnswer}
                maxLength={1000}
                disabled={blocked}
                onChange={(event) => setOfferAnswer(event.target.value)}
                placeholder="Például: kerékpárjavítást és szezonális átvizsgálást vállalok"
              />
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                disabled={blocked || offerAnswer.trim().length < 5}
                onClick={() => void saveOfferAndRegenerate("home")}
              >
                Mentés a Vállalkozásomhoz
              </Button>
            </div>
          )}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void create();
            }}
            className="mt-5 space-y-4"
          >
            <label className="block font-medium" htmlFor="easy-idea">
              Az ötleted vagy ajánlatod
            </label>
            <Textarea
              id="easy-idea"
              value={idea}
              maxLength={4000}
              disabled={blocked}
              onChange={(e) => setIdea(e.target.value)}
              className="min-h-28"
              placeholder={`Például: ${businessTypeQuickStarts(brand.profile.businessType)[0] ?? "mutassuk be, mit kínálunk ezen a héten"}`}
            />
            <div className="flex flex-wrap gap-2">
              {ideaTopics.map((topic) => (
                <Button
                  variant={idea === topic ? "secondary" : "outline"}
                  type="button"
                  key={topic}
                  className="h-auto min-h-11 whitespace-normal text-left"
                  aria-pressed={idea === topic}
                  disabled={blocked}
                  onClick={() => setIdea(topic)}
                >
                  {topic
                    .replace(/Reels?/gi, "rövid videó")
                    .replace(/carousel/gi, "több képes poszt")}
                </Button>
              ))}
            </div>
            {mode === "detailed" && (
              <details className="rounded-xl border p-3">
                <summary className="min-h-11 cursor-pointer font-semibold">Több beállítás</summary>
                <fieldset disabled={blocked} className="mt-3 flex flex-wrap gap-3">
                  <legend>Hol jelenjen meg?</legend>
                  {Object.entries(labels).map(([id, label]) => (
                    <label className="flex min-h-11 items-center gap-2" key={id}>
                      <input
                        type="checkbox"
                        checked={platforms.includes(id as PostPlatform)}
                        onChange={(e) =>
                          setPlatforms((v) =>
                            e.target.checked
                              ? [...v, id as PostPlatform]
                              : v.filter((p) => p !== id),
                          )
                        }
                      />
                      {label}
                    </label>
                  ))}
                </fieldset>
                <label className="mt-3 block">
                  Hangnem
                  <Input
                    disabled={blocked}
                    value={tone}
                    maxLength={160}
                    placeholder={brand.profile.tone}
                    onChange={(e) => setTone(e.target.value)}
                  />
                </label>
                <label className="mt-3 block">
                  Hangulat
                  <select
                    disabled={blocked}
                    className="mt-1 min-h-11 w-full rounded-md border bg-card p-2"
                    value={energy}
                    onChange={(e) => setEnergy(e.target.value)}
                  >
                    <option value="">A vállalkozásom alapján</option>
                    <option>Nyugodt</option>
                    <option>Lendületes</option>
                  </select>
                </label>
              </details>
            )}
            <Button
              className="min-h-11 w-full sm:w-auto"
              disabled={
                !!busy ||
                !hydrated ||
                workspace.user.emailVerified === false && workspace.user.canUseAi !== true ||
                idea.trim().length < 2 ||
                (mode === "detailed" && !platforms.length)
              }
            >
              {busy ? "Készül a posztod…" : "Poszt készítése"}
            </Button>
          </form>
          <details className="mt-6 rounded-xl border p-4">
            <summary className="min-h-11 cursor-pointer font-medium">Van már szövegem</summary>
            <p className="mt-2 text-sm text-muted-foreground">Illeszd be a saját szövegedet. A mondanivalót és a tényeket megtartjuk.</p>
            <Textarea
              aria-label="Saját szöveg"
              className="mt-3 min-h-32"
              value={pastedText}
              maxLength={10000}
              disabled={blocked}
              onChange={(event) => setPastedText(event.target.value)}
              placeholder="Illeszd be ide a posztodat…"
            />
            <Button className="mt-3 min-h-11" disabled={blocked || pastedText.trim().length < 10} onClick={() => void improvePastedText()}>
              Javítsd a szövegem
            </Button>
          </details>
          {mode === "detailed" && (
            <details className="mt-3 rounded-xl border p-4">
              <summary className="min-h-11 cursor-pointer font-medium">Ez bejött, készíts hasonlót</summary>
              <p className="mt-2 text-sm text-muted-foreground">A felépítést és a hosszát követjük, a szöveget nem másoljuk.</p>
              <Textarea aria-label="Jól működő poszt mintája" className="mt-3 min-h-32" value={similarText} maxLength={10000} disabled={blocked} onChange={(event) => setSimilarText(event.target.value)} placeholder="Illeszd be a mintának szánt posztot…" />
              <Button className="mt-3 min-h-11" disabled={blocked || similarText.trim().length < 10} onClick={() => void makeSimilarFromPastedText()}>Készíts 3 hasonlót</Button>
              {similarTextPosts.length > 0 && <ul className="mt-3 grid gap-2">{similarTextPosts.map((item) => <li key={item.post.id}><Link className="inline-flex min-h-11 items-center underline" to="/app/posts/$id" params={{ id: item.post.id }}>{item.post.title}</Link></li>)}</ul>}
            </details>
          )}
        </Card>
      )}
      {post && variant && (
        <Card className="space-y-4 p-5 md:p-8">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h1 className="text-2xl font-semibold">A posztod elkészült</h1>
            <span className="text-sm text-muted-foreground" role="status">
              {saveState || "Mentett poszt"}
            </span>
          </div>
          {mode === "simple" && (
            <div
              className="inline-flex rounded-xl border p-1"
              role="group"
              aria-label="Poszt csatornája"
            >
              {(["facebook", "instagram"] as const).map((channel) => (
                <Button
                  key={channel}
                  className="min-h-11"
                  variant={variant.platform === channel ? "default" : "ghost"}
                  aria-pressed={variant.platform === channel}
                  disabled={blocked || published}
                  onClick={() => void selectChannel(channel)}
                >
                  {labels[channel]}
                </Button>
              ))}
            </div>
          )}
          {previousVersionId && (
            <Button
              variant="outline"
              disabled={blocked}
              onClick={() =>
                void run("save", async () => {
                  const saved = editing && text !== fullText ? await persist(text) : post;
                  if (!saved) throw new Error("A mentett poszt nem található.");
                  const result = await restoreChannel({
                    data: {
                      postId: post.post.id,
                      versionId: previousVersionId,
                      expectedPostUpdatedAt: saved.post.updatedAt,
                    },
                  });
                  if (!result.snapshot) throw new Error("A visszaállítás nem sikerült.");
                  setPost(result.snapshot);
                  setSelected(result.snapshot.variants.findIndex((v) => v.id === result.variantId));
                  setPreviousVersionId(null);
                  setEditing(false);
                  await router.invalidate();
                })
              }
            >
              Előző szöveg visszaállítása
            </Button>
          )}
          {mode === "detailed" && post.variants.length > 1 && (
            <div className="flex flex-wrap gap-2" aria-label="Elkészült változatok">
              {post.variants.map((v, i) => (
                <Button
                  key={v.id}
                  variant={selected === i ? "default" : "outline"}
                  disabled={blocked || editing}
                  onClick={() => setSelected(i)}
                >
                  {labels[v.platform]}
                </Button>
              ))}
            </div>
          )}
          {improvementReasons.length > 0 && (
            <ul className="rounded-xl bg-secondary/30 p-3 text-sm" aria-label="Mi változott a szövegben">
              {improvementReasons.map((item, index) => <li key={`${item.change}-${index}`}><strong>{item.change}:</strong> {item.reason}</li>)}
            </ul>
          )}
          <p className="text-sm text-muted-foreground">
            {labels[variant.platform]} · {brand.name}
          </p>
          {asksForOfferDetails(post.post.title) && (
            <form
              className="space-y-2 rounded-xl border border-amber-300 bg-amber-50 p-4"
              onSubmit={(event) => {
                event.preventDefault();
                void saveOfferAndRegenerate("result");
              }}
            >
              <label htmlFor="result-offer-answer" className="font-medium">
                {normalizeBusinessType(brand.profile.businessType) === "other" && !brand.industry.trim()
                  ? "Mivel foglalkozol? Egy-két mondatban"
                  : "Mit kínálsz? Egy mondatban."}
              </label>
              <p className="text-sm text-muted-foreground">
                Kevés márkaadat áll rendelkezésre. Add meg a kínálatot, és a korábbi poszt megőrzése mellett készítünk egy pontosított változatot.
              </p>
              <Input
                id="result-offer-answer"
                value={offerAnswer}
                maxLength={1000}
                disabled={blocked}
                onChange={(event) => setOfferAnswer(event.target.value)}
                placeholder="Mit kínál a vállalkozásod?"
              />
              <Button className="min-h-11" disabled={blocked || offerAnswer.trim().length < 5}>
                Mentés és újragenerálás
              </Button>
            </form>
          )}
          {editing ? (
            <>
              <label htmlFor="easy-text">Poszt szövege</label>
              <Textarea
                id="easy-text"
                className="min-h-64"
                value={text}
                maxLength={30000}
                disabled={!hydrated || (!!busy && busy !== "save")}
                onChange={(e) => {
                  setError("");
                  setText(e.target.value);
                }}
              />
              <Button
                variant="outline"
                disabled={blocked}
                onClick={() =>
                  void run("save", async () => {
                    await persist(text);
                    setEditing(false);
                  })
                }
              >
                Szerkesztés kész
              </Button>
            </>
          ) : (
            <div className="whitespace-pre-wrap break-words rounded-2xl border bg-secondary/20 p-5 text-base leading-relaxed">
              {fullText}
            </div>
          )}
          {missing.length > 0 && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
              <p className="font-semibold">Ezt még egészítsd ki:</p>
              {missing.map((item) => (
                <form
                  key={item}
                  className="mt-2 flex flex-wrap items-end gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const value = placeholderValues[item]?.trim();
                    if (!value) return;
                    void run("save", async () => {
                      const next = (editing ? text : fullText).split(item).join(value);
                      await persist(next);
                      setText(next);
                    });
                  }}
                >
                  <label className="min-w-0 flex-1">
                    {item}
                    <Input
                      disabled={blocked}
                      value={placeholderValues[item] ?? ""}
                      onChange={(e) =>
                        setPlaceholderValues((v) => ({ ...v, [item]: e.target.value }))
                      }
                      maxLength={1000}
                    />
                  </label>
                  <Button variant="outline" disabled={blocked || !placeholderValues[item]?.trim()}>
                    Beillesztés
                  </Button>
                </form>
              ))}
            </div>
          )}
          <ContentReviewNotice
            warnings={variant.verificationWarnings}
            texts={[editing ? text : fullText]}
          />
          <div className="grid gap-2 sm:grid-cols-3">
            <Button className="min-h-11" disabled={blocked || missing.length > 0} onClick={() => void copy(true)}>
              Másolás és {labels[variant.platform]} megnyitása
            </Button>
            <Button
              className="min-h-11"
              variant="outline"
              disabled={blocked || editing || published}
              onClick={() => {
                setText(fullText);
                setEditing(true);
              }}
            >
              Szerkesztés
            </Button>
            <Button
              className="min-h-11"
              variant="outline"
              disabled={blocked || published}
              onClick={() =>
                void run("rewrite", async () => {
                  if (editing) await persist(text);
                  const result = await rewrite({
                    data: { postId: post.post.id, variantId: variant.id, style: "alternative" },
                  });
                  setPost(result);
                  setEditing(false);
                  await router.invalidate();
                })
              }
            >
              Másik változat
            </Button>
          </div>
          {mode === "detailed" && directChannel && directChannelReady && !published && (
            <div className="space-y-2 rounded-xl border border-primary/20 bg-primary/5 p-4">
              <p className="font-medium">Közvetlen közzététel</p>
              {publicationLoading ? (
                <p className="text-sm text-muted-foreground" role="status">
                  Ellenőrizzük a csatorna kapcsolatát…
                </p>
              ) : directChannelReady ? (
                <>
                  <Button
                    className="min-h-11 w-full sm:w-auto"
                    disabled={blocked || missing.length > 0 || (directChannel === "instagram" && !hasInstagramJpeg)}
                    onClick={() => void publishCurrentPost()}
                  >
                    {busy === "publish" ? "Közzététel…" : `${labels[directChannel]}-poszt közzététele`}
                  </Button>
                  {directChannel === "instagram" && !hasInstagramJpeg && (
                    <p className="text-sm text-muted-foreground">
                      Instagram-poszthoz előbb adj hozzá egy JPEG-képet a poszt szerkesztésénél.
                    </p>
                  )}
                  {missing.length > 0 && (
                    <p className="text-sm text-muted-foreground">
                      Közzététel előtt töltsd ki a posztban jelölt hiányzó adatokat.
                    </p>
                  )}
                </>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    {publicationCheckFailed
                      ? "A csatorna kapcsolatát most nem sikerült ellenőrizni. Másolással továbbra is közzéteheted kézzel."
                      : directConnection?.status === "expired"
                        ? `A ${labels[directChannel]}-kapcsolat lejárt. Csatlakoztasd újra a közvetlen közzétételhez.`
                        : directConnection?.status === "connected"
                          ? `A ${labels[directChannel]}-közzétételhez újra kell csatlakoztatni a fiókot a szükséges engedélyekkel.`
                          : directConnection
                            ? `A ${labels[directChannel]}-kapcsolat nem aktív. Nyisd meg a csatornabeállításokat.`
                            : `A ${labels[directChannel]}-fiók nincs csatlakoztatva. Másolással most is közzéteheted kézzel.`}
                  </p>
                  <Link to="/app/channels" className="inline-flex min-h-11 items-center font-medium text-primary underline underline-offset-4">
                    {directConnection ? "Csatornák beállítása" : "Csatorna csatlakoztatása"}
                  </Link>
                </div>
              )}
            </div>
          )}
          {!editing && !published && mode === "simple" && (
            <div className="space-y-3 rounded-xl border p-3">
              <p className="text-sm font-medium">Finomíts rajta</p>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" disabled={blocked} onClick={() => void loadQuickOptions("opening")}>Erősebb nyitósor</Button>
                {!questionAlreadyAtEnd && <Button variant="outline" disabled={blocked} onClick={() => void loadQuickOptions("closing")}>Kérdéssel zárom</Button>}
                {(["shorter", "friendlier"] as const).map((style) => (
                  <Button key={style} variant="outline" disabled={blocked} onClick={() => void run("rewrite", async () => {
                    const saved = editing && text !== fullText ? await persist(text) : post;
                    if (!saved) throw new Error("A mentett poszt nem található.");
                    setPost(await rewrite({ data: { postId: saved.post.id, variantId: variant.id, style } }));
                    setEditing(false);
                    await router.invalidate();
                  })}>
                    {style === "shorter" ? "Rövidebb" : "Barátságosabb"}
                  </Button>
                ))}
              </div>
              {openingOptions && (
                <div className="grid gap-2">
                  {openingOptions.map((option) => (
                    <Button key={option.megkozelites} variant="outline" className="h-auto min-h-11 whitespace-normal text-left" disabled={blocked} onClick={() => void applyQuickText(option.text, "opening")}>
                      <span className="mr-2 font-semibold">{option.megkozelites}:</span>{option.text}
                    </Button>
                  ))}
                </div>
              )}
              {closingQuestions && (
                <div className="grid gap-2">
                  {closingQuestions.map((question) => (
                    <Button key={question} variant="outline" className="h-auto min-h-11 whitespace-normal text-left" disabled={blocked} onClick={() => void applyQuickText(question, "closing")}>
                      {question}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          )}
          {mode === "detailed" && !editing && !published && (
            <div className="space-y-3 rounded-xl border p-3">
              <Button variant="outline" disabled={blocked} onClick={() => void makeThreeSimilar()}>Még 3 hasonló</Button>
              {similarPosts.length > 0 && (
                <ul className="grid gap-2 sm:grid-cols-3">
                  {similarPosts.map((item) => <li key={item.post.id}><Link className="inline-flex min-h-11 items-center underline" to="/app/posts/$id" params={{ id: item.post.id }}>{item.post.title}</Link></li>)}
                </ul>
              )}
            </div>
          )}
          {mode === "detailed" && <div className="flex flex-wrap gap-2">
            {(
              [
                ["shorter", "Rövidebb"],
                ["friendlier", "Barátságosabb"],
              ] as const
            ).map(([style, label]) => (
              <Button
                key={style}
                variant="outline"
                disabled={blocked || published}
                onClick={() =>
                  void run("rewrite", async () => {
                    if (editing) await persist(text);
                    setPost(
                      await rewrite({
                        data: { postId: post.post.id, variantId: variant.id, style },
                      }),
                    );
                    setEditing(false);
                    await router.invalidate();
                  })
                }
              >
                {label}
              </Button>
            ))}
            <Button
              variant="outline"
              disabled={blocked || published}
              onClick={() =>
                void run("publish", async () => {
                  if (missing.length) throw new Error("Előbb töltsd ki a jelölt hiányzó adatokat.");
                  if (editing) await persist(text);
                  setPost(await mark({ data: { postId: post.post.id, variantId: variant.id } }));
                  await router.invalidate();
                })
              }
            >
              {published ? "Közzétéve · kézzel jelölve" : "Közzétettem"}
            </Button>
          </div>}
          {mode === "simple" && <>
            <p className="text-sm text-muted-foreground">
              Másold ki, és tedd közzé {variant.platform === "instagram" ? "az Instagramon" : "a Facebookon"}.
            </p>
            <label className="flex min-h-11 items-center gap-3 border-t pt-3 font-medium">
              <input
                type="checkbox"
                className="size-5 accent-primary"
                checked={published}
                disabled={blocked || published || missing.length > 0}
                onChange={(event) => {
                  if (!event.currentTarget.checked) return;
                  void run("publish", async () => {
                    const saved = editing && text !== fullText ? await persist(text) : post;
                    if (!saved) throw new Error("A mentett poszt nem található.");
                    setPost(await mark({ data: { postId: saved.post.id, variantId: variant.id } }));
                    setEditing(false);
                    await router.invalidate();
                  });
                }}
              />
              {published ? "Már kitettem a posztot " + manualPublishLabel : "Kitettem a posztot " + manualPublishLabel}
            </label>
          </>}
          {mode === "detailed" && shareAvailable && (
            <Button
              variant="outline"
              disabled={blocked}
              onClick={() =>
                void run("share", async () => {
                  if (missing.length) throw new Error("Előbb töltsd ki a hiányzó adatokat.");
                  const value = editing ? text : fullText;
                  if (editing) await persist(value);
                  await copyText(value);
                  try {
                    await navigator.share({ text: value });
                  } catch (cause) {
                    if (cause instanceof DOMException && cause.name === "AbortError") return;
                    throw new Error(
                      "A megosztás most nem sikerült. A kimásolt szöveget beillesztheted a közösségi oldalon.",
                    );
                  }
                })
              }
            >
              Megosztás a telefonról
            </Button>
          )}
          <ImageAttachment post={post} disabled={blocked} onSaved={setPost} />
        </Card>
      )}
      {busy && (
        <p role="status">
          {busy === "save"
            ? "Mentés…"
            : busy === "opening" || busy === "closing"
              ? "Lehetőségek készülnek…"
              : busy === "improve"
                ? "Javítjuk a szöveget…"
                : busy === "similar"
                  ? "Három új poszt készül…"
            : busy === "rewrite"
              ? "Átírjuk a szöveget…"
              : busy === "generate"
                ? "Készül a posztod…"
                : "Egy pillanat…"}
        </p>
      )}
      {error && (
        <div role="alert" className="rounded-xl border border-destructive bg-card p-4">
          <p>{error}</p>
          {editing && (
            <Button
              variant="outline"
              disabled={blocked}
              onClick={() => void run("save", () => persist(text))}
            >
              Mentés újrapróbálása
            </Button>
          )}
        </div>
      )}
      {mode === "simple" && (
        <button
          type="button"
          disabled={modePending || blocked}
          className="min-h-11 text-sm text-muted-foreground underline"
          onClick={() => void change("detailed")}
        >
          Több lehetőség kell? Kapcsold be a Részletes módot.
        </button>
      )}
    </div>
  );
}
function ImageAttachment({
  post,
  disabled,
  onSaved,
}: {
  post: PostSnapshot;
  disabled: boolean;
  onSaved: (value: PostSnapshot | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const save = useServerFn(updatePost);
  return (
    <details className="rounded-xl border p-3">
      <summary className="min-h-11 cursor-pointer font-medium">Kép hozzáadása</summary>
      <div className="mt-3 space-y-3">
        {post.media
          .filter((m) => m.mimeType.startsWith("image/"))
          .map((asset) => (
            <div key={asset.id}>
              <img
                src={`/api/media/${asset.id}`}
                alt={asset.filename}
                className="max-h-72 rounded-xl object-contain"
              />
              <a
                download={asset.filename}
                href={`/api/media/${asset.id}`}
                className="inline-flex min-h-11 items-center underline"
              >
                Kép mentése
              </a>
            </div>
          ))}
        <label className="inline-flex min-h-11 cursor-pointer items-center rounded-xl border px-4">
          {busy ? "Kép feltöltése…" : "Kép kiválasztása"}
          <input
            className="sr-only"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={disabled || busy}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setBusy(true);
              try {
                const data = new FormData();
                data.append("file", file);
                data.append("brandId", post.post.brandId);
                const response = await fetch("/api/media", { method: "POST", body: data });
                const body = await response.json();
                if (!response.ok) throw new Error(body.error || "A feltöltés nem sikerült.");
                const asset = body.asset ?? body;
                onSaved(
                  await save({
                    data: {
                      postId: post.post.id,
                      fields: { mediaAssetIds: [...post.post.mediaAssetIds, asset.id] },
                    },
                  }),
                );
                toast.success("Kép hozzáadva.");
              } catch (cause) {
                toast.error(cause instanceof Error ? cause.message : "A feltöltés nem sikerült.");
              } finally {
                setBusy(false);
                e.target.value = "";
              }
            }}
          />
        </label>
      </div>
    </details>
  );
}
