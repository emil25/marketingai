import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  ChevronRight,
  FileText,
  Globe,
  Image as ImageIcon,
  Lightbulb,
  Link2,
  Megaphone,
  MoreHorizontal,
  Plus,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getWorkspace } from "@/lib/workspace.functions";
import { getPosts, type PostSnapshot } from "@/lib/post.functions";
import { getMediaAssets } from "@/lib/media.functions";
import {
  getCampaigns,
  getPlanner,
  type CampaignSnapshot,
  type PlannerItemSnapshot,
} from "@/lib/campaign.functions";
import { getChannelConnections, type SafeChannelConnection } from "@/lib/channel.functions";
import { businessTypeQuickStarts, businessTypeLabel } from "@/lib/business-types";
import {
  activeBrandRecords,
  hasPlannedPostContent,
  isChannelConnected,
  weeklyPlanItems,
} from "@/lib/dashboard";
import { SocialPreview } from "@/components/social-preview";

export const Route = createFileRoute("/app/")({
  loader: async () => ({
    workspace: await getWorkspace(),
    posts: await getPosts(),
    media: await getMediaAssets(),
    campaigns: await getCampaigns(),
    planItems: await getPlanner({ data: {} }),
    channels: await getChannelConnections(),
  }),
  component: Dashboard,
});

const PLATFORM_LABELS: Record<string, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
  linkedin: "LinkedIn",
  youtube: "YouTube",
  "google-business": "Google Business",
};
const PLATFORM_GLYPHS: Record<string, string> = {
  facebook: "f",
  instagram: "◎",
  tiktok: "♪",
  linkedin: "in",
  youtube: "▶",
  "google-business": "G",
};

function formatDate(value: string, time?: string | null) {
  const date = new Date(`${value}T${time ?? "12:00"}:00`);
  return `${date.toLocaleDateString("hu-HU", { month: "short", day: "numeric" })}${time ? ` · ${time}` : ""}`;
}

function Dashboard() {
  const data = Route.useLoaderData();
  const brand = data.workspace.activeBrand;
  const firstName = data.workspace.user.displayName.split(" ")[0];
  const now = new Date();
  const posts = activeBrandRecords(data.posts, data.workspace.workspace.id, brand?.id);
  const media = activeBrandRecords(data.media, data.workspace.workspace.id, brand?.id);
  const campaigns = activeBrandRecords(data.campaigns, data.workspace.workspace.id, brand?.id);
  const channels = activeBrandRecords(data.channels, data.workspace.workspace.id, brand?.id);
  const weeklyPlanned = weeklyPlanItems(
    activeBrandRecords(data.planItems, data.workspace.workspace.id, brand?.id),
    now,
  );
  const ready = weeklyPlanned.filter((item) => hasPlannedPostContent(item, posts));
  const upcoming = weeklyPlanned.slice(0, 7);
  const scheduledWithinFortnight = posts.filter(
    (post) =>
      post.status === "scheduled" &&
      post.scheduledAt &&
      Date.parse(post.scheduledAt) >= now.getTime() &&
      Date.parse(post.scheduledAt) < now.getTime() + 14 * 24 * 60 * 60 * 1000,
  ).length;
  const activeCampaigns = campaigns
    .filter((campaign) => !["archived", "completed"].includes(campaign.status))
    .slice(0, 3);

  return (
    <div className="reference-page workspace-dashboard space-y-6">
      {brand ? (
        <>
          <section className="reference-hero workspace-hero">
            <HeroArtwork />
            <div className="reference-hero-copy">
              <span className="reference-hero-pill">
                <Sparkles className="h-3.5 w-3.5" /> KEVESEBB MUNKA. TÖBB JÓ TARTALOM.
              </span>
              <h2>
                {weeklyPlanned.length
                  ? ready.length
                    ? `${ready.length} posztod már készen áll.`
                    : `${weeklyPlanned.length} ötletből legyen kész poszt.`
                  : "A következő jó posztod itt kezdődik."}
              </h2>
              <p>
                {weeklyPlanned.length
                  ? ready.length === weeklyPlanned.length
                    ? "A heti szövegek elkészültek. Nézd át, adj képet, és állítsd be a következő lépést."
                    : "A heti terv már megvan. Az AI segít a hiányzó szövegek elkészítésében."
                  : "Mondd el az ötletedet. Az AI ismeri a márkádat, és segít megtalálni a megfelelő szavakat."}
              </p>
              <div className="reference-hero-actions">
                <Link to="/app/posts/$id" params={{ id: "new" }}>
                  <Button className="reference-hero-button">
                    Készítsünk egy posztot <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                </Link>
                <Link to="/app/campaigns" search={{ mode: "weekly" }}>
                  <Button variant="outline" className="reference-hero-secondary">
                    Készítsd el a heti marketingemet
                  </Button>
                </Link>
              </div>
            </div>
            <div className="workspace-hero-progress">
              <div
                className="reference-progress"
                style={
                  {
                    "--progress": `${weeklyPlanned.length ? Math.round((ready.length / weeklyPlanned.length) * 100) : 0}%`,
                  } as React.CSSProperties
                }
              >
                <strong>
                  {ready.length}/{weeklyPlanned.length}
                </strong>
                <span>szöveg kész</span>
              </div>
              <small>A következő 7 nap terve</small>
            </div>
          </section>
          <AiCommand />
          <section className="reference-kpis">
            <StatCard
              icon={FileText}
              tone="coral"
              label="Összes poszt"
              value={String(posts.length)}
              detail="Az aktív márkádhoz"
            />
            <StatCard
              icon={FileText}
              tone="green"
              label="Piszkozat"
              value={String(posts.filter((post) => post.status === "draft").length)}
              detail="Szerkesztésre vár"
            />
            <StatCard
              icon={CalendarDays}
              tone="blue"
              label="Időzítve"
              value={String(scheduledWithinFortnight)}
              detail="A következő 14 napban"
            />
            <StatCard
              icon={ImageIcon}
              tone="yellow"
              label="Média"
              value={String(media.length)}
              detail="Mentett kép és videó"
            />
          </section>
          <NextStep
            hasProfile={Boolean(
              brand.audience && (brand.products || brand.services || brand.profile.description),
            )}
            hasPost={posts.some((post) => post.variants.some((variant) => variant.content.trim()))}
            hasCampaign={campaigns.length > 0}
            hasConnection={channels.some((channel) => isChannelConnected(channel))}
          />
          <section className="workspace-recent">
            <div className="reference-section-head">
              <div>
                <span className="reference-section-label">A TARTALMAID, ÉLETRE KELTVE</span>
                <h2>A stúdiódból</h2>
              </div>
              <Link to="/app/posts" className="legacy-link">
                Összes poszt <ArrowRight className="ml-1 inline h-4 w-4" />
              </Link>
            </div>
            {posts.length ? (
              <div className="workspace-content-grid">
                {[...posts]
                  .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
                  .slice(0, 3)
                  .map((post) => (
                    <Link
                      key={post.id}
                      to="/app/posts/$id"
                      params={{ id: post.id }}
                      className="workspace-content-card"
                    >
                      <div className="workspace-content-meta">
                        <strong>{post.title}</strong>
                        <Badge variant="secondary">
                          {
                            {
                              idea: "Ötlet",
                              draft: "Piszkozat",
                              review: "Ellenőrzés",
                              scheduled: "Ütemezve",
                              published: "Közzétéve",
                              failed: "Sikertelen",
                            }[post.status]
                          }
                        </Badge>
                      </div>
                      <SocialPreview
                        compact
                        brandName={brand.name}
                        variants={post.variants}
                        media={post.media}
                      />
                      <span className="workspace-content-open">
                        Szerkesztés és előnézet <ArrowRight className="h-4 w-4" />
                      </span>
                    </Link>
                  ))}
              </div>
            ) : (
              <div className="workspace-empty-content">
                <span>
                  <ImageIcon className="h-7 w-7" />
                </span>
                <div>
                  <h3>Még üres a stúdiód. Kezdjük egy ötlettel.</h3>
                  <p>Az első mentett posztod itt jelenik meg valódi előnézettel.</p>
                </div>
                <Link to="/app/posts/$id" params={{ id: "new" }}>
                  <Button>Első poszt készítése</Button>
                </Link>
              </div>
            )}
          </section>
          <div className="legacy-grid reference-lower-grid">
            <UpcomingPosts items={upcoming} posts={posts} />
            <ChannelStatus brandName={brand.name} connections={channels} />
          </div>
          <CampaignOverview campaigns={activeCampaigns} />
          <QuickActions businessType={brand.profile.businessType} />
          <WebsitePlan website={brand.website} />
        </>
      ) : (
        <EmptyBrand firstName={firstName} />
      )}
    </div>
  );
}

function HeroArtwork() {
  return (
    <svg className="workspace-hero-art" viewBox="0 0 580 330" fill="none" aria-hidden="true">
      <defs>
        <linearGradient
          id="workspace-orbit"
          x1="75"
          y1="40"
          x2="480"
          y2="330"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#87b3a4" stopOpacity=".18" />
          <stop offset="1" stopColor="#e6b49b" stopOpacity=".04" />
        </linearGradient>
      </defs>
      <circle cx="325" cy="160" r="245" stroke="url(#workspace-orbit)" strokeWidth="70" />
      <circle cx="325" cy="160" r="175" stroke="#bfddcc" strokeOpacity=".12" />
      <circle
        cx="325"
        cy="160"
        r="122"
        stroke="#bfddcc"
        strokeOpacity=".15"
        strokeDasharray="5 14"
      />
      <path
        d="M60 290C170 230 220 160 360 155s160-70 220-115"
        stroke="#f18d72"
        strokeOpacity=".65"
        strokeWidth="2"
      />
      <circle cx="207" cy="204" r="6" fill="#ff9b7f" />
      <circle cx="515" cy="90" r="4" fill="#bfddcc" />
      <path d="m130 68 5 12 12 5-12 5-5 12-5-12-12-5 12-5z" fill="#f3ccad" fillOpacity=".7" />
    </svg>
  );
}

function AiCommand() {
  const [brief, setBrief] = useState("");
  const navigate = useNavigate();
  return (
    <form
      className="workspace-command"
      onSubmit={(event) => {
        event.preventDefault();
        if (brief.trim())
          void navigate({ to: `/app/posts/new?topic=${encodeURIComponent(brief.trim())}` });
      }}
    >
      <span className="workspace-command-icon">
        <Sparkles className="h-5 w-5" />
      </span>
      <label htmlFor="dashboard-brief" className="sr-only">
        Milyen tartalmat készítsünk?
      </label>
      <input
        id="dashboard-brief"
        value={brief}
        onChange={(event) => setBrief(event.target.value)}
        placeholder="Van egy ötleted? Írd le, és készítsünk belőle posztot…"
        maxLength={4000}
      />
      <Button type="submit" disabled={!brief.trim()}>
        Készítsük el <ArrowRight className="ml-1 h-4 w-4" />
      </Button>
    </form>
  );
}

function NextStep({
  hasProfile,
  hasPost,
  hasCampaign,
  hasConnection,
}: {
  hasProfile: boolean;
  hasPost: boolean;
  hasCampaign: boolean;
  hasConnection: boolean;
}) {
  const steps = [
    { title: "Márkád hangja", sub: "Profil és közönség", done: hasProfile, to: "/app/brand" },
    {
      title: "Az első poszt",
      sub: "Egy ötletből kész szöveg",
      done: hasPost,
      to: "/app/posts/new",
    },
    {
      title: "Tartalomterv",
      sub: "Tervezd meg a következő heteket",
      done: hasCampaign,
      to: "/app/campaigns",
    },
    {
      title: "Csatornák",
      sub: "Kapcsold össze a fiókjaidat",
      done: hasConnection,
      to: "/app/channels",
    },
  ];
  const next = steps.findIndex((step) => !step.done);
  return (
    <section className="workspace-workflow">
      <div className="workspace-workflow-title">
        <span className="reference-section-label">EGY LÉPÉSSEL ELŐRÉBB</span>
        <strong>{next < 0 ? "A munkatered készen áll." : "Innen érdemes folytatnod."}</strong>
      </div>
      <div className="workspace-workflow-steps">
        {steps.map((step, index) => (
          <Link
            key={step.title}
            to={step.to}
            className={`workspace-workflow-step ${step.done ? "is-done" : index === next ? "is-next" : ""}`}
          >
            <span>{step.done ? "✓" : String(index + 1).padStart(2, "0")}</span>
            <div>
              <strong>{step.title}</strong>
              <small>{step.sub}</small>
            </div>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        ))}
      </div>
    </section>
  );
}

function WebsitePlan({ website }: { website: string }) {
  return (
    <section className="reference-website">
      <div className="reference-website-copy">
        <span className="reference-section-label">MÁRKÁD WEBOLDALA</span>
        <h2>Egészítsd ki a vállalkozásod profilját</h2>
        <p>
          A weboldalcímet és a vállalkozásod bemutatását a Márka AI oldalon mentheted. Ezeket az AI
          felhasználja a tartalomkészítésnél.
        </p>
      </div>
      <div className="reference-website-action">
        <span className="reference-link-icon">
          <Link2 className="h-4 w-4" />
        </span>
        <input
          value={website}
          placeholder="Még nincs weboldal megadva"
          readOnly
          aria-label="Mentett weboldalcím"
        />
        <Link to="/app/brand">
          <Button className="reference-coral-button">
            {website ? "Márkaprofil szerkesztése" : "Weboldal megadása"}
          </Button>
        </Link>
      </div>
    </section>
  );
}

function StatCard({
  icon: Icon,
  tone,
  label,
  value,
  detail,
}: {
  icon: typeof FileText;
  tone: "coral" | "green" | "blue" | "yellow";
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="reference-kpi">
      <span className={`reference-kpi-icon ${tone}`}>
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
        <em>{detail}</em>
      </div>
    </article>
  );
}

function UpcomingPosts({
  items,
  posts,
}: {
  items: PlannerItemSnapshot[];
  posts: Array<
    PostSnapshot["post"] & {
      variants: unknown[];
      media: Array<{ id: string; altText?: string | null }>;
    }
  >;
}) {
  return (
    <section className="legacy-card reference-posts-card">
      <div className="legacy-cardhead">
        <div>
          <h3>Következő posztok</h3>
          <p>A következő 7 nap tartalmai</p>
        </div>
        <Link to="/app/calendar" className="legacy-link">
          Összes megtekintése <ArrowRight className="ml-1 inline h-3.5 w-3.5" />
        </Link>
      </div>
      {items.length ? (
        <div className="reference-post-list">
          {items.map((item) => {
            const post = item.postId
              ? posts.find((candidate) => candidate.id === item.postId)
              : undefined;
            const media = post?.media[0];
            return (
              <Link
                key={item.id}
                to={item.postId ? "/app/posts/$id" : "/app/planner"}
                params={item.postId ? { id: item.postId } : undefined}
                className="reference-post-row"
              >
                <span className="reference-post-thumbnail">
                  {media ? (
                    <img src={`/api/media/${media.id}`} alt={media.altText ?? ""} />
                  ) : (
                    <CalendarDays className="h-5 w-5" />
                  )}
                </span>
                <span className="reference-post-copy">
                  <strong>{post?.title ?? item.topic}</strong>
                  <small>{item.contentType || "Tartalom"}</small>
                </span>
                <span className="reference-platform-pill">
                  <b>{PLATFORM_GLYPHS[item.platform] ?? "•"}</b>
                  <span>{PLATFORM_LABELS[item.platform] ?? item.platform}</span>
                </span>
                <time>{formatDate(item.date, item.time)}</time>
                <Badge className="legacy-badge">{item.postStatus ?? item.status}</Badge>
                <span className="reference-post-menu" aria-label="Poszt megnyitása">
                  <MoreHorizontal className="h-4 w-4" />
                </span>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="legacy-empty">
          <CalendarDays className="h-5 w-5" />
          <span>
            <strong>Még nincs megtervezett posztod.</strong>
            <small>Indíts egy kampányt, hogy valódi tervtételek jelenjenek meg itt.</small>
          </span>
          <Link to="/app/campaigns" className="legacy-link">
            Kampány indítása <ArrowRight className="ml-1 inline h-3.5 w-3.5" />
          </Link>
        </div>
      )}
    </section>
  );
}

function ChannelStatus({
  brandName,
  connections,
}: {
  brandName: string;
  connections: SafeChannelConnection[];
}) {
  const channels = [
    { id: "facebook", label: "Facebook", glyph: "f", tone: "fb" },
    { id: "instagram", label: "Instagram", glyph: "◎", tone: "ig" },
    { id: "tiktok", label: "TikTok", glyph: "♪", tone: "tt" },
    { id: "youtube", label: "YouTube", glyph: "▶", tone: "yt" },
    { id: "linkedin", label: "LinkedIn", glyph: "in", tone: "li" },
    { id: "pinterest", label: "Pinterest", glyph: "p", tone: "pi" },
  ] as const;
  const statusLabel = (connection?: SafeChannelConnection) => {
    if (!connection || connection.status === "not_connected") return "Nincs külső kapcsolat";
    if (isChannelConnected(connection)) return connection.externalAccountName || "Kapcsolva";
    if (connection.status === "connected") return "Kapcsolat ellenőrzése szükséges";
    if (connection.status === "connecting") return "Kapcsolódás folyamatban";
    if (connection.status === "expired") return "Lejárt kapcsolat";
    return "Kapcsolat ellenőrzése szükséges";
  };
  const actionLabel = (connection?: SafeChannelConnection) =>
    isChannelConnected(connection) ? "Kapcsolat kezelése" : "Csatlakoztatás";
  return (
    <section className="legacy-card">
      <div className="legacy-cardhead">
        <div>
          <h3>Csatornák állapota</h3>
          <p>{brandName} · kapcsolatok kezelése</p>
        </div>
        <Link to="/app/channels" className="legacy-link">
          Részletek <ArrowRight className="ml-1 inline h-3.5 w-3.5" />
        </Link>
      </div>
      <div className="legacy-channels">
        {channels.map((channel) => {
          const connection = connections.find((item) => item.provider === channel.id);
          return (
            <div key={channel.label}>
              <b className={`legacy-channel-icon ${channel.tone}`}>{channel.glyph}</b>
              <span>
                <strong>{channel.label}</strong>
                <small>{statusLabel(connection)}</small>
              </span>
              <Link to="/app/channels" className="reference-channel-status">
                {actionLabel(connection)}
              </Link>
              <ChevronRight className="reference-channel-arrow h-4 w-4" />
            </div>
          );
        })}
      </div>
    </section>
  );
}

function CampaignOverview({ campaigns }: { campaigns: CampaignSnapshot[] }) {
  return (
    <section className="reference-campaigns">
      <div className="reference-section-head">
        <div>
          <span className="reference-section-label">KAMPÁNYOK</span>
          <h2>Aktív kampányok</h2>
        </div>
        <Link to="/app/campaigns" className="legacy-link">
          Összes kampány <ArrowRight className="ml-1 inline h-3.5 w-3.5" />
        </Link>
      </div>
      {campaigns.length ? (
        <div className="reference-campaign-grid">
          {campaigns.map((campaign) => {
            const progress = campaign.counts.planned
              ? Math.round((campaign.counts.created / campaign.counts.planned) * 100)
              : 0;
            return (
              <Link
                key={campaign.id}
                to="/app/campaigns/$id"
                params={{ id: campaign.id }}
                className="reference-campaign-card"
              >
                <div className="reference-campaign-visual">
                  <span>{campaign.name.slice(0, 1).toUpperCase()}</span>
                  <Badge>
                    {campaign.status === "active"
                      ? "Aktív"
                      : campaign.status === "planning"
                        ? "Tervezés"
                        : campaign.status === "paused"
                          ? "Szünetel"
                          : "Piszkozat"}
                  </Badge>
                </div>
                <div className="reference-campaign-body">
                  <h3>{campaign.name}</h3>
                  <p>{campaign.objective || "Kampánycél még nincs megadva."}</p>
                  <div className="reference-campaign-meta">
                    <span>
                      {campaign.counts.planned} poszt · {campaign.channels.length} csatorna
                    </span>
                    <strong>{progress}%</strong>
                  </div>
                  <div className="reference-campaign-progress">
                    <span style={{ width: `${progress}%` }} />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="reference-inline-empty">
          <Megaphone className="h-5 w-5" />
          <span>
            <strong>Még nincs kampányod.</strong>
            <small>
              Hozd létre az első briefet, hogy az AI valódi 30 napos tervet készíthessen.
            </small>
          </span>
          <Link to="/app/campaigns">
            <Button className="reference-coral-button">Kampány létrehozása</Button>
          </Link>
        </div>
      )}
    </section>
  );
}

function QuickActions({ businessType }: { businessType?: string }) {
  const starts = businessTypeQuickStarts(businessType);
  const icons = [Sparkles, WandSparkles, Megaphone, Globe, ImageIcon, FileText];
  const actions = starts.map((title, index) => {
    const platform = /instagram|reels/i.test(title)
      ? "instagram"
      : /facebook/i.test(title)
        ? "facebook"
        : /linkedin/i.test(title)
          ? "linkedin"
          : /google/i.test(title)
            ? "google-business"
            : undefined;
    const platformQuery = platform ? `&platform=${platform}` : "";
    return {
      to: `/app/posts/new?quickStart=${encodeURIComponent(title)}&topic=${encodeURIComponent(title)}&goal=${encodeURIComponent("tartalomkészítés")}${platformQuery}`,
      icon: icons[index] ?? Sparkles,
      title,
      description: `${businessTypeLabel(businessType)} számára személyre szabott posztindító.`,
    };
  });
  return (
    <section className="reference-quick-actions">
      <div className="reference-section-head">
        <div>
          <span className="reference-section-label">GYORSFUNKCIÓK</span>
          <h2>Dolgozz tovább egy kattintással</h2>
        </div>
        <Link to="/app/brand" hash="business-type" className="text-sm font-medium text-primary">
          Vállalkozásodra szabva <ArrowRight className="ml-1 inline h-4 w-4" />
        </Link>
      </div>
      <div className="reference-quick-grid">
        {actions.map(({ to, icon: Icon, title, description }) => (
          <Link key={to} to={to} className="reference-quick-card">
            <span className="reference-quick-icon">
              <Icon className="h-5 w-5" />
            </span>
            <span className="reference-quick-copy">
              <strong>{title}</strong>
              <small>{description}</small>
              <em>
                Megnyitás <ArrowRight className="ml-1 inline h-3.5 w-3.5" />
              </em>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function EmptyBrand({ firstName }: { firstName: string }) {
  return (
    <Card className="reference-empty-brand">
      <WandSparkles className="h-8 w-8" />
      <span className="reference-section-label">MAI MUNKATÉR</span>
      <h2>Építsd fel a marketingközpontodat, {firstName}.</h2>
      <p>
        A Brand Voice mentése után a MarketingPilot AI valódi márka- és kampánykontextussal
        dolgozik.
      </p>
      <Link to="/app/brand">
        <Button className="reference-coral-button">
          <Plus className="mr-1 h-4 w-4" />
          Márka létrehozása
        </Button>
      </Link>
    </Card>
  );
}
