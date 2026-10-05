import { useMemo, useRef, useState } from "react";
import {
  createFileRoute,
  Link,
  Outlet,
  useLocation,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  CalendarClock,
  ClipboardCopy,
  Copy,
  ExternalLink,
  FileText,
  LayoutGrid,
  List,
  LoaderCircle,
  Plus,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react";
import { getPosts, deletePost, copyPost } from "@/lib/post.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/app-chrome";
import { PlatformMark, SocialPreview } from "@/components/social-preview";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { PostPlatform } from "@/lib/data-model";
import { postCopyText } from "@/lib/post-editor";
import {
  filterAndSortPosts,
  formatPostScheduledAt,
  selectPostVariant,
  summarizePosts,
  type PostInboxFilters,
} from "@/lib/post-inbox";
import { toast } from "sonner";

export const Route = createFileRoute("/app/posts")({ loader: () => getPosts(), component: Posts });

const STATUS_LABELS: Record<string, string> = {
  idea: "Ötlet",
  draft: "Piszkozat",
  review: "Ellenőrzés",
  scheduled: "Ütemezve",
  published: "Közzétéve",
  failed: "Sikertelen",
};
const PLATFORM_LABELS: Record<string, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
  linkedin: "LinkedIn",
  youtube: "YouTube",
  "google-business": "Google Business",
};

function Posts() {
  const posts = Route.useLoaderData();
  const router = useRouter();
  const navigate = useNavigate();
  const location = useLocation();
  const remove = useServerFn(deletePost);
  const duplicate = useServerFn(copyPost);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<NonNullable<PostInboxFilters["status"]>>("all");
  const [platform, setPlatform] = useState<PostPlatform | "all">("all");
  const [sort, setSort] = useState<NonNullable<PostInboxFilters["sort"]>>("updated");
  const [view, setView] = useState<"list" | "cards">("cards");
  const [pending, setPending] = useState<{ id: string; action: "copy" | "delete" } | null>(null);
  const mutationInFlight = useRef(false);
  const [deleteTarget, setDeleteTarget] = useState<SavedPost | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const summary = useMemo(() => summarizePosts(posts), [posts]);
  const filtered = useMemo(
    () => filterAndSortPosts(posts, { query, status, platform, sort }),
    [posts, query, status, platform, sort],
  );
  if (location.pathname.startsWith("/app/posts/")) return <Outlet />;
  function resetFilters() {
    setQuery("");
    setStatus("all");
    setPlatform("all");
  }
  async function removePost(id: string) {
    if (mutationInFlight.current) return;
    mutationInFlight.current = true;
    setPending({ id, action: "delete" });
    setDeleteError("");
    try {
      await remove({ data: { postId: id } });
      await router.invalidate();
      setDeleteTarget(null);
      toast.success("Poszt törölve.");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Nem sikerült törölni.";
      setDeleteError(message);
      toast.error(message);
    } finally {
      mutationInFlight.current = false;
      setPending(null);
    }
  }
  async function duplicatePost(id: string) {
    if (mutationInFlight.current) return;
    mutationInFlight.current = true;
    setPending({ id, action: "copy" });
    try {
      const result = await duplicate({ data: { postId: id } });
      if (!result) throw new Error("Nem sikerült létrehozni a másolatot.");
      await router.invalidate();
      toast.success("A másolat piszkozatként elkészült.", {
        action: {
          label: "Megnyitás",
          onClick: () => void navigate({ to: "/app/posts/$id", params: { id: result.post.id } }),
        },
      });
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Nem sikerült másolni.");
    } finally {
      mutationInFlight.current = false;
      setPending(null);
    }
  }
  return (
    <div className="post-inbox space-y-5">
      <PageHeader
        title="Posztok"
        sub="Minden tartalmad egy helyen. Nézd át, másold ki vagy folytasd a posztodat."
        action={
          <Link to="/app/posts/$id" params={{ id: "new" }}>
            <Button className="rounded-full">
              <Plus className="mr-1 h-4 w-4" />
              Új poszt
            </Button>
          </Link>
        }
      />
      <div className="post-inbox-statuses" role="group" aria-label="Posztok állapota">
        {(
          [
            ["all", "Összes", summary.all],
            ["editing", "Szerkesztés alatt", summary.draft],
            ["scheduled", "Időzített", summary.scheduled],
            ["published", "Közzétéve", summary.published],
            ["failed", "Sikertelen", summary.failed],
          ] as const
        ).map(([value, label, count]) => (
          <button
            key={value}
            type="button"
            aria-pressed={status === value}
            onClick={() => setStatus(value)}
          >
            <span>{label}</span>
            <strong>{count}</strong>
          </button>
        ))}
      </div>
      <Card className="v2-feature-card rounded-3xl border-0 p-4">
        <div className="flex flex-col gap-3 lg:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="rounded-2xl border-0 bg-secondary/55 pl-9"
              placeholder="Keresés cím, cél vagy szöveg alapján…"
              aria-label="Posztok keresése"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <select
            className="h-10 rounded-2xl border bg-card px-3 text-sm"
            value={status}
            aria-label="Státusz szűrése"
            onChange={(event) =>
              setStatus(event.target.value as NonNullable<PostInboxFilters["status"]>)
            }
          >
            <option value="all">Minden státusz</option>
            <option value="editing">Szerkesztés alatt</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            className="h-10 rounded-2xl border bg-card px-3 text-sm"
            value={platform}
            aria-label="Platform szűrése"
            onChange={(event) => setPlatform(event.target.value as PostPlatform | "all")}
          >
            <option value="all">Minden platform</option>
            {Object.entries(PLATFORM_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            className="h-10 rounded-2xl border bg-card px-3 text-sm"
            value={sort}
            aria-label="Posztok rendezése"
            onChange={(event) =>
              setSort(event.target.value as NonNullable<PostInboxFilters["sort"]>)
            }
          >
            <option value="updated">Legutóbb módosítva</option>
            <option value="title">Cím szerint</option>
            <option value="scheduled">Időpont szerint</option>
          </select>
          <div className="flex rounded-2xl border p-1">
            <Button
              size="sm"
              variant={view === "list" ? "secondary" : "ghost"}
              onClick={() => setView("list")}
              aria-pressed={view === "list"}
            >
              <List className="h-4 w-4" />
              Lista
            </Button>
            <Button
              size="sm"
              variant={view === "cards" ? "secondary" : "ghost"}
              onClick={() => setView("cards")}
              aria-pressed={view === "cards"}
            >
              <LayoutGrid className="h-4 w-4" />
              Kártyák
            </Button>
          </div>
        </div>
      </Card>
      <div className="post-inbox-results" role="status">
        <span>
          {filtered.length} / {posts.length} poszt
        </span>
        {(query.trim() || status !== "all" || platform !== "all") && (
          <button type="button" onClick={resetFilters}>
            <RotateCcw className="h-3.5 w-3.5" /> Szűrők törlése
          </button>
        )}
      </div>
      {filtered.length === 0 ? (
        <Card className="v2-empty-state rounded-3xl p-10 text-center">
          <FileText className="mx-auto h-8 w-8 text-brand" />
          <h2 className="mt-3 text-lg font-semibold">
            {posts.length === 0 ? "Még nincs tartalmad." : "Nincs találat."}
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            {posts.length === 0
              ? "Írd le röviden az ötletedet. Az AI a márkád hangján elkészíti az első posztot."
              : "Módosítsd a keresést vagy a szűrőket."}
          </p>
          {posts.length === 0 && (
            <Link to="/app/posts/$id" params={{ id: "new" }}>
              <Button className="mt-5 rounded-full">
                <Plus className="mr-1 h-4 w-4" />
                Új poszt készítése
              </Button>
            </Link>
          )}
          {posts.length > 0 && (
            <Button className="mt-5" variant="outline" onClick={resetFilters}>
              <RotateCcw /> Szűrők törlése
            </Button>
          )}
        </Card>
      ) : (
        <div className={view === "cards" ? "post-inbox-grid" : "post-inbox-list"}>
          {filtered.map((post) => (
            <PostCard
              key={`${post.id}:${platform}`}
              post={post}
              cards={view === "cards"}
              platformFilter={platform}
              busy={Boolean(pending)}
              duplicating={pending?.id === post.id && pending.action === "copy"}
              onDuplicate={() => void duplicatePost(post.id)}
              onRemove={() => {
                setDeleteError("");
                setDeleteTarget(post);
              }}
            />
          ))}
        </div>
      )}
      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !pending) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent className="post-inbox-delete-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Törlöd ezt a posztot?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deleteTarget?.title}</strong>
              <br />A poszt és a szövegváltozatai végleg törlődnek. A hozzá kapcsolt tervtételek
              megmaradnak, és újra elkészíthetők.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && (
            <p className="text-sm text-destructive" role="alert">
              {deleteError}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(pending)}>Mégse</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={Boolean(pending)}
              onClick={() => deleteTarget && void removePost(deleteTarget.id)}
            >
              {pending?.action === "delete" ? (
                <LoaderCircle className="animate-spin" />
              ) : (
                <Trash2 />
              )}{" "}
              {pending?.action === "delete" ? "Törlés…" : "Poszt törlése"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

type SavedPost = Awaited<ReturnType<typeof getPosts>>[number];

function PostCard({
  post,
  cards,
  platformFilter,
  busy,
  duplicating,
  onDuplicate,
  onRemove,
}: {
  post: SavedPost;
  cards: boolean;
  platformFilter: PostPlatform | "all";
  busy: boolean;
  duplicating: boolean;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  const [selected, setSelected] = useState<PostPlatform | "all">(platformFilter);
  const variant = selectPostVariant(post, selected);
  const channels = [
    ...new Set([...post.variants.map((item) => item.platform), ...(post.platforms ?? [])]),
  ];
  const scheduled = formatPostScheduledAt(post);
  const image = post.media.find((asset) => asset.mimeType.startsWith("image/"));
  const [copying, setCopying] = useState(false);
  const clipboardInFlight = useRef(false);
  async function copyText() {
    if (!variant?.content.trim() || clipboardInFlight.current) return;
    clipboardInFlight.current = true;
    setCopying(true);
    try {
      await navigator.clipboard.writeText(postCopyText(variant));
      toast.success(`${PLATFORM_LABELS[variant.platform]} szöveg kimásolva.`);
    } catch {
      toast.error(
        "A böngésző nem engedte a másolást. Nyisd meg a posztot, és másold ki a szöveget.",
      );
    } finally {
      clipboardInFlight.current = false;
      setCopying(false);
    }
  }
  const channelPicker = channels.length > 0 && (
    <div
      className="post-inbox-platforms"
      role="group"
      aria-label={`${post.title} platformváltozatai`}
    >
      {channels.map((channel) => (
        <button
          type="button"
          key={channel}
          aria-label={`${PLATFORM_LABELS[channel]} változat: ${post.title}`}
          aria-pressed={variant?.platform === channel}
          disabled={!post.variants.some((item) => item.platform === channel)}
          onClick={() => setSelected(channel)}
        >
          <PlatformMark platform={channel} />
          <span>{PLATFORM_LABELS[channel]}</span>
        </button>
      ))}
    </div>
  );
  return (
    <Card
      className={`workspace-post-card post-inbox-card v2-feature-card ${cards ? "post-inbox-card-grid" : "post-inbox-card-row"}`}
      data-post-id={post.id}
      data-status={post.status}
    >
      {cards && (
        <div className="post-inbox-preview-area">
          {channelPicker}
          <div className="workspace-post-card-preview">
            <SocialPreview
              brandName={post.brandName}
              variants={variant ? [variant] : []}
              media={post.media}
              compact
            />
          </div>
        </div>
      )}
      {!cards && (
        <div className="post-inbox-thumbnail">
          {image ? (
            <img
              src={`/api/media/${image.id}`}
              alt={image.altText || image.filename}
              loading="lazy"
            />
          ) : (
            <FileText className="h-7 w-7" />
          )}
        </div>
      )}
      <div className="post-inbox-card-body">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <Link
              to="/app/posts/$id"
              params={{ id: post.id }}
              className="post-inbox-title hover:underline"
            >
              {post.title}
            </Link>
            <div className="mt-1 text-sm text-muted-foreground">
              {post.brandName} · {post.goal || "Cél nincs megadva"}
            </div>
          </div>
          <Badge
            className="post-inbox-status rounded-full"
            variant={
              post.status === "failed"
                ? "destructive"
                : post.status === "published"
                  ? "default"
                  : "secondary"
            }
          >
            {STATUS_LABELS[post.status]}
          </Badge>
        </div>
        {!cards && channelPicker}
        {!cards && variant && (
          <p className="post-inbox-list-text line-clamp-2">{postCopyText(variant)}</p>
        )}
        <div className="post-inbox-meta">
          {post.scheduledAt && (
            <span className="post-inbox-schedule" title={post.timezone}>
              <CalendarClock className="h-4 w-4" />
              {scheduled || "Az időpont ellenőrzést igényel"}
              {scheduled && <small>{post.timezone}</small>}
            </span>
          )}
          {variant?.status === "published" && (
            <span className="text-sm">{PLATFORM_LABELS[variant.platform]}: közzétéve</span>
          )}
        </div>
        <div className="post-inbox-actions">
          <Button size="sm" asChild>
            <Link to="/app/posts/$id" params={{ id: post.id }}>
              <ExternalLink className="mr-1 h-3.5 w-3.5" />
              {post.variants.length ? "Megnyitás" : "Poszt befejezése"}
            </Link>
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void copyText()}
            disabled={!variant?.content.trim() || copying}
            aria-label={`${variant ? `${PLATFORM_LABELS[variant.platform]} szöveg` : "Szöveg"} másolása: ${post.title}`}
          >
            {copying ? <LoaderCircle className="animate-spin" /> : <ClipboardCopy />}
            Szöveg másolása
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={(event) => {
              if (event.detail < 2) onDuplicate();
            }}
            disabled={busy}
            aria-label={`Másolat készítése: ${post.title}`}
          >
            {duplicating ? <LoaderCircle className="animate-spin" /> : <Copy />}
            {duplicating ? "Másolás…" : "Másolat"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive post-inbox-delete"
            onClick={onRemove}
            disabled={busy}
            aria-label={`Poszt törlése: ${post.title}`}
          >
            <Trash2 />
          </Button>
        </div>
      </div>
    </Card>
  );
}
