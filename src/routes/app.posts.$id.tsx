import { useEffect, useMemo, useRef, useState } from "react";
import {
  createFileRoute,
  Link,
  useNavigate,
  useRouter,
  useRouterState,
} from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/app-chrome";
import { PostVideoComposer } from "@/components/post-video-composer";
import { PostCreativeComposer } from "@/components/post-creative-composer";
import { PlatformMark, SocialPreview } from "@/components/social-preview";
import { getWorkspace } from "@/lib/workspace.functions";
import {
  getPost,
  createPostDraft,
  updatePost,
  generatePostVariants,
  generatePostHooks,
  generatePostABVariants,
  generatePostAdCopies,
  updatePostMedia,
  type PostSnapshot,
} from "@/lib/post.functions";
import { getCampaigns, type CampaignSnapshot } from "@/lib/campaign.functions";
import { getMediaAssets } from "@/lib/media.functions";
import { brandImagePrompt, streamImage } from "@/lib/stream-image";
import {
  defaultPostPlatforms,
  postCopyText,
  postTitle,
  publicationBlockReason,
  saveThenPublish,
} from "@/lib/post-editor";
import { formatPostScheduleInput, parsePostScheduleInput } from "@/lib/post-schedule";
import type {
  PostAbVariantRecord,
  PostAdCopyRecord,
  PostPlatform,
  PostStatus,
  PostVariantRecord,
  WorkspaceSnapshot,
} from "@/lib/data-model";
import {
  getPostPublicationInfo,
  publishPost,
  retryPostPublication,
  type PublishPlatform,
  type SafePublicationInfo,
} from "@/lib/publishing.functions";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CalendarDays,
  ChevronDown,
  Copy,
  Clock3,
  Eye,
  Image as ImageIcon,
  Loader2,
  Megaphone,
  Save,
  Send,
  Sparkles,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/posts/$id")({
  loader: async ({ params }) => ({
    workspace: await getWorkspace(),
    post: params.id === "new" ? null : await getPost({ data: { postId: params.id } }),
    publication:
      params.id === "new" ? null : await getPostPublicationInfo({ data: { postId: params.id } }),
    media: await getMediaAssets(),
    campaigns: await getCampaigns(),
  }),
  component: PostEditor,
});

const STEPS = ["Cél", "Közönség", "Csatorna", "Tartalom", "Időzítés", "Ellenőrzés"];
const GOALS = [
  "ajánlat",
  "érdeklődőszerzés",
  "weboldal-forgalom",
  "engagement",
  "információ",
  "esemény",
  "hasznos tipp",
  "kulisszák mögött",
];
const PLATFORMS: Array<{ id: PostPlatform; label: string }> = [
  { id: "facebook", label: "Facebook" },
  { id: "instagram", label: "Instagram" },
  { id: "tiktok", label: "TikTok" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "youtube", label: "YouTube" },
  { id: "google-business", label: "Google Business" },
];
const STATUS_LABELS: Record<PostStatus, string> = {
  idea: "Ötlet",
  draft: "Piszkozat",
  review: "Ellenőrzés",
  scheduled: "Ütemezve",
  published: "Közzétéve",
  failed: "Sikertelen",
};

type FormState = {
  title: string;
  goal: string;
  audience: string;
  topic: string;
  region: string;
  language: string;
  tone: string;
  ctaStyle: string;
  campaignId: string;
  platforms: PostPlatform[];
  status: PostStatus;
  scheduledAt: string;
  timezone: string;
  mediaAssetIds: string[];
};
type UpdateForm = <K extends keyof FormState>(key: K, value: FormState[K]) => void;

function PostEditor() {
  const data = Route.useLoaderData();
  const navigate = useNavigate();
  const router = useRouter();
  const search = useRouterState({ select: (state) => state.location.searchStr });
  const generatedPostId = useRef<string | null>(null);
  const loadedEditor = useRef<string | null>(null);
  const brand = data.post
    ? (data.workspace.brands.find((item) => item.id === data.post?.post.brandId) ?? null)
    : data.workspace.activeBrand;
  const [step, setStep] = useState(0);
  const [simpleMode, setSimpleMode] = useState(true);
  const [form, setForm] = useState<FormState>(() => initialForm(data.post, brand));
  const [variants, setVariants] = useState<PostVariantRecord[]>(data.post?.variants ?? []);
  const [selectedPlatform, setSelectedPlatform] = useState<PostPlatform>(
    data.post?.variants[0]?.platform ?? "facebook",
  );
  const [hooks, setHooks] = useState<string[]>(data.post?.hooks ?? []);
  const [selectedHook, setSelectedHook] = useState<string | null>(
    data.post?.post.selectedHook ?? null,
  );
  const [abVariants, setAbVariants] = useState<PostAbVariantRecord[]>(data.post?.abVariants ?? []);
  const [adCopies, setAdCopies] = useState<PostAdCopyRecord[]>(data.post?.adCopies ?? []);
  const [generating, setGenerating] = useState(false);
  const [extrasBusy, setExtrasBusy] = useState<"hooks" | "ab" | "ads" | null>(null);
  const [imageBusy, setImageBusy] = useState(false);
  const [creativeBusy, setCreativeBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleZone, setScheduleZone] = useState("Europe/Bucharest");
  const [scheduleError, setScheduleError] = useState("");
  const previousSchedule = useRef<{
    id: string;
    scheduledAt: string;
    timezone: string;
    status: PostStatus;
  } | null>(null);
  const generate = useServerFn(generatePostVariants);
  const generateHooks = useServerFn(generatePostHooks);
  const generateAB = useServerFn(generatePostABVariants);
  const generateAds = useServerFn(generatePostAdCopies);
  const create = useServerFn(createPostDraft);
  const save = useServerFn(updatePost);
  const loadPost = useServerFn(getPost);
  const saveMedia = useServerFn(updatePostMedia);
  const publish = useServerFn(publishPost);
  const retryPublish = useServerFn(retryPostPublication);
  const [publishingPlatform, setPublishingPlatform] = useState<PublishPlatform | null>(null);
  const publicationInFlight = useRef(false);
  const editorIdentity = `${data.post?.post.id ?? "new"}:${brand?.id ?? ""}:${search}`;

  useEffect(() => {
    // Loader refreshes must not discard text being edited in this same post.
    if (loadedEditor.current === editorIdentity) return;
    loadedEditor.current = editorIdentity;
    const next = initialForm(data.post, brand);
    if (data.post) {
      const keepBrief = generatedPostId.current === data.post.post.id;
      setForm((current) =>
        keepBrief ? { ...next, ...current, title: next.title, status: next.status } : next,
      );
    } else {
      const params = new URLSearchParams(search);
      const topic = params.get("topic")?.trim();
      const goal = params.get("goal")?.trim();
      const platform = params.get("platform") as PostPlatform | null;
      setForm({
        ...next,
        title: topic || next.title,
        topic: topic || next.topic,
        goal: goal || next.goal,
        platforms:
          platform && PLATFORMS.some((item) => item.id === platform) ? [platform] : next.platforms,
      });
    }
    setStep(data.post?.variants.length ? 3 : 0);
    setVariants(data.post?.variants ?? []);
    setHooks(data.post?.hooks ?? []);
    setSelectedHook(data.post?.post.selectedHook ?? null);
    setAbVariants(data.post?.abVariants ?? []);
    setAdCopies(data.post?.adCopies ?? []);
    generatedPostId.current = null;
  }, [editorIdentity, data.post, brand, search]);

  useEffect(() => {
    const post = data.post?.post;
    const previous = previousSchedule.current;
    const next = post
      ? {
          id: post.id,
          scheduledAt: formatPostScheduleInput(post.scheduledAt, post.timezone),
          timezone: post.timezone,
          status: post.status,
        }
      : null;
    previousSchedule.current = next;
    if (!previous || !next || previous.id !== next.id) return;
    if (
      previous.scheduledAt === next.scheduledAt &&
      previous.timezone === next.timezone &&
      previous.status === next.status
    )
      return;
    // Refresh Calendar/Planner changes without discarding unsaved text or scheduling edits.
    setForm((current) =>
      current.scheduledAt === previous.scheduledAt &&
      current.timezone === previous.timezone &&
      current.status === previous.status
        ? {
            ...current,
            scheduledAt: next.scheduledAt,
            timezone: next.timezone,
            status: next.status,
          }
        : current,
    );
    setScheduleDate((current) => (current === previous.scheduledAt ? next.scheduledAt : current));
    setScheduleZone((current) => (current === previous.timezone ? next.timezone : current));
  }, [data.post]);

  const activeMedia = useMemo(
    () =>
      data.media.filter(
        (asset) => asset.brandId === brand?.id && asset.workspaceId === data.workspace.workspace.id,
      ),
    [data.media, brand?.id, data.workspace.workspace.id],
  );
  const activeCampaigns = useMemo(
    () =>
      data.campaigns.filter(
        (campaign) =>
          campaign.brandId === brand?.id && campaign.workspaceId === data.workspace.workspace.id,
      ),
    [data.campaigns, brand?.id, data.workspace.workspace.id],
  );
  const editorPlatform =
    variants.find((variant) => variant.platform === selectedPlatform)?.platform ??
    variants[0]?.platform ??
    form.platforms[0] ??
    "facebook";
  if (!brand) {
    return (
      <Card className="rounded-3xl p-10 text-center">
        <Sparkles className="mx-auto h-8 w-8 text-brand" />
        <h2 className="mt-3 text-lg font-semibold">Még nincs aktív márkád</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Poszt készítése előtt hozz létre egy márkát.
        </p>
        <Link to="/app/brand">
          <Button className="mt-4 rounded-full">Márka létrehozása</Button>
        </Link>
      </Card>
    );
  }
  const activeBrand = brand;

  const update: UpdateForm = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  function togglePlatform(platform: PostPlatform) {
    update(
      "platforms",
      form.platforms.includes(platform)
        ? form.platforms.filter((item) => item !== platform)
        : [...form.platforms, platform],
    );
  }
  async function handleGenerate() {
    if (
      generating ||
      creativeBusy ||
      saving ||
      publicationInFlight.current ||
      form.topic.trim().length < 2 ||
      !form.platforms.length
    )
      return;
    setGenerating(true);
    try {
      const campaign = activeCampaigns.find((item) => item.id === form.campaignId);
      const campaignContext = campaign
        ? `Kampány: ${campaign.name}. Cél: ${campaign.objective}. Közönség: ${campaign.audience}. Ajánlat: ${campaign.offer}. CTA: ${campaign.cta}. Stratégia: ${campaign.strategy?.summary ?? ""}. Fő üzenet: ${campaign.strategy?.mainMessage ?? ""}.`
        : undefined;
      const result = await generate({
        data: {
          postId: data.post?.post.id,
          title: postTitle(form.title, form.topic),
          goal: form.goal,
          audience: form.audience,
          topic: form.topic,
          region: form.region,
          language: form.language,
          tone: form.tone,
          ctaStyle: form.ctaStyle,
          platforms: form.platforms,
          campaignContext,
        },
      });
      if (!result) throw new Error("A generálás nem adott vissza posztot.");
      await save({
        data: {
          postId: result.post.id,
          fields: { campaignId: form.campaignId || null, mediaAssetIds: form.mediaAssetIds },
          createVersion: false,
        },
      });
      generatedPostId.current = result.post.id;
      setForm((current) => ({ ...current, title: result.post.title, status: result.post.status }));
      setVariants(result.variants);
      setHooks(result.hooks);
      setSelectedHook(result.post.selectedHook ?? null);
      setAbVariants(result.abVariants);
      setAdCopies(result.adCopies);
      setStep(3);
      toast.success("A posztszöveg elkészült és piszkozatként mentve.");
      if (data.post?.post.id === result.post.id) await router.invalidate();
      else await navigate({ to: "/app/posts/$id", params: { id: result.post.id } });
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Nem sikerült generálni.");
    } finally {
      setGenerating(false);
    }
  }
  async function saveDraft(schedule?: { scheduledAt: string; timezone: string }) {
    if (
      saving ||
      generating ||
      extrasBusy ||
      imageBusy ||
      creativeBusy ||
      publicationInFlight.current
    )
      return false;
    setSaving(true);
    try {
      const values = schedule ? { ...form, ...schedule, status: "scheduled" as const } : form;
      const scheduledAt = parsePostScheduleInput(values.scheduledAt, values.timezone);
      if (values.status === "scheduled" && !scheduledAt)
        throw new Error("Válassz időpontot az időzített poszthoz.");
      if (schedule && scheduledAt && new Date(scheduledAt).getTime() <= Date.now())
        throw new Error("Válassz egy jövőbeli időpontot.");
      const fields = {
        title: postTitle(values.title, values.topic),
        goal: values.goal,
        audience: values.audience,
        language: values.language,
        tone: values.tone,
        ...(values.status !== "published" ? { status: values.status } : {}),
        scheduledAt,
        timezone: values.timezone,
        mediaAssetIds: values.mediaAssetIds,
        platforms: values.platforms,
        campaignId: values.campaignId || null,
      };
      const result = data.post
        ? await save({
            data: {
              postId: data.post.post.id,
              fields,
              variants: variants.filter((variant) => variant.status !== "published"),
              hooks,
              selectedHook,
              abVariants,
              adCopies,
            },
          })
        : await create({ data: { ...fields, brandId: brand!.id } });
      if (!result) throw new Error("A mentés nem adott vissza posztot.");
      if (schedule) {
        setForm((current) => ({ ...current, ...schedule, status: "scheduled" }));
        setScheduleOpen(false);
      }
      toast.success(
        schedule ? "Időpont mentve. A posztod megjelenik a naptárban." : "Poszt mentve.",
      );
      if (!data.post) await navigate({ to: "/app/posts/$id", params: { id: result.post.id } });
      else await router.invalidate();
      return true;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Nem sikerült menteni.";
      if (schedule) setScheduleError(message);
      toast.error(message);
      return false;
    } finally {
      setSaving(false);
    }
  }
  function openSchedule() {
    setScheduleDate(form.scheduledAt);
    setScheduleZone(form.timezone);
    setScheduleError("");
    setScheduleOpen(true);
  }
  async function saveMediaSelection() {
    if (publicationInFlight.current) return;
    if (!data.post) {
      setStep(5);
      return;
    }
    try {
      await saveMedia({ data: { postId: data.post.post.id, mediaAssetIds: form.mediaAssetIds } });
      toast.success("Média hozzárendelve.");
      await router.invalidate();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Nem sikerült menteni a médiát.");
    }
  }
  const currentVariant = (id: string, key: "content" | "cta" | "hashtags", value: string) =>
    setVariants((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              [key]:
                key === "hashtags"
                  ? value
                      .split(" ")
                      .map((tag) => tag.trim())
                      .filter(Boolean)
                  : value,
            }
          : item,
      ),
    );
  const currentAbVariant = (id: string, key: "content" | "cta" | "hashtags", value: string) =>
    setAbVariants((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              [key]:
                key === "hashtags"
                  ? value
                      .split(" ")
                      .map((tag) => tag.trim())
                      .filter(Boolean)
                  : value,
            }
          : item,
      ),
    );
  async function createHooks() {
    if (!data.post || extrasBusy || publicationInFlight.current) return;
    setExtrasBusy("hooks");
    try {
      const result = await generateHooks({ data: { postId: data.post.post.id, count: 4 } });
      setHooks(result.hooks);
      setSelectedHook(result.hooks[0] ?? null);
      toast.success("Hook ötletek elkészültek.");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Nem sikerült hookokat generálni.");
    } finally {
      setExtrasBusy(null);
    }
  }
  async function createABVariants() {
    if (!data.post || extrasBusy || publicationInFlight.current || !form.platforms.length) return;
    setExtrasBusy("ab");
    const platform = editorPlatform;
    try {
      const result = await generateAB({
        data: { postId: data.post.post.id, platform, count: 3 },
      });
      setAbVariants((current) => [
        ...current.filter((item) => item.platform !== platform),
        ...result.variants,
      ]);
      toast.success("A/B változatok elkészültek.");
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : "Nem sikerült A/B változatokat generálni.",
      );
    } finally {
      setExtrasBusy(null);
    }
  }
  async function createAdCopies() {
    if (!data.post || extrasBusy || publicationInFlight.current) return;
    setExtrasBusy("ads");
    try {
      const result = await generateAds({ data: { postId: data.post.post.id, count: 3 } });
      setAdCopies(result.adCopies);
      toast.success("Meta hirdetésszövegek elkészültek.");
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : "Nem sikerült hirdetésszöveget generálni.",
      );
    } finally {
      setExtrasBusy(null);
    }
  }
  async function createImageForPost() {
    if (!data.post || imageBusy || publicationInFlight.current) return;
    setImageBusy(true);
    try {
      let imageUrl = "";
      await streamImage(
        brandImagePrompt({
          topic: form.topic || form.title,
          brand: activeBrand.name,
          industry: activeBrand.industry,
          businessType: activeBrand.profile.businessType,
          tone: activeBrand.profile.tone,
          colors: activeBrand.profile.colors,
          format: "Social media poszt",
        }),
        (dataUrl, isFinal) => {
          if (isFinal) imageUrl = dataUrl;
        },
        { brandId: activeBrand.id, format: "Social media poszt" },
      );
      if (!imageUrl) throw new Error("A kép nem készült el.");
      const blob = await (await fetch(imageUrl)).blob();
      const payload = new FormData();
      payload.append("file", blob, `${activeBrand.name}-poszt.png`);
      payload.append("brandId", activeBrand.id);
      payload.append("source", "ai");
      payload.append("altText", form.topic || form.title);
      const upload = await fetch("/api/media", { method: "POST", body: payload });
      if (!upload.ok) throw new Error("A kép Médiatárba mentése sikertelen.");
      const result = (await upload.json()) as { asset?: { id: string } };
      if (!result.asset?.id) throw new Error("A média mentése nem adott azonosítót.");
      const mediaAssetIds = [...new Set([...form.mediaAssetIds, result.asset.id])];
      await saveMedia({ data: { postId: data.post.post.id, mediaAssetIds } });
      update("mediaAssetIds", mediaAssetIds);
      await router.invalidate();
      toast.success("Az AI-kép elkészült és a poszthoz lett rendelve.");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Nem sikerült AI-képet készíteni.");
    } finally {
      setImageBusy(false);
    }
  }

  async function handlePublish(platform: PublishPlatform, attemptId?: string) {
    if (
      !data.post ||
      publicationInFlight.current ||
      saving ||
      generating ||
      extrasBusy !== null ||
      imageBusy ||
      creativeBusy
    )
      return;
    const variant = variants.find((item) => item.platform === platform);
    const reason = publicationBlockReason(
      platform,
      data.publication?.connections.find((item) => item.provider === platform),
      variant,
      activeMedia.some(
        (asset) => form.mediaAssetIds.includes(asset.id) && asset.mimeType === "image/jpeg",
      ),
    );
    if (reason || !variant) {
      toast.error(reason ?? "Ehhez a csatornához nincs posztszöveg.");
      return;
    }
    publicationInFlight.current = true;
    setPublishingPlatform(platform);
    try {
      const postId = data.post.post.id;
      const result = await saveThenPublish(
        async () => {
          const saved = await save({
            data: {
              postId,
              fields: { mediaAssetIds: form.mediaAssetIds },
              variants: [variant],
            },
          });
          if (!saved) throw new Error("A szöveg mentése nem sikerült; nem indult közzététel.");
        },
        () =>
          attemptId
            ? retryPublish({ data: { postId, platform, attemptId } })
            : publish({ data: { postId, platform } }),
      );
      setForm((current) => ({ ...current, status: "published" }));
      setVariants((current) =>
        current.map((item) => (item.id === variant.id ? { ...item, status: "published" } : item)),
      );
      toast.success(
        `${platform === "facebook" ? "Facebook" : "Instagram"} közzététel sikeres. Külső azonosító: ${result.externalId}`,
      );
      await router.invalidate();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "A publikálás sikertelen volt.");
      const snapshot = await loadPost({ data: { postId: data.post.post.id } }).catch(() => null);
      if (snapshot) {
        setForm((current) => ({ ...current, status: snapshot.post.status }));
        setVariants((current) =>
          current.map((item) => ({
            ...item,
            status: snapshot.variants.find((saved) => saved.id === item.id)?.status ?? item.status,
          })),
        );
      }
      await router.invalidate();
    } finally {
      publicationInFlight.current = false;
      setPublishingPlatform(null);
    }
  }

  return (
    <div id="post-studio-editor" className="post-studio space-y-8">
      <PageHeader
        title={data.post ? "Poszt szerkesztése" : "Új poszt készítése"}
        sub={`${brand.name} · egy rövid kérésből szerkeszthető, mentett poszt`}
        action={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" className="xl:hidden">
              <a href="#post-preview">
                <Eye className="mr-1 h-4 w-4" />
                Előnézet
              </a>
            </Button>
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => setSimpleMode((current) => !current)}
            >
              {simpleMode ? "Részletes szerkesztő" : "Egyszerű szerkesztő"}
            </Button>
            <Link to="/app/posts">
              <Button variant="outline" className="rounded-full">
                <ArrowLeft className="mr-1 h-4 w-4" />
                Posztok
              </Button>
            </Link>
          </div>
        }
      />
      <div
        className={
          simpleMode
            ? "grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_300px]"
            : "grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_300px] 2xl:grid-cols-[170px_minmax(0,1fr)_300px]"
        }
      >
        {!simpleMode && (
          <Card className="h-fit rounded-3xl border-0 bg-card/70 p-4 shadow-sm ring-1 ring-border xl:col-span-2 2xl:col-span-1 2xl:sticky 2xl:top-24">
            <p className="mb-3 px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Munkafolyamat
            </p>
            <nav className="grid grid-cols-2 gap-2 sm:grid-cols-3 2xl:block 2xl:space-y-1">
              {STEPS.map((label, index) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setStep(index)}
                  aria-current={step === index ? "step" : undefined}
                  className={`flex min-h-14 items-center gap-3 rounded-2xl px-3 py-2 text-left text-sm transition 2xl:w-full ${step === index ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-secondary/70"}`}
                >
                  <span
                    className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-semibold ${step === index ? "bg-primary-foreground/20" : "bg-secondary"}`}
                  >
                    {index + 1}
                  </span>
                  <span className="font-medium leading-tight">{label}</span>
                </button>
              ))}
            </nav>
            <div className="mt-5 hidden rounded-2xl bg-secondary/50 p-3 text-xs text-muted-foreground 2xl:block">
              Csak akkor nyisd meg ezeket a lépéseket, ha részletesen szeretnéd beállítani a
              posztot.
            </div>
          </Card>
        )}

        <div className="min-w-0 space-y-4">
          <Card className="rounded-3xl border-0 p-6 shadow-sm ring-1 ring-border">
            {!simpleMode && step === 0 && (
              <StepGoal
                value={form.goal}
                title={form.title}
                onTitle={(value) => update("title", value)}
                onGoal={(value) => update("goal", value)}
              />
            )}
            {!simpleMode && step === 1 && (
              <StepAudience form={form} update={update} brand={brand} campaigns={activeCampaigns} />
            )}
            {!simpleMode && step === 2 && (
              <StepChannels platforms={form.platforms} toggle={togglePlatform} />
            )}
            {(simpleMode || step === 3) && (
              <div className="space-y-6">
                <StepContent
                  form={form}
                  update={update}
                  variants={variants}
                  editorPlatform={editorPlatform}
                  onSelectPlatform={setSelectedPlatform}
                  onVariant={currentVariant}
                  generating={generating}
                  onGenerate={() => void handleGenerate()}
                  hasPost={Boolean(data.post)}
                  campaign={activeCampaigns.find((item) => item.id === form.campaignId)}
                  hooks={hooks}
                  selectedHook={selectedHook}
                  onSelectHook={setSelectedHook}
                  onGenerateHooks={() => void createHooks()}
                  abVariants={abVariants}
                  onAbVariant={currentAbVariant}
                  onSelectAb={(id) =>
                    setAbVariants((current) =>
                      current.map((item) => ({ ...item, selected: item.id === id })),
                    )
                  }
                  onGenerateAB={() => void createABVariants()}
                  adCopies={adCopies}
                  onAdCopy={(id, key, value) =>
                    setAdCopies((current) =>
                      current.map((item) => (item.id === id ? { ...item, [key]: value } : item)),
                    )
                  }
                  onGenerateAds={() => void createAdCopies()}
                  extrasBusy={extrasBusy}
                  quick={simpleMode}
                  onTogglePlatform={togglePlatform}
                  contextLabel={`${brand.name} · ${form.language} · ${form.tone}`}
                  publication={data.publication}
                  publishingPlatform={publishingPlatform}
                  actionsBusy={
                    saving ||
                    generating ||
                    extrasBusy !== null ||
                    imageBusy ||
                    creativeBusy ||
                    publishingPlatform !== null
                  }
                  hasJpeg={activeMedia.some(
                    (asset) =>
                      form.mediaAssetIds.includes(asset.id) && asset.mimeType === "image/jpeg",
                  )}
                  onPublish={(platform, attemptId) => void handlePublish(platform, attemptId)}
                />
                {simpleMode && (
                  <OptionalSection title="Márkaadatok, cél és kampány — opcionális">
                    <div className="space-y-6">
                      <StepGoal
                        value={form.goal}
                        title={form.title}
                        onTitle={(value) => update("title", value)}
                        onGoal={(value) => update("goal", value)}
                      />
                      <StepAudience
                        form={form}
                        update={update}
                        brand={brand}
                        campaigns={activeCampaigns}
                      />
                    </div>
                  </OptionalSection>
                )}
                <PostCreativeComposer
                  postId={data.post?.post.id}
                  brand={activeBrand}
                  title={form.title || form.topic}
                  content={
                    variants.find((variant) => variant.platform === "instagram")
                      ? postCopyText(variants.find((variant) => variant.platform === "instagram")!)
                      : variants[0]
                        ? postCopyText(variants[0])
                        : form.topic
                  }
                  assets={activeMedia}
                  locked={
                    saving ||
                    generating ||
                    extrasBusy !== null ||
                    imageBusy ||
                    publishingPlatform !== null ||
                    form.status === "published"
                  }
                  onPrepare={saveDraft}
                  onBusyChange={setCreativeBusy}
                  onSaved={async (result) => {
                    if (!data.post) return;
                    const snapshot = await loadPost({ data: { postId: data.post.post.id } });
                    if (!snapshot) throw new Error("A mentett poszt nem tölthető be.");
                    if (result.mediaAssetIds.length) update("mediaAssetIds", result.mediaAssetIds);
                    const instagram = snapshot.variants.find(
                      (variant) => variant.platform === "instagram",
                    );
                    if (instagram) {
                      setVariants((current) => [
                        ...current.filter((variant) => variant.platform !== "instagram"),
                        instagram,
                      ]);
                      setSelectedPlatform("instagram");
                      setForm((current) => ({
                        ...current,
                        platforms: [...new Set([...current.platforms, "instagram" as const])],
                      }));
                    }
                    await router.invalidate();
                  }}
                />
                <OptionalSection
                  enabled={simpleMode}
                  title="Kép vagy videó hozzáadása — opcionális"
                >
                  <div className={simpleMode ? "" : "border-t pt-6"}>
                    <StepMedia
                      assets={activeMedia}
                      selected={form.mediaAssetIds}
                      toggle={(id) =>
                        update(
                          "mediaAssetIds",
                          form.mediaAssetIds.includes(id)
                            ? form.mediaAssetIds.filter((item) => item !== id)
                            : [...form.mediaAssetIds, id],
                        )
                      }
                      onGenerateImage={() => void createImageForPost()}
                      imageBusy={imageBusy}
                      hasPost={Boolean(data.post)}
                    />
                  </div>
                  <PostVideoComposer
                    postId={data.post?.post.id}
                    assets={activeMedia}
                    content={variants[0]?.content || form.topic || form.title}
                    savedVideo={[...activeMedia]
                      .reverse()
                      .find(
                        (asset) =>
                          asset.mimeType === "video/mp4" &&
                          asset.filename.startsWith("marketingpilot-video-") &&
                          data.post?.post.mediaAssetIds.includes(asset.id),
                      )}
                    onCreated={async (asset) => {
                      setForm((current) => ({
                        ...current,
                        mediaAssetIds: [...new Set([...current.mediaAssetIds, asset.id])],
                      }));
                      await router.invalidate();
                    }}
                  />
                </OptionalSection>
                {simpleMode && (
                  <OptionalSection title="Időzítés és közzétételi előzmények — opcionális">
                    <StepReview
                      form={form}
                      update={update}
                      variants={variants}
                      campaigns={activeCampaigns}
                      publication={data.publication}
                      publishingPlatform={publishingPlatform}
                      onPublish={(platform) => void handlePublish(platform)}
                      onRetry={(platform, attemptId) => void handlePublish(platform, attemptId)}
                    />
                  </OptionalSection>
                )}
              </div>
            )}
            {!simpleMode && step === 4 && <StepSchedule form={form} update={update} />}
            {!simpleMode && step === 5 && (
              <StepReview
                form={form}
                update={update}
                variants={variants}
                campaigns={activeCampaigns}
                publication={data.publication}
                publishingPlatform={publishingPlatform}
                onPublish={(platform) => void handlePublish(platform)}
                onRetry={(platform, attemptId) => void handlePublish(platform, attemptId)}
              />
            )}
          </Card>
          <div className="post-studio-savebar flex flex-wrap items-center justify-between gap-3">
            {simpleMode ? (
              <p className="text-sm text-muted-foreground">
                {data.post
                  ? "Mentsd el a módosításaidat."
                  : "Az ötletedet piszkozatként is elmentheted."}
              </p>
            ) : (
              <Button
                variant="ghost"
                className="rounded-full"
                disabled={step === 0}
                onClick={() => setStep((current) => current - 1)}
              >
                <ArrowLeft className="mr-1 h-4 w-4" />
                Vissza
              </Button>
            )}
            <div className="flex flex-wrap gap-2">
              {simpleMode &&
                variants.some((variant) => variant.content.trim()) &&
                form.status !== "published" && (
                  <Button
                    className="rounded-full"
                    onClick={openSchedule}
                    disabled={
                      saving ||
                      generating ||
                      imageBusy ||
                      creativeBusy ||
                      extrasBusy !== null ||
                      publishingPlatform !== null
                    }
                  >
                    <CalendarDays className="mr-1 h-4 w-4" />
                    {form.status === "scheduled" ? "Időpont módosítása" : "Időzítés"}
                  </Button>
                )}
              <Button
                variant="outline"
                className="rounded-full"
                onClick={() => void saveDraft()}
                disabled={
                  saving ||
                  generating ||
                  imageBusy ||
                  creativeBusy ||
                  extrasBusy !== null ||
                  publishingPlatform !== null
                }
              >
                <Save className="mr-1 h-4 w-4" />
                {saving ? "Mentés…" : data.post ? "Változtatások mentése" : "Piszkozat mentése"}
              </Button>
              {!simpleMode &&
                (step < STEPS.length - 1 ? (
                  <Button
                    className="rounded-full"
                    onClick={() => setStep((current) => current + 1)}
                  >
                    Tovább
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    className="rounded-full"
                    onClick={() => void saveDraft()}
                    disabled={saving || creativeBusy}
                  >
                    <Check className="mr-1 h-4 w-4" />
                    Mentés és ellenőrzés
                  </Button>
                ))}
            </div>
          </div>
        </div>

        <Card
          id="post-preview"
          className="post-studio-preview h-fit rounded-3xl border-0 p-5 shadow-sm ring-1 ring-border xl:sticky xl:top-24"
        >
          <div className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-brand" />
            <h2 className="font-semibold">Élő előnézet</h2>
            <a href="#post-studio-editor" className="ml-auto text-xs text-primary xl:hidden">
              Vissza ↑
            </a>
          </div>
          <div className="mt-4">
            <SocialPreview
              brandName={brand.name}
              variants={variants}
              selectedPlatform={editorPlatform}
              onSelectPlatform={setSelectedPlatform}
              media={form.mediaAssetIds.flatMap(
                (id) => activeMedia.find((asset) => asset.id === id) ?? [],
              )}
            />
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
            <Clock3 className="h-3.5 w-3.5" />
            {form.status === "scheduled" && form.scheduledAt
              ? `${form.scheduledAt.replace("T", " · ")} · ${form.timezone}`
              : STATUS_LABELS[form.status]}
          </div>
          {form.campaignId && (
            <p className="mt-3 rounded-2xl bg-brand-soft p-3 text-xs">
              Kampánykontextus aktív:{" "}
              <strong>{data.campaigns.find((item) => item.id === form.campaignId)?.name}</strong>
            </p>
          )}
          {data.post && (
            <Link to="/app/media" className="mt-4 block text-sm text-primary hover:underline">
              Médiatár megnyitása
            </Link>
          )}
        </Card>
      </div>
      <Dialog
        open={scheduleOpen}
        onOpenChange={(open) => {
          if (!saving) setScheduleOpen(open);
        }}
      >
        <DialogContent className="post-schedule-dialog">
          <DialogHeader>
            <div className="post-schedule-icon">
              <CalendarDays className="h-5 w-5" />
            </div>
            <DialogTitle>Poszt időzítése</DialogTitle>
            <DialogDescription>
              Válassz időpontot. A szövegeddel együtt mentjük a Naptárba és a 30 napos tervbe.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              setScheduleError("");
              void saveDraft({ scheduledAt: scheduleDate, timezone: scheduleZone });
            }}
          >
            <div>
              <Label htmlFor="quick-schedule-date">Dátum és idő</Label>
              <Input
                id="quick-schedule-date"
                type="datetime-local"
                required
                value={scheduleDate}
                onChange={(event) => setScheduleDate(event.target.value)}
                disabled={saving}
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="quick-schedule-zone">Időzóna</Label>
              <select
                id="quick-schedule-zone"
                value={scheduleZone}
                onChange={(event) => setScheduleZone(event.target.value)}
                disabled={saving}
                className="mt-2 w-full rounded-xl border p-3 text-sm"
              >
                <option value="Europe/Bucharest">Románia · Bukarest</option>
                <option value="Europe/Budapest">Magyarország · Budapest</option>
                <option value="UTC">UTC</option>
                {!["Europe/Bucharest", "Europe/Budapest", "UTC"].includes(scheduleZone) && (
                  <option value={scheduleZone}>{scheduleZone}</option>
                )}
              </select>
            </div>
            <div className="post-schedule-note">
              <Clock3 className="h-4 w-4 shrink-0" />
              <p>
                Az időpontot elmentjük a naptárba. Automatikus közzététel még nincs bekapcsolva; a
                posztot a kapcsolt csatornán a Közzététel gombbal indíthatod el.
              </p>
            </div>
            {scheduleError && (
              <p role="alert" className="text-sm text-destructive">
                {scheduleError}
              </p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setScheduleOpen(false)}
                disabled={saving}
              >
                Mégse
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CalendarDays className="mr-2 h-4 w-4" />
                )}
                {saving ? "Mentés…" : "Időpont mentése"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function initialForm(
  post: PostSnapshot | null,
  brand: WorkspaceSnapshot["activeBrand"],
): FormState {
  return {
    title: post?.post.title ?? "",
    goal: post?.post.goal ?? "",
    audience: post?.post.audience ?? brand?.audience ?? "",
    topic: post?.post.title ?? "",
    region: brand?.cityRegion ?? "",
    language: post?.post.language ?? brand?.languageMarket ?? "magyar",
    tone: post?.post.tone ?? brand?.profile.tone ?? "Barátságos",
    ctaStyle: brand?.profile.ctaStyle ?? "",
    campaignId: post?.post.campaignId ?? "",
    platforms: defaultPostPlatforms(post?.post.platforms, post?.variants),
    status: post?.post.status ?? "draft",
    scheduledAt: formatPostScheduleInput(
      post?.post.scheduledAt,
      post?.post.timezone ?? "Europe/Bucharest",
    ),
    timezone: post?.post.timezone ?? "Europe/Bucharest",
    mediaAssetIds: post?.post.mediaAssetIds ?? [],
  };
}
function platformLabel(platform: string) {
  return PLATFORMS.find((item) => item.id === platform)?.label ?? platform;
}

function OptionalSection({
  title,
  children,
  enabled = true,
}: {
  title: string;
  children: React.ReactNode;
  enabled?: boolean;
}) {
  if (!enabled) return <>{children}</>;
  return (
    <details className="group rounded-2xl border bg-secondary/20 p-4">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold">
        {title}
        <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
      </summary>
      <div className="mt-5 space-y-5">{children}</div>
    </details>
  );
}
function variantStatusLabel(status: PostVariantRecord["status"]) {
  return status === "draft" || status === "prepared"
    ? "Előkészítve"
    : status === "review"
      ? "Ellenőrzés"
      : status === "failed"
        ? "Sikertelen"
        : status === "published"
          ? "Közzétéve"
          : "Publikálásra kész";
}

function StepGoal({
  value,
  title,
  onTitle,
  onGoal,
}: {
  value: string;
  title: string;
  onTitle: (value: string) => void;
  onGoal: (value: string) => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold">Mi a poszt célja?</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          A cél a rekordban és az AI briefben is megmarad.
        </p>
      </div>
      <div>
        <Label>Cím / téma</Label>
        <Input
          value={title}
          onChange={(event) => onTitle(event.target.value)}
          placeholder="Pl. Tavaszi ajánlat bemutatása"
          className="mt-2"
        />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {GOALS.map((goal) => (
          <button
            type="button"
            key={goal}
            onClick={() => onGoal(goal)}
            className={`rounded-2xl border p-4 text-left text-sm transition ${value === goal ? "border-primary bg-primary/10" : "hover:border-primary/50"}`}
          >
            <span className="font-medium">{goal}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function StepAudience({
  form,
  update,
  brand,
  campaigns,
}: {
  form: FormState;
  update: UpdateForm;
  brand: WorkspaceSnapshot["activeBrand"];
  campaigns: CampaignSnapshot[];
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold">Kinek szól?</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Az aktív Brand Voice és a kiválasztott kampánykontextus bekerül a generálásba.
        </p>
      </div>
      <div>
        <Label>Célközönség</Label>
        <Textarea
          value={form.audience}
          onChange={(event) => update("audience", event.target.value)}
          placeholder="Pl. helyi kisvállalkozók, akik…"
          className="mt-2 min-h-28"
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label>Téma / ajánlat</Label>
          <Input
            value={form.topic}
            onChange={(event) => update("topic", event.target.value)}
            className="mt-2"
          />
        </div>
        <div>
          <Label>Régió</Label>
          <Input
            value={form.region}
            onChange={(event) => update("region", event.target.value)}
            className="mt-2"
          />
        </div>
        <div>
          <Label>Nyelvi piac</Label>
          <Input
            value={form.language}
            onChange={(event) => update("language", event.target.value)}
            className="mt-2"
          />
        </div>
        <div>
          <Label>CTA-stílus</Label>
          <Input
            value={form.ctaStyle}
            onChange={(event) => update("ctaStyle", event.target.value)}
            className="mt-2"
          />
        </div>
      </div>
      <div>
        <Label>Kampánykontextus</Label>
        <select
          className="mt-2 h-10 w-full rounded-2xl border bg-card px-3 text-sm"
          value={form.campaignId}
          onChange={(event) => update("campaignId", event.target.value)}
        >
          <option value="">Önálló poszt, kampány nélkül</option>
          {campaigns.map((campaign) => (
            <option key={campaign.id} value={campaign.id}>
              {campaign.name} · {campaign.objective}
            </option>
          ))}
        </select>
        {form.campaignId && (
          <p className="mt-2 text-xs text-muted-foreground">
            A kampány célja, közönsége, ajánlata, CTA-ja és AI-stratégiája a generálás briefjébe
            kerül.
          </p>
        )}
      </div>
      <p className="rounded-2xl bg-brand-soft p-4 text-sm">
        Brand Voice hangnem: <strong>{brand?.profile.tone}</strong>. Ezt az AI automatikusan
        használja.
      </p>
    </div>
  );
}

function StepChannels({
  platforms,
  toggle,
}: {
  platforms: PostPlatform[];
  toggle: (platform: PostPlatform) => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold">Melyik csatornákra?</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          A választás külön platformváltozatokat készít. A publikálás a mentett poszt ellenőrző
          lépésében érhető el.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {PLATFORMS.map((platform) => (
          <button
            type="button"
            key={platform.id}
            onClick={() => toggle(platform.id)}
            className={`flex items-center justify-between rounded-2xl border p-4 text-left transition ${platforms.includes(platform.id) ? "border-primary bg-primary/10" : "hover:border-primary/50"}`}
          >
            <span className="font-medium">{platform.label}</span>
            <Badge
              variant={platforms.includes(platform.id) ? "default" : "outline"}
              className="rounded-full"
            >
              {platforms.includes(platform.id) ? "Kiválasztva" : "Előkészítve"}
            </Badge>
          </button>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">
        A változatok előkészítve maradnak; publikáláshoz a mentett poszt ellenőrző lépésében
        szükséges csatornát választhatod.
      </p>
    </div>
  );
}

function StepContent({
  form,
  update,
  variants,
  editorPlatform,
  onSelectPlatform,
  onVariant,
  generating,
  onGenerate,
  hasPost,
  campaign,
  hooks,
  selectedHook,
  onSelectHook,
  onGenerateHooks,
  abVariants,
  onAbVariant,
  onSelectAb,
  onGenerateAB,
  adCopies,
  onAdCopy,
  onGenerateAds,
  extrasBusy,
  quick = false,
  onTogglePlatform,
  contextLabel,
  publication,
  publishingPlatform,
  actionsBusy,
  hasJpeg,
  onPublish,
}: {
  form: FormState;
  update: UpdateForm;
  variants: PostVariantRecord[];
  editorPlatform: PostPlatform;
  onSelectPlatform: (platform: PostPlatform) => void;
  onVariant: (id: string, key: "content" | "cta" | "hashtags", value: string) => void;
  generating: boolean;
  onGenerate: () => void;
  hasPost: boolean;
  campaign?: CampaignSnapshot;
  hooks: string[];
  selectedHook: string | null;
  onSelectHook: (hook: string) => void;
  onGenerateHooks: () => void;
  abVariants: PostAbVariantRecord[];
  onAbVariant: (id: string, key: "content" | "cta" | "hashtags", value: string) => void;
  onSelectAb: (id: string) => void;
  onGenerateAB: () => void;
  adCopies: PostAdCopyRecord[];
  onAdCopy: (
    id: string,
    key: "primaryText" | "headline" | "description" | "cta",
    value: string,
  ) => void;
  onGenerateAds: () => void;
  extrasBusy: "hooks" | "ab" | "ads" | null;
  quick?: boolean;
  onTogglePlatform: (platform: PostPlatform) => void;
  contextLabel: string;
  publication: SafePublicationInfo | null;
  publishingPlatform: PublishPlatform | null;
  actionsBusy: boolean;
  hasJpeg: boolean;
  onPublish: (platform: PublishPlatform, attemptId?: string) => void;
}) {
  const selectedPlatform = editorPlatform;
  const hasContent = variants.some((variant) => variant.content.trim());
  async function copyVariant(variant: PostVariantRecord) {
    try {
      if (!navigator.clipboard?.writeText)
        throw new Error("A böngészőben nem érhető el a vágólap. Jelöld ki és másold a szöveget.");
      await navigator.clipboard.writeText(postCopyText(variant));
      toast.success("A szerkesztett posztszöveg a vágólapra került.");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Nem sikerült másolni.");
    }
  }
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">
          {quick
            ? hasContent
              ? "Finomítsd a posztodat"
              : "Mit szeretnél posztolni?"
            : "Tartalom és AI-generálás"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {quick
            ? hasContent
              ? "Válassz csatornát, szerkeszd a szöveget, majd másold ki vagy tedd közzé."
              : "Írd le pár szóban az ajánlatot vagy az ötletedet. A márkád adatait és hangját az AI automatikusan használja."
            : "Egy rövid briefből platformonként külön, szerkeszthető tartalom készül. A bővített AI-eszközök a mentett poszthoz kapcsolódnak."}
        </p>
      </div>
      {quick && !hasContent && (
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Sparkles className="h-4 w-4 text-primary" />
          Automatikus márkakontextus: {contextLabel}
        </p>
      )}
      {campaign && (
        <div className="rounded-2xl bg-brand-soft p-4 text-sm">
          <strong>{campaign.name}</strong>
          <span className="ml-2 text-muted-foreground">{campaign.objective}</span>
        </div>
      )}
      <OptionalSection enabled={quick && hasContent} title="Az ötlet és a csatornák módosítása">
        <div>
          <Label htmlFor="post-brief">{quick ? "Az ötleted vagy ajánlatod" : "Téma / brief"}</Label>
          <Textarea
            id="post-brief"
            disabled={publishingPlatform !== null}
            value={form.topic}
            onChange={(event) => update("topic", event.target.value)}
            placeholder="Például: Hétvégén 20% kedvezményt adunk a pizzákra, péntektől vasárnapig. Hívjuk meg a környékbeli családokat!"
            className="mt-2 min-h-28"
          />
        </div>
        {quick && (
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Melyik csatornára készüljön?</legend>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map((platform) => (
                <button
                  key={platform.id}
                  type="button"
                  disabled={publishingPlatform !== null}
                  aria-pressed={form.platforms.includes(platform.id)}
                  onClick={() => onTogglePlatform(platform.id)}
                  className={`rounded-full border px-3 py-2 text-sm transition ${form.platforms.includes(platform.id) ? "border-primary bg-primary/10 font-semibold text-primary" : "bg-card text-muted-foreground hover:border-primary/50"}`}
                >
                  {form.platforms.includes(platform.id) && (
                    <Check className="mr-1 inline h-3.5 w-3.5" />
                  )}
                  {platform.label}
                </button>
              ))}
            </div>
            {!form.platforms.length && (
              <p className="mt-2 text-sm text-destructive">Válassz legalább egy csatornát.</p>
            )}
          </fieldset>
        )}
        <Button
          className="rounded-full"
          onClick={onGenerate}
          disabled={actionsBusy || form.topic.trim().length < 2 || !form.platforms.length}
        >
          {generating ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="mr-1 h-4 w-4" />
          )}
          {generating
            ? "Generálás…"
            : quick
              ? hasPost && variants.length
                ? "Új szöveg készítése"
                : "Készítsd el a posztot"
              : hasPost
                ? "Platformváltozatok újragenerálása"
                : "Platformváltozatok generálása"}
        </Button>
        <p className="mt-3 text-xs text-muted-foreground">
          {hasContent
            ? "Újrageneráláskor a jelenlegi platformszövegek frissülnek."
            : "A márkád adatait automatikusan használjuk. A kész szöveg piszkozatként mentődik."}
        </p>
      </OptionalSection>
      {generating && (
        <div role="status" className="post-studio-generating">
          <Loader2 className="h-5 w-5 animate-spin" />
          <div>
            <strong>A posztod készül…</strong>
            <p>{form.platforms.map(platformLabel).join(" · ")} · A márkád hangjára igazítva.</p>
          </div>
        </div>
      )}
      {variants.length > 1 && (
        <div className="post-studio-variant-tabs" aria-label="Szerkesztés csatornája">
          {variants.map((variant) => (
            <button
              key={variant.id}
              type="button"
              aria-label={`${platformLabel(variant.platform)} szerkesztése`}
              aria-pressed={editorPlatform === variant.platform}
              disabled={publishingPlatform !== null}
              onClick={() => onSelectPlatform(variant.platform)}
            >
              <PlatformMark platform={variant.platform} />
              {platformLabel(variant.platform)}
            </button>
          ))}
        </div>
      )}
      <div className="space-y-4">
        {variants
          .filter((variant) => variant.platform === editorPlatform)
          .map((variant) => (
            <div key={variant.id} className="post-studio-variant rounded-2xl border p-4">
              <div className="mb-2 flex items-center justify-between">
                <Badge className="rounded-full" variant="outline">
                  {platformLabel(variant.platform)}
                </Badge>
                <Badge className="rounded-full" variant="secondary">
                  {variantStatusLabel(variant.status)}
                </Badge>
              </div>
              <Textarea
                aria-label={`${platformLabel(variant.platform)} poszt szövege`}
                disabled={publishingPlatform !== null || variant.status === "published"}
                value={variant.content}
                onChange={(event) => onVariant(variant.id, "content", event.target.value)}
                className="post-studio-variant-text min-h-56"
              />
              <p className="my-2 text-xs text-muted-foreground">
                Teljes poszt: {postCopyText(variant).length} karakter
              </p>
              <OptionalSection
                enabled={quick}
                title={`Hashtagek${variant.hashtags.length ? ` (${variant.hashtags.length})` : ""} és felhívás`}
              >
                <Label htmlFor={`hashtags-${variant.id}`}>Hashtagek</Label>
                <Input
                  id={`hashtags-${variant.id}`}
                  aria-label={`${platformLabel(variant.platform)} hashtagek`}
                  disabled={publishingPlatform !== null || variant.status === "published"}
                  value={variant.hashtags.join(" ")}
                  onChange={(event) => onVariant(variant.id, "hashtags", event.target.value)}
                  placeholder="#hashtag #téma"
                  className="mt-2"
                />
                <Label htmlFor={`cta-${variant.id}`} className="mt-3 block">
                  Mit tegyen az olvasó? (CTA)
                </Label>
                <Input
                  id={`cta-${variant.id}`}
                  aria-label={`${platformLabel(variant.platform)} CTA`}
                  disabled={publishingPlatform !== null || variant.status === "published"}
                  value={variant.cta}
                  onChange={(event) => onVariant(variant.id, "cta", event.target.value)}
                  placeholder="CTA"
                  className="mt-2"
                />
              </OptionalSection>
              <div className="mt-3 flex flex-wrap items-start gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  disabled={!variant.content.trim()}
                  onClick={() => void copyVariant(variant)}
                >
                  <Copy className="mr-1 h-4 w-4" />
                  {platformLabel(variant.platform)} szöveg másolása
                </Button>
                <VariantPublishAction
                  variant={variant}
                  publication={publication}
                  busyPlatform={publishingPlatform}
                  disabled={actionsBusy}
                  hasJpeg={hasJpeg}
                  onPublish={onPublish}
                />
              </div>
            </div>
          ))}
        {!quick && !variants.length && (
          <p className="text-sm text-muted-foreground">Még nincs generált változat.</p>
        )}
      </div>
      <OptionalSection enabled={quick} title="További AI-eszközök: hookok, A/B, hirdetésszöveg">
        <div className="grid gap-4">
          <div className="rounded-2xl border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-semibold">Hook ötletek</h3>
                <p className="text-xs text-muted-foreground">Erős kezdések a témádhoz.</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="rounded-full"
                disabled={!hasPost || actionsBusy}
                onClick={onGenerateHooks}
              >
                <Wand2 className="mr-1 h-3.5 w-3.5" />
                {extrasBusy === "hooks" ? "Készül…" : "Generálás"}
              </Button>
            </div>
            {hooks.length ? (
              <div className="mt-3 space-y-2">
                {hooks.map((hook) => (
                  <button
                    type="button"
                    key={hook}
                    onClick={() => onSelectHook(hook)}
                    className={`w-full rounded-xl border p-2 text-left text-sm ${selectedHook === hook ? "border-primary bg-primary/10" : "hover:border-primary/50"}`}
                  >
                    {hook}
                  </button>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-xs text-muted-foreground">
                A mentett poszthoz kérhetsz több különböző nyitást.
              </p>
            )}
          </div>
          <div className="rounded-2xl border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-semibold">
                  A/B változatok · {platformLabel(selectedPlatform)}
                </h3>
                <p className="text-xs text-muted-foreground">
                  Válassz egy platformot, majd kérj eltérő megközelítéseket.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="rounded-full"
                disabled={!hasPost || !selectedPlatform || actionsBusy}
                onClick={onGenerateAB}
              >
                <Sparkles className="mr-1 h-3.5 w-3.5" />
                {extrasBusy === "ab" ? "Készül…" : "3 változat"}
              </Button>
            </div>
            {abVariants
              .filter((item) => item.platform === selectedPlatform)
              .map((item) => (
                <div
                  key={item.id}
                  className={`mt-3 rounded-xl border p-3 ${item.selected ? "border-primary bg-primary/5" : ""}`}
                >
                  <button
                    type="button"
                    onClick={() => onSelectAb(item.id)}
                    className="text-sm font-semibold"
                  >
                    {item.selected ? "✓ " : ""}
                    {item.label}
                  </button>
                  <Textarea
                    value={item.content}
                    onChange={(event) => onAbVariant(item.id, "content", event.target.value)}
                    className="mt-2 min-h-24"
                  />
                  <Input
                    value={item.hashtags.join(" ")}
                    onChange={(event) => onAbVariant(item.id, "hashtags", event.target.value)}
                    placeholder="#hashtag"
                    className="mt-2"
                  />
                  <Input
                    value={item.cta}
                    onChange={(event) => onAbVariant(item.id, "cta", event.target.value)}
                    placeholder="CTA"
                    className="mt-2"
                  />
                </div>
              ))}
            {!abVariants.filter((item) => item.platform === selectedPlatform).length && (
              <p className="mt-3 text-xs text-muted-foreground">
                Még nincs A/B csomag ehhez a platformhoz.
              </p>
            )}
          </div>
        </div>
        <div className="rounded-2xl border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-semibold">
                <Megaphone className="mr-1 inline h-4 w-4 text-brand" />
                Meta hirdetésszöveg
              </h3>
              <p className="text-xs text-muted-foreground">
                Primary Text, Headline, Description és CTA.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="rounded-full"
              disabled={!hasPost || actionsBusy}
              onClick={onGenerateAds}
            >
              <Megaphone className="mr-1 h-3.5 w-3.5" />
              {extrasBusy === "ads" ? "Készül…" : "Hirdetés generálása"}
            </Button>
          </div>
          {adCopies.map((item) => (
            <div key={item.id} className="mt-3 rounded-xl border p-3">
              <div className="mb-2 text-sm font-semibold">{item.label}</div>
              <Textarea
                value={item.primaryText}
                onChange={(event) => onAdCopy(item.id, "primaryText", event.target.value)}
                placeholder="Primary Text"
                className="min-h-20"
              />
              <Input
                value={item.headline}
                onChange={(event) => onAdCopy(item.id, "headline", event.target.value)}
                placeholder="Headline"
                className="mt-2"
              />
              <Input
                value={item.description}
                onChange={(event) => onAdCopy(item.id, "description", event.target.value)}
                placeholder="Description"
                className="mt-2"
              />
              <Input
                value={item.cta}
                onChange={(event) => onAdCopy(item.id, "cta", event.target.value)}
                placeholder="CTA"
                className="mt-2"
              />
            </div>
          ))}
          {!adCopies.length && (
            <p className="mt-3 text-xs text-muted-foreground">
              A mentett poszt briefjéből több hirdetési irányt kérhetsz.
            </p>
          )}
        </div>
      </OptionalSection>
    </div>
  );
}

function StepMedia({
  assets,
  selected,
  toggle,
  onGenerateImage,
  imageBusy,
  hasPost,
}: {
  assets: Array<{ id: string; filename: string; mimeType: string; altText: string }>;
  selected: string[];
  toggle: (id: string) => void;
  onGenerateImage: () => void;
  imageBusy: boolean;
  hasPost: boolean;
}) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Média hozzárendelése</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            A Médiatárból válassz valóban feltöltött vagy mentett assetet, vagy készíts márkahű
            AI-képet közvetlenül ehhez a poszthoz.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="rounded-full"
          disabled={!hasPost || imageBusy}
          onClick={onGenerateImage}
        >
          {imageBusy ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="mr-1 h-4 w-4" />
          )}
          {imageBusy ? "Kép készül…" : "AI-kép a poszthoz"}
        </Button>
      </div>
      {!hasPost && (
        <p className="rounded-xl bg-secondary/50 p-3 text-xs text-muted-foreground">
          Az AI-kép mentéséhez előbb generáld és mentsd a posztot.
        </p>
      )}
      {assets.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-6 text-center">
          <ImageIcon className="mx-auto h-7 w-7 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">Nincs média ehhez a márkához.</p>
          <Link to="/app/media">
            <Button variant="outline" className="mt-3 rounded-full">
              Médiatár megnyitása
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {assets.map((asset) => (
            <button
              type="button"
              key={asset.id}
              onClick={() => toggle(asset.id)}
              className={`overflow-hidden rounded-2xl border text-left transition ${selected.includes(asset.id) ? "border-primary ring-2 ring-primary/20" : "hover:border-primary/50"}`}
            >
              {asset.mimeType.startsWith("image/") ? (
                <img
                  src={`/api/media/${asset.id}`}
                  alt={asset.altText || asset.filename}
                  className="aspect-video w-full object-cover"
                />
              ) : (
                <div className="grid aspect-video place-items-center bg-secondary text-xs">
                  {asset.mimeType}
                </div>
              )}
              <div className="p-3 text-sm">
                <div className="truncate font-medium">{asset.filename}</div>
                <div className="text-xs text-muted-foreground">
                  {selected.includes(asset.id) ? "Hozzárendelve" : "Kiválasztás"}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function StepSchedule({ form, update }: { form: FormState; update: UpdateForm }) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold">Mikor jelenjen meg?</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Időzítsd a posztot, vagy mentsd piszkozatként és térj vissza később.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label>Státusz</Label>
          <select
            className="mt-2 h-10 w-full rounded-2xl border bg-card px-3 text-sm"
            value={form.status}
            onChange={(event) => update("status", event.target.value as PostStatus)}
          >
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value} disabled={value === "published"}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>Időzítés</Label>
          <Input
            type="datetime-local"
            value={form.scheduledAt}
            onChange={(event) => update("scheduledAt", event.target.value)}
            className="mt-2"
          />
        </div>
      </div>
      <div>
        <Label>Időzóna</Label>
        <Input
          value={form.timezone}
          onChange={(event) => update("timezone", event.target.value)}
          className="mt-2"
        />
      </div>
      <div className="rounded-2xl bg-brand-soft p-4 text-sm">
        A választás mentéskor a valódi post rekordban marad meg, és a naptár ugyanebből az adatból
        dolgozik.
      </div>
    </div>
  );
}

function StepReview({
  form,
  update,
  variants,
  campaigns,
  publication,
  publishingPlatform,
  onPublish,
  onRetry,
}: {
  form: FormState;
  update: UpdateForm;
  variants: PostVariantRecord[];
  campaigns: CampaignSnapshot[];
  publication: SafePublicationInfo | null;
  publishingPlatform: PublishPlatform | null;
  onPublish: (platform: PublishPlatform) => void;
  onRetry: (platform: PublishPlatform, attemptId: string) => void;
}) {
  const campaign = campaigns.find((item) => item.id === form.campaignId);
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold">Ellenőrzés és publikálás</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          A csatorna, a jogosultságok és a szükséges média publikálás előtt szerveroldalon
          ellenőrződik.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label>Státusz</Label>
          <select
            className="mt-2 h-10 w-full rounded-2xl border bg-card px-3 text-sm"
            value={form.status}
            onChange={(event) => update("status", event.target.value as PostStatus)}
          >
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value} disabled={value === "published"}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>Időzítés (opcionális)</Label>
          <Input
            type="datetime-local"
            value={form.scheduledAt}
            onChange={(event) => update("scheduledAt", event.target.value)}
            className="mt-2"
          />
        </div>
      </div>
      <div>
        <Label>Időzóna</Label>
        <Input
          value={form.timezone}
          onChange={(event) => update("timezone", event.target.value)}
          className="mt-2"
        />
      </div>
      <div className="rounded-2xl bg-secondary/50 p-4 text-sm">
        <div>
          <strong>{form.title || "Névtelen poszt"}</strong> · {form.goal || "Cél nincs megadva"}
        </div>
        <div className="mt-1 text-muted-foreground">
          {variants.length} platformváltozat · média: {form.mediaAssetIds.length} fájl ·{" "}
          {form.status === "scheduled"
            ? "ütemezésre vár"
            : form.status === "published"
              ? "közzétéve"
              : variants.length
                ? "ellenőrzésre vár"
                : "még nincs posztszöveg"}
        </div>
        {campaign && (
          <div className="mt-2 text-muted-foreground">
            Kampány: <strong className="text-foreground">{campaign.name}</strong>
          </div>
        )}
      </div>
      {publication && (
        <PublicationPanel
          publication={publication}
          variants={variants}
          busyPlatform={publishingPlatform}
          onPublish={onPublish}
          onRetry={onRetry}
        />
      )}
    </div>
  );
}

function VariantPublishAction({
  variant,
  publication,
  busyPlatform,
  disabled,
  hasJpeg,
  onPublish,
}: {
  variant: PostVariantRecord;
  publication: SafePublicationInfo | null;
  busyPlatform: PublishPlatform | null;
  disabled: boolean;
  hasJpeg: boolean;
  onPublish: (platform: PublishPlatform, attemptId?: string) => void;
}) {
  if (variant.platform !== "facebook" && variant.platform !== "instagram") {
    return (
      <p className="w-full text-xs text-muted-foreground">
        Ehhez a csatornához a közvetlen közzététel még nem érhető el; a szöveget másolhatod.
      </p>
    );
  }
  const platform = variant.platform;
  const label = platform === "facebook" ? "Facebookon" : "Instagramon";
  const connection = publication?.connections.find((item) => item.provider === platform);
  const latest = publication?.attempts.find((item) => item.platform === platform);
  const reason = publicationBlockReason(platform, connection, variant, hasJpeg);
  const published = variant.status === "published" || latest?.status === "published";
  const pending = latest?.status === "pending" || latest?.status === "running";
  const busy = busyPlatform === platform;
  const needsConnection =
    !connection ||
    connection.status !== "connected" ||
    !connection.hasAccessToken ||
    !connection.scopes.includes(
      platform === "facebook" ? "pages_manage_posts" : "instagram_content_publish",
    );
  return (
    <>
      <Button
        type="button"
        size="sm"
        className="rounded-full"
        disabled={disabled || published || pending || Boolean(reason)}
        onClick={() => onPublish(platform, latest?.status === "failed" ? latest.id : undefined)}
      >
        {busy ? (
          <Loader2 className="mr-1 h-4 w-4 animate-spin" />
        ) : (
          <Send className="mr-1 h-4 w-4" />
        )}
        {busy || pending
          ? "Közzététel folyamatban…"
          : published
            ? `Közzétéve ${label}`
            : latest?.status === "failed"
              ? `Újrapróbálás ${label}`
              : `Közzététel ${label}`}
      </Button>
      {needsConnection && !published && (
        <Link
          to="/app/channels"
          className="inline-flex min-h-9 items-center text-sm font-semibold text-primary hover:underline"
        >
          {platform === "facebook" ? "Facebook" : "Instagram"} csatlakoztatása →
        </Link>
      )}
      <p className="w-full text-xs text-muted-foreground">
        {published
          ? "Ez a változat már közzé van téve."
          : (reason ??
            `Cél: ${connection?.externalAccountName ?? label}. A szerkesztett szöveg közzététel előtt automatikusan mentődik.`)}
      </p>
      {latest?.status === "failed" && latest.error && (
        <p className="w-full text-xs text-destructive">{latest.error}</p>
      )}
    </>
  );
}

function PublicationPanel({
  publication,
  variants,
  busyPlatform,
  onPublish,
  onRetry,
}: {
  publication: SafePublicationInfo;
  variants: PostVariantRecord[];
  busyPlatform: PublishPlatform | null;
  onPublish: (platform: PublishPlatform) => void;
  onRetry: (platform: PublishPlatform, attemptId: string) => void;
}) {
  const labels: Record<PublishPlatform, string> = {
    facebook: "Facebook Page",
    instagram: "Instagram Professional",
  };
  return (
    <div className="rounded-2xl border border-primary/20 bg-brand-soft/25 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold">Valódi publikálás</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            A művelet a kapcsolt csatornára kerül, és minden kísérlet naplózódik.
          </p>
        </div>
        <Badge variant="outline" className="rounded-full">
          Szerveroldali
        </Badge>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {(["facebook", "instagram"] as PublishPlatform[]).map((platform) => {
          const connection = publication.connections.find((item) => item.provider === platform);
          const variant = variants.find((item) => item.platform === platform);
          const latest = publication.attempts.find((attempt) => attempt.platform === platform);
          const busy = busyPlatform === platform;
          const connected = connection?.status === "connected" && connection.hasAccessToken;
          const hasPermission = connection?.scopes.includes(
            platform === "facebook" ? "pages_manage_posts" : "instagram_content_publish",
          );
          return (
            <div key={platform} className="rounded-xl border bg-card p-3">
              <div className="flex items-center justify-between gap-2">
                <strong className="text-sm">{labels[platform]}</strong>
                <Badge
                  variant={
                    latest?.status === "published"
                      ? "default"
                      : latest?.status === "failed"
                        ? "destructive"
                        : "outline"
                  }
                  className="rounded-full text-[10px]"
                >
                  {latest?.status === "published"
                    ? "Közzétéve"
                    : latest?.status === "failed"
                      ? "Sikertelen"
                      : connected
                        ? "Kapcsolva"
                        : "Nincs kapcsolat"}
                </Badge>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {connection?.externalAccountName ?? "Csatlakoztasd a csatornát a publikáláshoz."}
              </p>
              {!variant && (
                <p className="mt-2 text-xs text-amber-700">
                  Ehhez a platformhoz nincs mentett változat.
                </p>
              )}
              {connected && !hasPermission && (
                <p className="mt-2 text-xs text-amber-700">
                  Újracsatlakozás szükséges a publikálási jogosultsághoz.
                </p>
              )}
              {latest?.error && <p className="mt-2 text-xs text-destructive">{latest.error}</p>}
              {latest?.externalId && (
                <p className="mt-2 break-all text-[10px] text-muted-foreground">
                  Külső azonosító: {latest.externalId}
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {latest?.status === "failed" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full"
                    disabled={
                      busyPlatform !== null ||
                      !connected ||
                      !hasPermission ||
                      !variant?.content.trim()
                    }
                    onClick={() => onRetry(platform, latest.id)}
                  >
                    {busy ? "Újrapróbálás…" : "Újrapróbálás"}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    className="rounded-full"
                    disabled={
                      busyPlatform !== null ||
                      !connected ||
                      !hasPermission ||
                      !variant?.content.trim() ||
                      variant.status === "published"
                    }
                    onClick={() => onPublish(platform)}
                  >
                    {busy ? "Publikálás…" : "Publikálás"}
                  </Button>
                )}
                {!connected && (
                  <Link
                    to="/app/channels"
                    className="inline-flex items-center text-xs font-medium text-primary hover:underline"
                  >
                    Csatornák megnyitása
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {publication.attempts.length > 0 && (
        <div className="mt-4 border-t border-border/70 pt-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Legutóbbi kísérletek
          </p>
          <div className="mt-2 space-y-1">
            {publication.attempts.slice(0, 6).map((attempt) => (
              <div
                key={attempt.id}
                className="flex flex-wrap items-center justify-between gap-2 text-xs"
              >
                <span>
                  {labels[attempt.platform]} ·{" "}
                  {new Date(attempt.requestedAt).toLocaleString("hu-HU")}
                </span>
                <Badge
                  variant={
                    attempt.status === "published"
                      ? "default"
                      : attempt.status === "failed"
                        ? "destructive"
                        : "outline"
                  }
                  className="rounded-full text-[10px]"
                >
                  {attempt.status === "published"
                    ? "Közzétéve"
                    : attempt.status === "failed"
                      ? "Sikertelen"
                      : attempt.status}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
