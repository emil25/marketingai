import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  CalendarDays,
  Check,
  FileText,
  Globe,
  Image as ImageIcon,
  Lightbulb,
  Link2,
  Megaphone,
  Plus,
  Radio,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getWorkspace } from "@/lib/workspace.functions";
import { getPosts } from "@/lib/post.functions";
import { getMediaAssets } from "@/lib/media.functions";
import {
  getCampaigns,
  getPlanner,
  type CampaignSnapshot,
  type PlannerItemSnapshot,
} from "@/lib/campaign.functions";
import { getChannelConnections } from "@/lib/channel.functions";
import { businessTypeQuickStarts, businessTypeLabel } from "@/lib/business-types";
import {
  activeBrandRecords,
  connectedChannelCount,
  hasPlannedPostContent,
  weeklyPlanItems,
} from "@/lib/dashboard";
import { SocialPreview, PlatformMark } from "@/components/social-preview";
import "@/dashboard-workspace.css";

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

const STATUS_LABELS: Record<string, string> = {
  idea: "Ötlet",
  planned: "Tervezett",
  draft: "Piszkozat",
  review: "Ellenőrzésre vár",
  scheduled: "Ütemezve",
  published: "Közzétéve",
  failed: "Sikertelen",
  skipped: "Kihagyva",
  ready: "Elkészült",
  generated: "Elkészült",
};

type DashboardPost = Awaited<ReturnType<typeof getPosts>>[number];

function formatDate(date: string, time?: string | null) {
  const value = new Date(`${date}T12:00:00`);
  if (!Number.isFinite(value.getTime())) return "Időpont beállítása szükséges";
  return `${value.toLocaleDateString("hu-HU", { weekday: "short", month: "short", day: "numeric" })}${time ? ` · ${time}` : ""}`;
}

function starterUrl(topic: string) {
  const platform = /instagram|reels/i.test(topic)
    ? "instagram"
    : /facebook/i.test(topic)
      ? "facebook"
      : /linkedin/i.test(topic)
        ? "linkedin"
        : /google/i.test(topic)
          ? "google-business"
          : undefined;
  const query = new URLSearchParams({ topic, quickStart: topic, goal: "tartalomkészítés" });
  if (platform) query.set("platform", platform);
  return `/app/posts/new?${query}`;
}

function Dashboard() {
  const data = Route.useLoaderData();
  const brand = data.workspace.activeBrand;
  const now = new Date();
  const posts = activeBrandRecords(data.posts, data.workspace.workspace.id, brand?.id).filter(
    (post) => post.variants.some((variant) => variant.content.trim()) || post.media.length > 0,
  );
  const media = activeBrandRecords(data.media, data.workspace.workspace.id, brand?.id);
  const campaigns = activeBrandRecords(data.campaigns, data.workspace.workspace.id, brand?.id);
  const channels = activeBrandRecords(data.channels, data.workspace.workspace.id, brand?.id);
  const weekly = weeklyPlanItems(
    activeBrandRecords(data.planItems, data.workspace.workspace.id, brand?.id),
    now,
  );
  const ready = weekly.filter((item) => hasPlannedPostContent(item, posts));
  const recent = [...posts]
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
    .slice(0, 3);
  const activeCampaigns = campaigns
    .filter((item) => !["completed", "archived"].includes(item.status))
    .slice(0, 3);
  const connectionCount = connectedChannelCount(
    channels.filter((item) => item.provider === "facebook" || item.provider === "instagram"),
  );

  if (!brand)
    return (
      <div className="owner-dashboard">
        <section className="owner-start owner-empty-brand">
          <span className="owner-kicker">
            <WandSparkles className="h-4 w-4" /> A VÁLLALKOZÁSODRA SZABVA
          </span>
          <h1>Kezdjük a vállalkozásoddal.</h1>
          <p>
            Add meg a vállalkozásod nevét és azt, mit kínálsz. Utána saját posztokat és
            tartalomtervet készíthetsz.
          </p>
          <Link to="/app/brand">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Vállalkozás hozzáadása
            </Button>
          </Link>
        </section>
      </div>
    );

  const setupSteps = [
    { to: "/app/brand", label: "Márka", done: Boolean(brand.name) },
    { to: "/app/posts/new", label: "Első poszt", done: posts.length > 0 },
    { to: "/app/channels", label: "Facebook / Instagram kapcsolása", done: connectionCount > 0 },
    { to: "/app/campaigns", label: "Első kampány", done: campaigns.length > 0 },
  ];
  const completedSteps = setupSteps.filter((step) => step.done).length;
  const nextStep = setupSteps.find((step) => !step.done);

  return (
    <div className="owner-dashboard">
      <QuickCreator brandName={brand.name} businessType={brand.profile.businessType} />
      {(!posts.length || !campaigns.length || !connectionCount) && (
        <section className="owner-panel owner-setup" aria-label="Kezdő lépések">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-semibold">Így indulj el</h2>
            <span
              className="owner-setup-counter"
              aria-label={`${completedSteps} lépés kész a 4-ből`}
            >
              {completedSteps}/4 kész
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Következő lépés: {nextStep?.label}. A többi feladathoz később is visszatérhetsz.
          </p>
          <div className="owner-setup-links">
            {setupSteps.map(({ to, label, done }) => (
              <Link
                key={to}
                to={to}
                data-state={done ? "complete" : to === nextStep?.to ? "next" : "pending"}
              >
                <span
                  aria-label={
                    done ? "Kész" : to === nextStep?.to ? "Következő lépés" : "Még hátravan"
                  }
                >
                  {done ? <Check className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
                </span>
                {label}
              </Link>
            ))}
          </div>
          {!connectionCount && (
            <p className="mt-3 text-sm text-muted-foreground">
              Facebookot és Instagramot kapcsolhatsz közvetlen közzétételhez, Meta-jóváhagyással. A
              többi platformra készült szöveget csatlakoztatás nélkül is kimásolhatod.
            </p>
          )}
        </section>
      )}
      {(posts.length > 0 || weekly.length > 0 || connectionCount > 0) && (
        <section className="owner-stats" aria-label="A vállalkozásod valódi adatai">
          <Stat
            icon={FileText}
            title="Ütemezett / közzétett"
            value={posts.filter((post) => ["scheduled", "published"].includes(post.status)).length}
            detail="Időzített és közzétett tartalmak"
            to="/app/posts"
          />
          <Stat
            icon={WandSparkles}
            title="Piszkozatok"
            value={posts.filter((post) => post.status === "draft").length}
            detail="Folytasd a szerkesztést"
            to="/app/posts"
          />
          <Stat
            icon={CalendarDays}
            title="Heti terv"
            value={weekly.length}
            detail={`${ready.length} posztszöveg elkészült`}
            to="/app/planner"
          />
          <Stat
            icon={Radio}
            title="Kapcsolt Meta-csatornák"
            value={connectionCount}
            detail="Ellenőrzött külső kapcsolatok"
            to="/app/channels"
          />
        </section>
      )}
      {weekly.length > 0 && (
        <div className="owner-week-layout">
          <WeeklyRhythm items={weekly} posts={posts} ready={ready.length} />
          <NextAction
            hasProfile={Boolean(
              brand.audience && (brand.products || brand.services || brand.profile.description),
            )}
            hasPost={posts.some((post) => post.variants.some((variant) => variant.content.trim()))}
            items={weekly}
            posts={posts}
          />
        </div>
      )}
      {recent.length > 0 && (
        <section className="owner-panel owner-recent">
          <SectionHead
            title="Legutóbbi posztjaid"
            sub="A mentett szövegek és képek. Innen folytathatod a szerkesztést."
            to="/app/posts"
            action="Összes poszt"
          />
          {recent.length ? (
            <div className="owner-post-grid">
              {recent.map((post) => (
                <article key={post.id} className="owner-post-card">
                  <div className="owner-post-heading">
                    <h3>{post.title}</h3>
                    <Badge variant="secondary">{STATUS_LABELS[post.status] ?? post.status}</Badge>
                  </div>
                  <SocialPreview
                    compact
                    brandName={brand.name}
                    variants={post.variants}
                    media={post.media}
                  />
                  <Link to="/app/posts/$id" params={{ id: post.id }} className="owner-card-link">
                    Szerkesztés és előnézet <ArrowRight className="h-4 w-4" />
                  </Link>
                </article>
              ))}
            </div>
          ) : (
            <Empty
              icon={FileText}
              title="Az első posztod itt fog megjelenni."
              text="Válassz fent egy ötletet, vagy írd le saját szavaiddal, mit szeretnél megosztani."
              to="/app/posts/new"
              action="Első poszt készítése"
            />
          )}
        </section>
      )}
      {activeCampaigns.length > 0 && <Campaigns campaigns={activeCampaigns} />}
      <section className="owner-tools" aria-label="További marketingeszközök">
        {[
          {
            to: "/app/posts/new",
            icon: ImageIcon,
            title: "Képposzt és carousel",
            sub: "Szöveg, saját kép és szerkeszthető grafika együtt.",
          },
          {
            to: "/app/media",
            icon: ImageIcon,
            title: "Saját képeid",
            sub: `${media.length} mentett média. Tölts fel képet a következő poszthoz.`,
          },
          {
            to: "/app/planner",
            icon: CalendarDays,
            title: "30 napos terv",
            sub: "Lásd át a témákat, és készíts posztot a tervedből.",
          },
          {
            to: "/app/analytics",
            icon: Lightbulb,
            title: "Eredmények",
            sub: "Itt látod a posztjaid elérését, amint mérési adat érkezik.",
          },
        ].map(({ to, icon: Icon, title, sub }) => (
          <Link key={title} to={to} className="owner-tool">
            <Icon className="h-5 w-5" />
            <div>
              <strong>{title}</strong>
              <span>{sub}</span>
            </div>
            <ArrowRight className="h-4 w-4" />
          </Link>
        ))}
      </section>
      <details className="owner-settings">
        <summary>
          Vállalkozás és csatornák <span>Profil, weboldal, kapcsolatok</span>
        </summary>
        <div className="owner-settings-grid">
          <div>
            <Globe className="h-5 w-5" />
            <h3>A vállalkozásod profilja</h3>
            <p>
              {brand.website ||
                "Adj meg weboldalt és saját szolgáltatásokat, hogy az AI pontosabban dolgozzon."}
            </p>
            <Link to="/app/brand" className="owner-card-link">
              Márkaprofil megnyitása <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div>
            <Link2 className="h-5 w-5" />
            <h3>Csatornák és publikálás</h3>
            <p>
              {connectionCount
                ? `${connectionCount} ellenőrzött csatornakapcsolat. A publikálás feltételeit a poszt szerkesztőjében ellenőrizheted.`
                : "Még nincs ellenőrzött kapcsolat. A mentett poszt nem jelent automatikus közzétételt."}
            </p>
            <Link to="/app/channels" className="owner-card-link">
              Kapcsolatok kezelése <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </details>
    </div>
  );
}

function QuickCreator({ brandName, businessType }: { brandName: string; businessType?: string }) {
  const [brief, setBrief] = useState("");
  const navigate = useNavigate();
  return (
    <section className="owner-start">
      <span className="owner-kicker">
        <Sparkles className="h-4 w-4" /> KEVESEBB MUNKA. TÖBB JÓ TARTALOM.
      </span>
      <h1>A következő jó posztod itt kezdődik.</h1>
      <p>
        Mit szeretnél megosztani? Írd le pár szóban az ötletedet. A MarketingPilot a{" "}
        <strong>{brandName}</strong> mentett márkahangjával dolgozik.
      </p>
      <form
        className="owner-brief"
        onSubmit={(event) => {
          event.preventDefault();
          if (brief.trim()) void navigate({ to: starterUrl(brief.trim()) });
        }}
      >
        <label htmlFor="dashboard-brief" className="sr-only">
          Milyen tartalmat készítsünk?
        </label>
        <input
          id="dashboard-brief"
          value={brief}
          maxLength={4000}
          onChange={(event) => setBrief(event.target.value)}
          placeholder="Például: szeretném bemutatni az új szolgáltatásunkat…"
        />
        <Button type="submit" disabled={!brief.trim()}>
          <Sparkles className="mr-2 h-4 w-4" />
          Poszt készítése <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </form>
      <div className="owner-starters" aria-label="Vállalkozásodhoz illő gyorsindítók">
        <span>Vagy indulj egy ötletből:</span>
        {businessTypeQuickStarts(businessType).map((topic) => (
          <Link key={topic} to={starterUrl(topic)}>
            + {topic}
          </Link>
        ))}
      </div>
      <div className="owner-business">
        <span>
          <strong>{businessTypeLabel(businessType)}</strong> · a mentett vállalkozásodra szabva
        </span>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          <Link to="/app/brand">
            Márkaprofil szerkesztése <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <Link to="/app/brand" hash="business-type">
            Típus módosítása <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}

function Stat({
  icon: Icon,
  title,
  value,
  detail,
  to,
}: {
  icon: typeof FileText;
  title: string;
  value: number;
  detail: string;
  to: string;
}) {
  return (
    <Link to={to} className="owner-stat">
      <Icon className="h-5 w-5" />
      <span>
        {title}
        <strong>{value}</strong>
        <small>{detail}</small>
      </span>
      <ArrowRight className="h-3.5 w-3.5" />
    </Link>
  );
}

function SectionHead({
  title,
  sub,
  to,
  action,
}: {
  title: string;
  sub: string;
  to: string;
  action: string;
}) {
  return (
    <div className="owner-section-head">
      <div>
        <h2>{title}</h2>
        <p>{sub}</p>
      </div>
      <Link to={to}>
        {action} <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

function Empty({
  icon: Icon,
  title,
  text,
  to,
  action,
}: {
  icon: typeof FileText;
  title: string;
  text: string;
  to: string;
  action: string;
}) {
  return (
    <div className="owner-empty">
      <Icon className="h-6 w-6" />
      <div>
        <h3>{title}</h3>
        <p>{text}</p>
        <Link to={to}>
          {action} <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

function WeeklyRhythm({
  items,
  posts,
  ready,
}: {
  items: PlannerItemSnapshot[];
  posts: DashboardPost[];
  ready: number;
}) {
  return (
    <section className="owner-panel owner-week">
      <SectionHead
        title="A következő 7 napod"
        sub={
          items.length
            ? `${items.length} tervtétel · ${ready} elkészült posztszöveg`
            : "Egy rövid briefből indulhat a heti tartalomterved."
        }
        to="/app/planner"
        action="Teljes terv"
      />
      {items.length ? (
        <div className="owner-week-grid">
          {items.slice(0, 3).map((item) => {
            const post = posts.find((candidate) => candidate.id === item.postId);
            return (
              <Link
                key={item.id}
                to={post ? "/app/posts/$id" : "/app/planner"}
                params={post ? { id: post.id } : undefined}
                className={`owner-plan-card ${post ? "has-post" : ""}`}
              >
                <div>
                  <time>{formatDate(item.date, item.time)}</time>
                  <Badge variant="secondary">
                    {STATUS_LABELS[item.postStatus ?? item.status] ?? "Tervezett"}
                  </Badge>
                </div>
                <h3>{post?.title || item.topic}</h3>
                <p>{item.contentType || "Poszt"}</p>
                <span className="owner-plan-platform">
                  <PlatformMark platform={item.platform} />
                  <span>{post ? "Átnézem a posztot" : "Megnyitom a tervben"}</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </Link>
            );
          })}
        </div>
      ) : (
        <Empty
          icon={CalendarDays}
          title="Még nincs heti tartalomterved."
          text="Mondd el, mit szeretnél népszerűsíteni. Az AI megtervezi a témákat, és segít elkészíteni a posztokat."
          to="/app/campaigns?mode=weekly"
          action="Heti marketing megtervezése"
        />
      )}
      {items.length > 3 && (
        <Link to="/app/calendar" className="owner-week-more">
          Még {items.length - 3} tervtétel · naptár megnyitása <ArrowRight className="h-4 w-4" />
        </Link>
      )}
    </section>
  );
}

function NextAction({
  hasProfile,
  hasPost,
  items,
  posts,
}: {
  hasProfile: boolean;
  hasPost: boolean;
  items: PlannerItemSnapshot[];
  posts: DashboardPost[];
}) {
  const missing = items.find((item) => !hasPlannedPostContent(item, posts));
  const action = !hasProfile
    ? {
        title: "Ismerjük meg a vállalkozásodat",
        text: "Add meg, mit kínálsz és kiknek. Ettől lesznek igazán hozzád illők az AI szövegei.",
        to: "/app/brand",
        cta: "Márkaprofil kiegészítése",
      }
    : !hasPost
      ? {
          title: "Készítsük el az első posztodat",
          text: "Válassz fent egy gyorsötletet, vagy írd le a saját ajánlatodat. A kész szöveget még szerkesztheted.",
          to: "/app/posts/new",
          cta: "Poszt készítése",
        }
      : !items.length
        ? {
            title: "Ne kelljen minden nap ötletelned",
            text: "Egy rövid briefből tervezzük meg a következő heted marketingjét.",
            to: "/app/campaigns?mode=weekly",
            cta: "Készítsd el a heti marketingemet",
          }
        : missing
          ? {
              title: "A következő ötletből legyen poszt",
              text: missing.topic,
              to: "/app/planner",
              cta: "Folytatom a tervet",
            }
          : {
              title: "A heti szövegek elkészültek",
              text: "Nézd át őket, adj hozzá saját képet, és ellenőrizd a közzétételi lehetőségeket.",
              to: "/app/calendar",
              cta: "Átnézem a naptárban",
            };
  return (
    <aside className="owner-next">
      <span className="owner-kicker">
        <Sparkles className="h-4 w-4" /> KÖVETKEZŐ LÉPÉS
      </span>
      <h2>{action.title}</h2>
      <p>{action.text}</p>
      <Link to={action.to}>
        <Button>
          {action.cta} <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </Link>
      <Link to="/app/campaigns" className="owner-next-secondary">
        Kampányok és hosszabb tervek <ArrowRight className="h-4 w-4" />
      </Link>
    </aside>
  );
}

function Campaigns({ campaigns }: { campaigns: CampaignSnapshot[] }) {
  return (
    <section className="owner-panel owner-campaigns">
      <SectionHead
        title="Kampányaid"
        sub="A célból tartalomterv, a tervből mentett posztok."
        to="/app/campaigns"
        action="Összes kampány"
      />
      {campaigns.length ? (
        <div className="owner-campaign-list">
          {campaigns.map((campaign) => {
            const progress = campaign.counts.planned
              ? Math.round((campaign.counts.created / campaign.counts.planned) * 100)
              : 0;
            return (
              <Link
                key={campaign.id}
                to="/app/campaigns/$id"
                params={{ id: campaign.id }}
                className="owner-campaign"
              >
                <span className="owner-campaign-icon">
                  <Megaphone className="h-5 w-5" />
                </span>
                <div>
                  <h3>{campaign.name}</h3>
                  <p>{campaign.objective || "Nyisd meg a kampánybriefet."}</p>
                  <small>
                    {campaign.counts.created}/{campaign.counts.planned} tervtételhez készült poszt ·{" "}
                    {campaign.channels.length} csatorna
                  </small>
                </div>
                <div className="owner-campaign-state">
                  <Badge variant="secondary">
                    {{
                      active: "Aktív",
                      planning: "Tervezés",
                      paused: "Szünetel",
                      draft: "Piszkozat",
                      completed: "Lezárva",
                      archived: "Archiválva",
                    }[campaign.status] ?? campaign.status}
                  </Badge>
                  <span
                    className="owner-progress"
                    role="progressbar"
                    aria-label={`${campaign.name} elkészült posztjai`}
                    aria-valuenow={progress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <i style={{ width: `${progress}%` }} />
                  </span>
                </div>
                <ArrowRight className="h-4 w-4" />
              </Link>
            );
          })}
        </div>
      ) : (
        <Empty
          icon={Megaphone}
          title="Még nincs kampányod."
          text="Adj meg egy célt vagy ajánlatot, és készíts hozzá összefüggő marketingtervet."
          to="/app/campaigns"
          action="Kampány létrehozása"
        />
      )}
      <div className="owner-campaign-note">
        <Check className="h-4 w-4" /> A mentett tervek és posztok újratöltés után is megmaradnak.
      </div>
    </section>
  );
}
