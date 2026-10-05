import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { requireCurrentUser, logoutUser } from "@/lib/auth.functions";
import { getThemePreference } from "@/lib/theme.functions";
import { getChannelConnections } from "@/lib/channel.functions";
import { activeBrandRecords, connectedChannelCount } from "@/lib/dashboard";
import {
  LayoutDashboard,
  Calendar,
  Sparkles,
  Image as ImageIcon,
  WandSparkles,
  BarChart3,
  Plus,
  Radio,
  Megaphone,
  Search,
  Settings,
  LogOut,
  ChevronDown,
  Menu,
  X,
  ListChecks,
  FileText,
  Lightbulb,
  Wallet,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import "@/workspace.css";

export const Route = createFileRoute("/app")({
  beforeLoad: () => requireCurrentUser(),
  loader: async () => {
    const [auth, themePreference, channels] = await Promise.all([
      requireCurrentUser(),
      getThemePreference(),
      getChannelConnections(),
    ]);
    return { ...auth, themePreference, channels };
  },
  head: () => ({
    meta: [
      { title: "Dashboard — MarketingPilot AI" },
      {
        name: "description",
        content: "AI Marketing Operációs Rendszer — mai teendők, kampányok és tartalomnaptár.",
      },
    ],
  }),
  component: AppLayout,
});

type NavItem = {
  to: string;
  params?: { id: string };
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
  activePrefixes?: string[];
};

const NAV_GROUPS: Array<{ label: string; items: NavItem[] }> = [
  {
    label: "MUNKATÉR",
    items: [{ to: "/app", label: "Áttekintés", icon: LayoutDashboard, exact: true }],
  },
  {
    label: "TARTALOM",
    items: [
      {
        to: "/app/posts/$id",
        params: { id: "new" },
        label: "Posztkészítő",
        icon: Sparkles,
        activePrefixes: ["/app/posts/"],
      },
      { to: "/app/posts", label: "Posztok", icon: FileText, exact: true },
      { to: "/app/media", label: "Médiatár", icon: ImageIcon },
    ],
  },
  {
    label: "TERVEZÉS",
    items: [
      { to: "/app/campaigns", label: "Kampányok", icon: Megaphone },
      { to: "/app/planner", label: "30 napos terv", icon: ListChecks },
      { to: "/app/calendar", label: "Naptár", icon: Calendar },
    ],
  },
  {
    label: "MÁRKA & AI",
    items: [
      { to: "/app/brand", label: "Márka AI", icon: WandSparkles },
      { to: "/app/images", label: "AI képek", icon: ImageIcon },
      { to: "/app/ideas", label: "Tartalomötletek", icon: Lightbulb },
      { to: "/app/recommendations", label: "AI ajánlások", icon: Lightbulb },
      { to: "/app/analytics", label: "Eredmények", icon: BarChart3 },
      {
        to: "/app/channels",
        label: "Csatornák",
        icon: Radio,
        activePrefixes: ["/app/channels", "/app/content"],
      },
    ],
  },
];

function AppLayout() {
  const auth = Route.useLoaderData();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const connectedChannels = connectedChannelCount(
    activeBrandRecords(auth.channels, auth.workspace.id, auth.activeBrand?.id),
  );
  const isActive = (to: string, exact?: boolean, activePrefixes?: string[]) => {
    if (exact) return path === to;
    return (activePrefixes ?? [to]).some((prefix) =>
      prefix.endsWith("/")
        ? path.startsWith(prefix)
        : path === prefix || path.startsWith(prefix + "/"),
    );
  };

  return (
    <div
      className={`theme-${auth.themePreference ?? "marketingpilot-v2"} marketing-workspace min-h-screen bg-secondary/30`}
    >
      <div className="reference-app-shell">
        <aside className="reference-sidebar fixed inset-y-0 left-0 hidden shrink-0 flex-col border-r border-sidebar-border bg-sidebar px-4 py-5 text-sidebar-foreground md:flex">
          <Link to="/app" className="reference-brand mb-8 flex items-center gap-3 px-2">
            <div className="grid h-12 w-12 place-items-center rounded-[11px] bg-primary text-primary-foreground font-serif text-2xl font-bold shadow-lg shadow-primary/20">
              M
            </div>
            <div>
              <span className="block font-display text-[19px] font-extrabold tracking-tight">
                MarketingPilot<span className="workspace-version">V2</span>
              </span>
              <span className="block text-[13px] text-sidebar-foreground/70">
                A márkád. Egy helyen.
              </span>
            </div>
          </Link>
          {NAV_GROUPS.map((group) => (
            <div key={group.label || "primary"} className="mb-5">
              {group.label && <SectionLabel>{group.label}</SectionLabel>}
              <NavSection items={group.items} isActive={isActive} />
            </div>
          ))}
          <div className="reference-side-plan mt-auto rounded-2xl px-4 py-4 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-sidebar-foreground/70">Csatornák</span>
              <strong className="text-sm text-sidebar-foreground">{connectedChannels}/6</strong>
            </div>
            <div className="reference-side-progress mt-3">
              <span style={{ width: `${(connectedChannels / 6) * 100}%` }} />
            </div>
            <Link
              to="/app/channels"
              className="mt-3 inline-block text-[12px] font-bold text-primary"
            >
              Kapcsolatok kezelése →
            </Link>
          </div>
          <Link
            to="/app/brand"
            className="reference-brand-switcher mt-4 flex items-center gap-3 rounded-2xl px-3 py-3"
          >
            <span className="reference-brand-avatar">
              {(auth.activeBrand?.name ?? auth.workspace.name).slice(0, 1).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <strong className="block truncate text-sm text-sidebar-foreground">
                {auth.activeBrand?.name ?? auth.workspace.name}
              </strong>
              <small className="block truncate text-[11px] text-sidebar-foreground/60">
                Vállalkozás
              </small>
            </span>
            <ChevronDown className="h-4 w-4 text-sidebar-foreground/60" />
          </Link>
          <div className="reference-profile mt-4 border-t border-sidebar-border pt-4 text-xs text-sidebar-foreground/60">
            <div className="workspace-system-links">
              <Link to="/app/subscription" title="Előfizetés">
                <Wallet className="h-3.5 w-3.5" />
                <span>Előfizetés</span>
              </Link>
              {auth.membership.role === "owner" || auth.membership.role === "admin" ? (
                <Link to="/app/admin" title="Admin">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>Admin</span>
                </Link>
              ) : null}
            </div>
            <div className="flex items-center gap-3 px-1">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sidebar-accent text-sm font-semibold text-sidebar-accent-foreground">
                {auth.user.displayName.slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="truncate font-semibold text-sidebar-foreground">
                  {auth.user.displayName}
                </div>
                <div className="truncate text-[11px] text-sidebar-foreground/55">
                  {auth.user.email}
                </div>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between gap-2 px-1">
              <Link to="/app/settings" className="reference-sidebar-action">
                <Settings className="h-4 w-4" />
                Beállítások
              </Link>
              <LogoutButton />
            </div>
          </div>
        </aside>

        <main className="reference-main-column min-w-0 flex-1">
          <header className="reference-header flex items-center justify-between gap-3 px-4 py-4 md:px-9">
            <div className="reference-header-inner">
              <div>
                {path === "/app" || path === "/app/" ? (
                  <>
                    <p className="reference-eyebrow">A TE MARKETINGKÖZPONTOD</p>
                    <h2 className="reference-greeting">
                      Szia, {auth.user.displayName.split(" ")[0]}!{" "}
                      <span className="workspace-greeting-dot" />
                    </h2>
                    <p className="reference-greeting-sub">
                      Egy jó ötletből legyen következő lépés.
                    </p>
                  </>
                ) : (
                  <div className="workspace-breadcrumb">
                    <Link to="/app">Munkatér</Link>
                    <span>/</span>
                    <strong>
                      {NAV_GROUPS.flatMap((group) => group.items).find((item) =>
                        isActive(item.to, item.exact, item.activePrefixes),
                      )?.label ??
                        {
                          "/app/settings": "Beállítások",
                          "/app/subscription": "Előfizetés",
                          "/app/admin": "Admin",
                        }[path] ??
                        "Munkatér"}
                    </strong>
                  </div>
                )}
              </div>
              <div className="reference-header-actions">
                <Button
                  size="icon"
                  variant="outline"
                  className="reference-icon-button rounded-xl md:hidden"
                  aria-label="Menü megnyitása"
                  onClick={() => setMobileMenuOpen(true)}
                >
                  <Menu className="h-4 w-4" />
                </Button>
                <Link to="/app/posts" className="reference-search hidden md:flex">
                  <Search className="h-4 w-4" />
                  <span>Posztok keresése</span>
                </Link>
                <Button
                  asChild
                  size="icon"
                  variant="outline"
                  className="reference-icon-button hidden rounded-xl md:inline-flex"
                >
                  <Link to="/app/settings" aria-label="Beállítások" title="Beállítások">
                    <Settings className="h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  size="icon"
                  variant="outline"
                  className="reference-icon-button hidden rounded-xl md:inline-flex"
                >
                  <Link
                    to="/app/brand"
                    aria-label="Brand Voice beállítások"
                    title="Brand Voice beállítások"
                  >
                    <WandSparkles className="h-4 w-4" />
                  </Link>
                </Button>
                <Link
                  to="/app/brand"
                  className="reference-header-profile hidden items-center gap-2 lg:flex"
                  aria-label="Aktív márka beállításai"
                >
                  <span className="reference-header-avatar">
                    {auth.user.displayName.slice(0, 1).toUpperCase()}
                  </span>
                  <span>
                    <strong className="block text-sm">{auth.user.displayName.split(" ")[0]}</strong>
                    <small className="block text-[11px] text-muted-foreground">
                      {auth.activeBrand?.name ?? auth.workspace.name}
                    </small>
                  </span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </Link>
                <Link to="/app/posts/$id" params={{ id: "new" }}>
                  <Button size="sm" className="reference-new-post rounded-xl">
                    <Plus className="mr-1 h-4 w-4" />
                    Új poszt
                  </Button>
                </Link>
              </div>
            </div>
          </header>
          <div className="reference-main p-4 pb-20 md:px-9 md:pb-10">
            <Outlet />
          </div>
        </main>
        {mobileMenuOpen && (
          <MobileDrawer
            isActive={isActive}
            canAdmin={auth.membership.role === "owner" || auth.membership.role === "admin"}
            onClose={() => setMobileMenuOpen(false)}
          />
        )}
        <MobileNav isActive={isActive} />
      </div>
    </div>
  );
}

function LogoutButton() {
  const logout = useServerFn(logoutUser);
  async function handleLogout() {
    try {
      await logout();
    } finally {
      window.location.assign("/login");
    }
  }
  return (
    <Button
      size="sm"
      variant="ghost"
      className="reference-sidebar-action rounded-lg"
      aria-label="Kijelentkezés"
      title="Kijelentkezés"
      onClick={() => void handleLogout()}
    >
      <LogOut className="h-4 w-4" />
      Kijelentkezés
    </Button>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/50">
      {children}
    </div>
  );
}
function NavSection({
  items,
  isActive,
  onNavigate,
}: {
  items: NavItem[];
  isActive: (to: string, exact?: boolean, activePrefixes?: string[]) => boolean;
  onNavigate?: () => void;
}) {
  return (
    <nav className="space-y-1">
      {items.map((n) => (
        <Link
          key={n.to}
          to={n.to}
          params={n.params}
          title={n.label}
          aria-label={n.label}
          onClick={onNavigate}
          className={`group flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm transition ${
            isActive(n.to, n.exact, n.activePrefixes)
              ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium shadow-sm"
              : "text-sidebar-foreground/75 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground"
          }`}
        >
          <n.icon className="h-4 w-4 opacity-80 transition group-hover:opacity-100" />
          <span>{n.label}</span>
        </Link>
      ))}
    </nav>
  );
}

function MobileDrawer({
  isActive,
  canAdmin,
  onClose,
}: {
  isActive: (to: string, exact?: boolean, activePrefixes?: string[]) => boolean;
  canAdmin: boolean;
  onClose: () => void;
}) {
  return (
    <>
      <button
        type="button"
        aria-label="Menü bezárása"
        className="reference-mobile-drawer-backdrop md:hidden"
        onClick={onClose}
      />
      <aside className="reference-mobile-drawer md:hidden" aria-label="Mobil navigáció">
        <div className="flex items-center justify-between">
          <Link to="/app" className="reference-brand flex items-center gap-3" onClick={onClose}>
            <div className="grid h-11 w-11 place-items-center rounded-[11px] bg-primary text-primary-foreground font-serif text-2xl font-bold">
              M
            </div>
            <div>
              <span className="block font-display text-[17px] font-extrabold uppercase tracking-tight">
                MarketingPilot
              </span>
              <span className="block text-[11px] uppercase tracking-[0.08em] text-sidebar-foreground/70">
                AI marketing-munkatér
              </span>
            </div>
          </Link>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="reference-mobile-drawer-close"
            aria-label="Menü bezárása"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="workspace-mobile-groups mt-8 space-y-3">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <SectionLabel>{group.label}</SectionLabel>
              <NavSection items={group.items} isActive={isActive} onNavigate={onClose} />
            </div>
          ))}
        </div>
        <div className="mt-auto border-t border-sidebar-border pt-5 text-sm text-sidebar-foreground/70">
          <div className="workspace-system-links">
            <Link to="/app/subscription" onClick={onClose}>
              Előfizetés
            </Link>
            {canAdmin && (
              <Link to="/app/admin" onClick={onClose}>
                Admin
              </Link>
            )}
          </div>
          <Link to="/app/settings" onClick={onClose} className="reference-mobile-drawer-action">
            <Settings className="h-4 w-4" />
            Beállítások
          </Link>
          <LogoutButton />
        </div>
      </aside>
    </>
  );
}

function MobileNav({
  isActive,
}: {
  isActive: (to: string, exact?: boolean, activePrefixes?: string[]) => boolean;
}) {
  const items: NavItem[] = [
    { to: "/app", label: "Áttekintés", icon: LayoutDashboard, exact: true },
    {
      to: "/app/posts/$id",
      params: { id: "new" },
      label: "Poszt",
      icon: Sparkles,
      activePrefixes: ["/app/posts/"],
    },
    { to: "/app/posts", label: "Posztok", icon: LayoutDashboard, exact: true },
    { to: "/app/calendar", label: "Naptár", icon: Calendar },
    { to: "/app/brand", label: "Márka", icon: WandSparkles },
  ];
  return (
    <nav
      aria-label="Mobil navigáció"
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-border bg-card/95 p-2 shadow-[0_-8px_30px_rgba(44,35,90,.08)] backdrop-blur md:hidden"
    >
      {items.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          params={item.params}
          className={`flex flex-col items-center gap-1 rounded-xl px-1 py-2 text-[10px] font-semibold ${isActive(item.to, item.exact, item.activePrefixes) ? "bg-brand-soft text-primary" : "text-muted-foreground"}`}
        >
          <item.icon className="h-4 w-4" />
          <span>{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}
