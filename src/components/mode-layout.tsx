import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  FileText,
  CalendarDays,
  Store,
  Image,
  Radio,
  Menu,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { Route } from "@/routes/app";
import { brandForLanguage } from "@/i18n";
import { logoutUser } from "@/lib/auth.functions";
import { UiModeProvider, UiModeSwitch, useUiMode } from "./ui-mode";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "./ui/dropdown-menu";
const simple = [
  { to: "/app", label: "Kezdőlap", icon: LayoutDashboard },
  { to: "/app/posts", label: "Posztjaim", icon: FileText },
  { to: "/app/weekly", label: "Heti terv", icon: CalendarDays },
  { to: "/app/brand", label: "Vállalkozásom", icon: Store },
];
const detailed = [
  simple[0],
  { ...simple[1], label: "Posztok" },
  { ...simple[2], label: "Tervek" },
  { to: "/app/media", label: "Média", icon: Image },
  { to: "/app/channels", label: "Csatornák és eredmények", icon: Radio },
];
export function ModeLayout() {
  const data = Route.useLoaderData();
  return (
    <UiModeProvider initial={data.preferences}>
      <ModeShell />
    </UiModeProvider>
  );
}
function ModeShell() {
  const auth = Route.useLoaderData();
  const brand = brandForLanguage(auth.activeBrand?.languageMarket);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { mode, dismissed, pending, change, dismiss } = useUiMode();
  const [more, setMore] = useState(false);
  const logout = useServerFn(logoutUser);
  const [leaving, setLeaving] = useState(false);
  const nav = mode === "simple" ? simple : detailed;
  const active = (to: string) =>
    to === "/app"
      ? path === to || path === to + "/"
      : to === "/app/weekly"
        ? /^\/app\/(weekly|campaigns|planner|calendar)(\/|$)/.test(path)
        : path === to ||
          path.startsWith(to + "/") ||
          (to === "/app/channels" && path === "/app/analytics");
  const title =
    nav.find((item) => active(item.to))?.label ??
    (path === "/app/brand" ? "Vállalkozásom" : brand.productName);
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    const update = () =>
      setEditing(
        document.activeElement instanceof HTMLTextAreaElement ||
          (document.activeElement instanceof HTMLInputElement &&
            !["checkbox", "radio", "file", "button", "submit"].includes(
              document.activeElement.type,
            )),
      );
    document.addEventListener("focusin", update);
    document.addEventListener("focusout", update);
    return () => {
      document.removeEventListener("focusin", update);
      document.removeEventListener("focusout", update);
    };
  }, []);
  const section = /^\/app\/(weekly|campaigns|planner|calendar)(\/|$)/.test(path)
    ? [
        ["/app/weekly", "Heti terv"],
        ["/app/campaigns", "Kampányok"],
        ["/app/planner", "30 napos terv"],
        ["/app/calendar", "Naptár"],
      ]
    : /^\/app\/(media|images)(\/|$)/.test(path)
      ? [
          ["/app/media", "Médiatár"],
          ["/app/images", "Kép készítése"],
        ]
      : /^\/app\/(channels|analytics)(\/|$)/.test(path)
        ? [
            ["/app/channels", "Csatornák"],
            ["/app/analytics", "Eredmények"],
          ]
        : [];
  return (
    <div
      className="theme-marketingpilot-v2 marketing-workspace min-h-screen bg-secondary/30"
      data-ui-mode={mode}
    >
      <div className="reference-app-shell">
        <aside
          aria-label="Fő navigáció"
          className="reference-sidebar fixed inset-y-0 left-0 hidden flex-col bg-sidebar px-4 py-5 text-sidebar-foreground lg:flex"
        >
          <Link to="/app" className="reference-brand mb-8 flex items-center gap-3 px-2">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary font-serif text-2xl font-bold text-primary-foreground">
              M
            </span>
            <strong>{brand.productName}</strong>
          </Link>
          <nav className="space-y-2">
            {nav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                aria-current={active(item.to) ? "page" : undefined}
                className={`flex min-h-11 items-center gap-3 rounded-xl px-3 py-3 text-base ${active(item.to) ? "bg-sidebar-accent text-white" : "text-sidebar-foreground/80"}`}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="mt-auto pt-5 text-sm text-sidebar-foreground/80">
            <span className="block break-words">
              {auth.activeBrand?.name ?? auth.workspace.name}
            </span>
            <span className="mt-1 block">
              {mode === "simple" ? "Egyszerű nézet" : "Részletes nézet"}
            </span>
          </div>
        </aside>
        <main className="reference-main-column min-w-0 flex-1">
          <header className="reference-header flex items-center justify-between gap-3 px-4 py-3 md:px-9">
            <Link to="/app" className="min-w-0 font-semibold">
              {title}
            </Link>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" aria-label="Fiók és beállítások">
                  <span className="reference-header-avatar">
                    {auth.user.displayName.slice(0, 1).toUpperCase()}
                  </span>
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[min(360px,calc(100vw-24px))] p-3">
                <DropdownMenuLabel>{auth.user.displayName}</DropdownMenuLabel>
                <div className="py-3">
                  <UiModeSwitch />
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/app/brand">Vállalkozásom</Link>
                </DropdownMenuItem>
                {[
                  { hash: "password", label: "Jelszócsere" },
                  { hash: "export", label: "Adatexport" },
                  { hash: "delete-account", label: "Fiók törlése" },
                ].map(({ hash, label }) => (
                  <DropdownMenuItem asChild key={hash}>
                    <Link to="/app/brand" hash={hash}>
                      {label}
                    </Link>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  disabled={leaving}
                  onSelect={(event) => {
                    event.preventDefault();
                    setLeaving(true);
                    void logout()
                      .then(() => window.location.assign("/"))
                      .catch(() => {
                        toast.error("Nem sikerült kijelentkezni. Próbáld újra.");
                        setLeaving(false);
                      });
                  }}
                >
                  {leaving ? "Kilépés…" : "Kijelentkezés"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </header>
          <div className="reference-main p-4 pb-28 md:px-9 lg:pb-10">
            {mode === "detailed" && section.length > 0 && (
              <nav className="workspace-section-nav" aria-label="Kapcsolódó oldalak">
                {section.map(([to, label]) => (
                  <Link key={to} to={to} aria-current={path === to ? "page" : undefined}>
                    {label}
                  </Link>
                ))}
              </nav>
            )}
            {auth.user.emailVerified === false && auth.user.canUseAi !== true && (
              <div
                className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm"
                role="status"
              >
                A posztkészítéshez erősítsd meg az e-mail-címed.{" "}
                <Link to="/verify-email" className="inline-flex min-h-11 items-center underline">
                  Megerősítő levél →
                </Link>
              </div>
            )}
            {mode === "simple" && auth.postCount >= 5 && !dismissed && (
              <div className="mb-4 rounded-xl border bg-card p-4">
                <p>Már otthonosan posztolsz. Szeretnéd látni a további lehetőségeket?</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    disabled={pending}
                    onClick={() => void change("detailed")}
                  >
                    Megnézem a Részletes módot
                  </Button>
                  <Button variant="ghost" disabled={pending} onClick={() => void dismiss()}>
                    Most nem
                  </Button>
                </div>
              </div>
            )}
            <Outlet />
          </div>
        </main>
        {more && (
          <div
            className="fixed inset-0 z-50 flex items-end bg-black/40 lg:hidden"
            onClick={() => setMore(false)}
          >
            <div
              role="dialog"
              aria-label="További oldalak"
              aria-modal="true"
              className="w-full rounded-t-2xl bg-card p-5 pb-10"
              onClick={(e) => e.stopPropagation()}
            >
              <Button variant="ghost" onClick={() => setMore(false)}>
                Bezárás
              </Button>
              {[
                ["/app/channels", "Csatornák"],
                ["/app/analytics", "Eredmények"],
                ["/app/brand", "Vállalkozásom"],
              ].map(([to, label]) => (
                <Link
                  className="flex min-h-11 items-center border-b"
                  key={to}
                  to={to}
                  onClick={() => setMore(false)}
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>
        )}
        <nav
          aria-label="Mobil navigáció"
          data-editing={editing}
          className={`workspace-mobile-nav fixed inset-x-0 bottom-0 z-40 grid ${mode === "simple" ? "grid-cols-4" : "grid-cols-5"} border-t bg-card p-2 lg:hidden`}
        >
          {(mode === "simple" ? nav : nav.slice(0, 4)).map((item) => (
            <Link
              key={item.to}
              to={item.to}
              aria-label={item.label}
              aria-current={active(item.to) ? "page" : undefined}
              className={`flex min-h-11 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-semibold ${active(item.to) ? "bg-brand-soft text-primary" : "text-muted-foreground"}`}
            >
              <item.icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          ))}
          {mode === "detailed" && (
            <button
              className="flex min-h-11 flex-col items-center justify-center gap-1 text-[11px] font-semibold"
              onClick={() => setMore(true)}
            >
              <Menu className="h-4 w-4" />
              Több
            </button>
          )}
        </nav>
      </div>
    </div>
  );
}
