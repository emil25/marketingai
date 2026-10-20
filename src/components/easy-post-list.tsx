import { useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { getPosts, deletePost } from "@/lib/post.functions";
import { contentPlaceholders } from "@/lib/content-quality";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Input } from "./ui/input";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "./ui/alert-dialog";
export function EasyPostList({
  posts,
  brandId,
}: {
  posts: Awaited<ReturnType<typeof getPosts>>;
  brandId?: string;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [target, setTarget] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const remove = useServerFn(deletePost);
  const router = useRouter();
  const status = (post: (typeof posts)[number]) =>
    post.status === "published"
      ? "published"
      : post.variants.some((v) => v.content.trim()) &&
          !post.variants.some((v) => contentPlaceholders(v.content, v.cta, ...v.hashtags).length)
        ? "ready"
        : "draft";
  const visible = posts
    .filter((p) => p.brandId === brandId && p.variants.some((v) => v.content.trim()))
    .filter(
      (p) =>
        (filter === "all" || status(p) === filter) &&
        `${p.title} ${p.variants.map((v) => v.content).join(" ")}`
          .toLocaleLowerCase("hu")
          .includes(query.toLocaleLowerCase("hu")),
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Posztjaim</h1>
        <Link to="/app/posts/$id" params={{ id: "new" }}>
          <Button>Új poszt</Button>
        </Link>
      </div>
      <label className="block">
        Keresés
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Mit keresel a posztokban?"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        {[
          ["draft", "Piszkozat"],
          ["ready", "Kész"],
          ["published", "Közzétett"],
        ].map(([value, label]) => (
          <Button
            key={value}
            variant={filter === value ? "default" : "outline"}
            aria-pressed={filter === value}
            onClick={() => setFilter(filter === value ? "all" : value)}
          >
            {label}
          </Button>
        ))}
      </div>
      {visible.map((post) => (
        <Card key={post.id} className="p-4">
          <div className="flex items-start gap-3">
            <Link className="min-w-0 flex-1" to="/app/posts/$id" params={{ id: post.id }}>
              <span className="block text-sm text-muted-foreground">
                {new Date(post.updatedAt).toLocaleDateString("hu-HU")} ·{" "}
                {status(post) === "published"
                  ? "Közzétett"
                  : status(post) === "ready"
                    ? "Kész"
                    : "Piszkozat"}
              </span>
              <strong className="mt-2 block break-words">{post.title}</strong>
              <p className="mt-2 line-clamp-3 break-words text-sm">{post.variants[0]?.content}</p>
            </Link>
            <Button
              variant="ghost"
              aria-label={`Törlés: ${post.title}`}
              onClick={() => {
                setTarget(post.id);
                setError("");
              }}
            >
              Törlés
            </Button>
          </div>
        </Card>
      ))}
      {!visible.length && (
        <Card className="p-5">
          <p>
            {query || filter !== "all"
              ? "Nincs ilyen poszt. Próbálj másik keresést vagy szűrőt."
              : "Az első posztod itt fog megjelenni."}
          </p>
          <Link
            className="inline-flex min-h-11 items-center underline"
            to="/app/posts/$id"
            params={{ id: "new" }}
          >
            Poszt készítése →
          </Link>
        </Card>
      )}
      <AlertDialog
        open={!!target}
        onOpenChange={(open) => {
          if (!busy && !open) setTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Biztosan törlöd a posztot?</AlertDialogTitle>
            <AlertDialogDescription>
              A poszt és a mentett szövegváltozatai törlődnek. Ez nem vonható vissza.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && <p role="alert">{error}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Mégse</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={async () => {
                if (!target || busy) return;
                setBusy(true);
                try {
                  await remove({ data: { postId: target } });
                  await router.invalidate();
                  setTarget(null);
                } catch (cause) {
                  setError(cause instanceof Error ? cause.message : "Nem sikerült törölni.");
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "Törlés…" : "Igen, törlöm"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
