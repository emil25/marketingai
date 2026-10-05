import { useState } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/app-chrome";
import { getWorkspace } from "@/lib/workspace.functions";
import {
  completeChannelOAuthSelection,
  disconnectChannel,
  getChannelOAuthSelection,
  getChannelConnections,
  refreshChannelConnection,
  type SafeChannelOAuthSelection,
  type SafeChannelConnection,
} from "@/lib/channel.functions";
import {
  Facebook,
  Instagram,
  Linkedin,
  Music2,
  Pin,
  Radio,
  Sparkles,
  RefreshCw,
  Unplug,
  Youtube,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/channels")({
  validateSearch: z.object({
    channelError: z.string().optional(),
    channelConnected: z.string().optional(),
    channelSelection: z.string().optional(),
  }),
  loaderDeps: ({ search }) => ({ channelSelection: search.channelSelection }),
  loader: async ({ deps }) => {
    let selection: SafeChannelOAuthSelection | null = null;
    if (deps.channelSelection) {
      try {
        selection = await getChannelOAuthSelection({
          data: { selectionId: deps.channelSelection },
        });
      } catch {
        selection = null;
      }
    }
    return {
      workspace: await getWorkspace(),
      connections: await getChannelConnections(),
      selection,
    };
  },
  component: Channels,
});

const CHANNELS = [
  {
    id: "facebook",
    label: "Facebook",
    description: "Oldalak és kampánytartalmak",
    icon: Facebook,
    meta: true,
  },
  {
    id: "instagram",
    label: "Instagram",
    description: "Feed, Story és Reels",
    icon: Instagram,
    meta: true,
  },
  {
    id: "tiktok",
    label: "TikTok",
    description: "Rövid videók és hookok",
    icon: Music2,
    meta: false,
  },
  { id: "youtube", label: "YouTube", description: "Videók és Shorts", icon: Youtube, meta: false },
  {
    id: "linkedin",
    label: "LinkedIn",
    description: "Szakmai tartalmak",
    icon: Linkedin,
    meta: false,
  },
  {
    id: "pinterest",
    label: "Pinterest",
    description: "Pin-ek és vizuális ötletek",
    icon: Pin,
    meta: false,
  },
] as const;

const STATUS: Record<
  SafeChannelConnection["status"],
  { label: string; className: string; action: string }
> = {
  not_connected: {
    label: "Nincs kapcsolat",
    className: "bg-muted text-muted-foreground",
    action: "Csatlakoztatás",
  },
  connecting: {
    label: "Kapcsolódás…",
    className: "bg-amber-100 text-amber-800",
    action: "Folyamatban",
  },
  connected: {
    label: "Kapcsolva",
    className: "bg-emerald-100 text-emerald-800",
    action: "Kapcsolat kezelése",
  },
  expired: {
    label: "Lejárt kapcsolat",
    className: "bg-amber-100 text-amber-800",
    action: "Újracsatlakozás",
  },
  error: { label: "Hiba történt", className: "bg-red-100 text-red-800", action: "Újracsatlakozás" },
  revoked: {
    label: "Visszavonva",
    className: "bg-red-100 text-red-800",
    action: "Újracsatlakozás",
  },
};

const NOTICE: Record<string, string> = {
  config:
    "A Meta OAuth még nincs konfigurálva ezen a környezeten. Állítsd be a szerver .env változóit.",
  state: "Az OAuth munkamenet érvénytelen vagy lejárt. Indítsd újra a csatlakozást.",
  cancelled: "A Meta-kapcsolást megszakítottad.",
  no_page: "Nem található kezelhető Facebook-oldal ehhez a Meta-fiókhoz.",
  no_instagram: "A kiválasztott Facebook-oldalhoz nincs kapcsolt Instagram Professional-fiók.",
  provider:
    "A Meta nem fogadta el a kapcsolódást. Ellenőrizd a jogosultságokat, majd próbáld újra.",
  unsupported: "Ehhez a szolgáltatóhoz még nincs OAuth-kapcsolat bekötve.",
  unexpected: "Váratlan hiba történt a csatorna kapcsolásakor.",
};

function Channels() {
  const { workspace, connections, selection } = Route.useLoaderData();
  const search = Route.useSearch();
  const router = useRouter();
  const disconnect = useServerFn(disconnectChannel);
  const refresh = useServerFn(refreshChannelConnection);
  const completeSelection = useServerFn(completeChannelOAuthSelection);
  const [busyId, setBusyId] = useState<string | null>(null);
  const brand = workspace.activeBrand;
  const connectedCount = connections.filter(
    (connection) => connection.status === "connected",
  ).length;

  async function disconnectOne(connection: SafeChannelConnection) {
    if (
      !window.confirm(
        `Leválasztod a ${connection.externalAccountName || connection.provider} kapcsolatot?`,
      )
    )
      return;
    setBusyId(connection.id);
    try {
      await disconnect({ data: { connectionId: connection.id } });
      await router.invalidate();
      toast.success("A csatorna leválasztva.");
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : "Nem sikerült leválasztani a csatornát.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function refreshOne(connection: SafeChannelConnection) {
    setBusyId(connection.id);
    try {
      await refresh({ data: { connectionId: connection.id } });
      await router.invalidate();
      toast.success("A Meta-kapcsolat érvényes.");
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : "Nem sikerült ellenőrizni a kapcsolatot.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function chooseSelection(candidateId: string) {
    if (!selection) return;
    setBusyId(selection.id);
    try {
      const result = await completeSelection({
        data: { selectionId: selection.id, candidateId },
      });
      await router.navigate({
        to: "/app/channels",
        search: { channelConnected: result.provider },
      });
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : "Nem sikerült kiválasztani a csatornát.",
      );
    } finally {
      setBusyId(null);
    }
  }

  function unsupported(label: string) {
    toast.info(`${label} OAuth-kapcsolata egy későbbi provider-fázisban készül.`);
  }

  return (
    <div className="space-y-7">
      <PageHeader
        title="Csatornák"
        sub="Kapcsold össze a valódi csatornáidat; a hozzáférési tokenek csak a szerveren maradnak."
        action={
          <Badge variant="secondary" className="rounded-full">
            <Radio className="mr-1 h-3.5 w-3.5" />
            {connectedCount} / 6 kapcsolva
          </Badge>
        }
      />

      {(search.channelError || search.channelConnected) && (
        <Card
          className={`rounded-2xl border p-4 ${search.channelError ? "border-red-200 bg-red-50/70" : "border-emerald-200 bg-emerald-50/70"}`}
        >
          <p
            className={`text-sm font-medium ${search.channelError ? "text-red-900" : "text-emerald-900"}`}
          >
            {search.channelError
              ? NOTICE[search.channelError] || NOTICE.unexpected
              : `${search.channelConnected === "instagram" ? "Instagram" : "Facebook"} kapcsolat sikeresen létrejött.`}
          </p>
        </Card>
      )}

      {selection && (
        <Card className="tt-onboarding rounded-2xl border-primary/30 bg-primary/5 p-6 md:p-8">
          <div className="tt-eyebrow">META · VÁLASZTÁS SZÜKSÉGES</div>
          <h2 className="mt-2 font-display text-2xl font-extrabold">
            Válaszd ki a kapcsolni kívánt{" "}
            {selection.provider === "instagram" ? "Instagram-fiókot" : "Facebook-oldalt"}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            A Meta több kezelhető kapcsolatot adott vissza. Válassz egyet; a hozzáférési tokenek
            csak a szerveren maradnak.
          </p>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {selection.candidates.map((candidate) => (
              <Button
                key={candidate.id}
                type="button"
                variant="outline"
                className="h-auto justify-between rounded-2xl border bg-background p-4 text-left"
                onClick={() => void chooseSelection(candidate.id)}
                disabled={busyId === selection.id}
              >
                <span>
                  <span className="block font-semibold">{candidate.externalAccountName}</span>
                  {candidate.pageName && selection.provider === "instagram" && (
                    <span className="mt-1 block text-xs text-muted-foreground">
                      Facebook Page: {candidate.pageName}
                    </span>
                  )}
                </span>
                <span className="text-xs text-primary">
                  {busyId === selection.id ? "Mentés…" : "Kiválasztás"}
                </span>
              </Button>
            ))}
          </div>
        </Card>
      )}

      <Card className="tt-onboarding rounded-2xl p-6 md:p-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="tt-eyebrow">AKTÍV MÁRKA · VALÓDI CSATORNAKAPCSOLATOK</div>
            <h2 className="mt-2 font-display text-2xl font-extrabold">
              {brand?.name ?? "Még nincs aktív márka"}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {brand
                ? "A Facebook és Instagram kapcsolás a Meta hivatalos OAuth-folyamatán keresztül történik. A többi szolgáltatónál az előkészített, őszinte állapotot látod."
                : "Előbb ments egy márkát és Brand Voice-ot, hogy a csatornakapcsolat a megfelelő munkatérhez tartozzon."}
            </p>
          </div>
          {!brand && (
            <Link to="/app/brand">
              <Button className="tt-primary">Márka létrehozása</Button>
            </Link>
          )}
        </div>
      </Card>

      <div>
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-bold tracking-tight">Social csatornák</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              A kapcsolat állapota mindig a szerveren tárolt valós rekordból jelenik meg.
            </p>
          </div>
          <Link
            to="/app/posts/$id"
            params={{ id: "new" }}
            className="hidden text-sm font-medium text-primary hover:underline sm:block"
          >
            Új poszt készítése
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {CHANNELS.map((channel) => {
            const Icon = channel.icon;
            const connection = connections.find((candidate) => candidate.provider === channel.id);
            const state = STATUS[connection?.status ?? "not_connected"];
            const isBusy = busyId === connection?.id;
            return (
              <Card
                key={channel.id}
                className="tt-card group p-5 transition hover:-translate-y-0.5 hover:ring-primary/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-soft text-brand">
                    <Icon className="h-5 w-5" />
                  </div>
                  <Badge
                    variant="outline"
                    className={`rounded-full border-0 text-[10px] ${state.className}`}
                  >
                    {state.label}
                  </Badge>
                </div>
                <h3 className="mt-5 font-semibold">{channel.label}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{channel.description}</p>
                {connection?.status === "connected" && (
                  <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                    <div className="font-medium text-foreground">
                      {connection.externalAccountName || "Kapcsolt fiók"}
                    </div>
                    <div>
                      {connection.connectedAt
                        ? `Kapcsolva: ${new Date(connection.connectedAt).toLocaleDateString("hu-HU")}`
                        : "Kapcsolva"}
                      {connection.scopes.length ? ` · ${connection.scopes.length} jogosultság` : ""}
                    </div>
                  </div>
                )}
                {connection?.lastError && connection.status !== "connected" && (
                  <p className="mt-3 text-xs text-red-700">{connection.lastError}</p>
                )}
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {channel.meta ? (
                    connection?.status === "connected" ? (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="tt-outline"
                          onClick={() => void refreshOne(connection)}
                          disabled={isBusy}
                        >
                          <RefreshCw
                            className={`mr-1 h-3.5 w-3.5 ${isBusy ? "animate-spin" : ""}`}
                          />
                          Ellenőrzés
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => void disconnectOne(connection)}
                          disabled={isBusy}
                        >
                          <Unplug className="mr-1 h-3.5 w-3.5" />
                          Leválasztás
                        </Button>
                      </>
                    ) : connection?.status === "connecting" ? (
                      <Button size="sm" className="tt-primary" disabled>
                        <RefreshCw className="mr-1 h-3.5 w-3.5 animate-spin" />
                        Kapcsolódás…
                      </Button>
                    ) : (
                      <Button size="sm" className="tt-primary" asChild disabled={!brand}>
                        <a href={brand ? `/api/channels/oauth/${channel.id}` : "/app/brand"}>
                          {state.action}
                        </a>
                      </Button>
                    )
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="tt-outline"
                      onClick={() => unsupported(channel.label)}
                    >
                      <Sparkles className="mr-1 h-3.5 w-3.5" />
                      {state.action}
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
