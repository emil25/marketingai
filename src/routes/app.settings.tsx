import { useState } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/app-chrome";
import { getThemePreference, setThemePreference } from "@/lib/theme.functions";
import { Check, LayoutDashboard, Palette, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/settings")({
  loader: () => getThemePreference(),
  component: SettingsPage,
});

type ThemePreference = "marketingpilot-v2" | "postmaster" | "marketingpilot";

const THEMES: Array<{
  id: ThemePreference;
  name: string;
  description: string;
  accent: string;
  surface: string;
  sidebar: string;
}> = [
  {
    id: "marketingpilot-v2",
    name: "MarketingPilot munkatér",
    description: "A végleges MarketingPilot felület a valódi kampány-, poszt- és AI-adatokhoz.",
    accent: "bg-[#e86448]",
    surface: "bg-[#f5f4ef]",
    sidebar: "bg-[#112b23]",
  },
];

function SettingsPage() {
  const selectedTheme = Route.useLoaderData() as ThemePreference;
  const [theme, setTheme] = useState<ThemePreference>(selectedTheme);
  const save = useServerFn(setThemePreference);
  const router = useRouter();

  async function choose(nextTheme: ThemePreference) {
    if (nextTheme === theme) return;
    try {
      await save({ data: { theme: nextTheme } });
      setTheme(nextTheme);
      await router.invalidate();
      const label = THEMES.find((item) => item.id === nextTheme)?.name ?? "MarketingPilot";
      toast.success(`${label} design aktiválva.`);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Nem sikerült menteni a megjelenést.");
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Beállítások"
        sub="A saját MarketingPilot munkatered megjelenése."
        action={
          <Link to="/app">
            <Button variant="outline" className="rounded-full">
              Vissza az áttekintéshez
            </Button>
          </Link>
        }
      />
      <section
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
        aria-label="Vállalkozás és munkatér beállításai"
      >
        {[
          {
            to: "/app/brand",
            title: "Vállalkozás és márkahang",
            text: "Profil, vállalkozástípus és Brand Voice.",
          },
          {
            to: "/app/channels",
            title: "Csatornák",
            text: "Facebook, Instagram és a kapcsolataid.",
          },
          {
            to: "/app/analytics",
            title: "Eredmények",
            text: "Valódi teljesítményadatok, ha rendelkezésre állnak.",
          },
          {
            to: "/app/recommendations",
            title: "Következő lépések",
            text: "A márkádhoz tartozó következő lépések.",
          },
          {
            to: "/app/subscription",
            title: "Előfizetés",
            text: "A csomagod és a használati korlátok.",
          },
        ].map(({ to, title, text }) => (
          <Link key={to} to={to} className="rounded-2xl border bg-card p-5">
            <strong>{title}</strong>
            <p className="mt-2 text-sm text-muted-foreground">{text}</p>
          </Link>
        ))}
      </section>
      <section className="max-w-5xl">
        <div className="mb-5 flex items-start gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-brand-soft text-brand">
            <Palette className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-2xl font-bold tracking-tight">Megjelenés</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Egységes, világos munkatér, karakteres zöld oldalsávval és korall akciógombokkal.
            </p>
          </div>
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          {THEMES.map((item) => {
            const active = theme === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => void choose(item.id)}
                className={`group text-left transition ${active ? "ring-2 ring-primary ring-offset-4 ring-offset-background" : "hover:-translate-y-1"}`}
              >
                <Card className="h-full overflow-hidden rounded-3xl border-0 p-0 shadow-sm ring-1 ring-border">
                  <div className={`${item.surface} p-4`}>
                    <div className="flex h-36 overflow-hidden rounded-2xl shadow-sm ring-1 ring-black/5">
                      <div className={`${item.sidebar} w-1/3 p-3`}>
                        <div className="flex items-center gap-1.5">
                          <span className={`h-4 w-4 rounded-md ${item.accent}`} />
                          <span className="h-2 w-16 rounded-full bg-white/60" />
                        </div>
                        <div className="mt-5 space-y-2">
                          <span className="block h-2 w-20 rounded-full bg-white/35" />
                          <span className="block h-2 w-16 rounded-full bg-white/20" />
                          <span className="block h-2 w-24 rounded-full bg-white/20" />
                        </div>
                      </div>
                      <div className="flex-1 bg-white/80 p-3">
                        <div className="flex items-center justify-between">
                          <span className="h-2 w-28 rounded-full bg-black/15" />
                          <span className={`h-5 w-12 rounded-full ${item.accent} opacity-90`} />
                        </div>
                        <div className="mt-5 grid grid-cols-2 gap-2">
                          <span className="h-14 rounded-xl bg-black/5" />
                          <span className="h-14 rounded-xl bg-black/5" />
                        </div>
                        <span className="mt-3 block h-2 w-32 rounded-full bg-black/10" />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start justify-between gap-4 p-5">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{item.name}</h3>
                        {item.id === "marketingpilot-v2" && (
                          <Badge variant="secondary" className="rounded-full text-[10px]">
                            Alapértelmezett
                          </Badge>
                        )}
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                        {item.description}
                      </p>
                    </div>
                    <span
                      className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border ${active ? "border-primary bg-primary text-primary-foreground" : "border-border text-transparent"}`}
                    >
                      {active ? <Check className="h-4 w-4" /> : null}
                    </span>
                  </div>
                </Card>
              </button>
            );
          })}
        </div>
      </section>
      <Card className="max-w-5xl rounded-3xl border-0 bg-brand-soft/60 p-5 shadow-none ring-1 ring-border">
        <div className="flex items-start gap-3">
          <LayoutDashboard className="mt-0.5 h-5 w-5 text-brand" />
          <div>
            <h3 className="font-semibold">Egy MarketingPilot, közös valódi adatokkal</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              A megjelenés váltása csak a felületet érinti. A kampányok, posztok, tervtételek,
              AI-jobok és mentések közösek maradnak.
            </p>
          </div>
          <Sparkles className="ml-auto hidden h-5 w-5 text-brand sm:block" />
        </div>
      </Card>
    </div>
  );
}
