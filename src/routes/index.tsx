import { redirectSignedInUser } from "@/lib/guest-route";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  Sparkles, Calendar, Wand2, Image as ImageIcon, Palette, LineChart,
  Facebook, Instagram, Music2, Globe, FileText, Mail, ArrowRight, Check, Clock,
  Zap, ThumbsUp, BarChart3,
} from "lucide-react";

export const Route = createFileRoute("/")({ beforeLoad: redirectSignedInUser,
  head: () => ({
    meta: [
      { title: "MarketingPilot AI — A marketingesed, aki minden nap dolgozik helyetted" },
      { name: "description", content: "Készíts teljes havi marketingkampányokat mesterséges intelligenciával néhány perc alatt — kisvállalkozásoknak." },
      { property: "og:title", content: "MarketingPilot AI" },
      { property: "og:description", content: "AI Marketing Operációs Rendszer kisvállalkozásoknak: 30 napos terv, kampánygenerátor, tartalomnaptár." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="theme-marketingpilot-v2 public-site min-h-screen bg-background">
      <Nav />
      <Hero />
      <Ticker />
      <Features />
      <Channels />
      <Pricing />
      <CTA />
      <Footer />
    </div>
  );
}

function Nav() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
        <Link to="/" className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-xl gradient-brand font-bold text-primary-foreground">M</div>
          <span className="font-display text-base font-bold tracking-tight">MarketingPilot</span>
        </Link>
        <nav className="hidden gap-6 text-sm font-medium md:flex">
          <a href="#features" className="text-muted-foreground hover:text-foreground">Funkciók</a>
          <a href="#channels" className="text-muted-foreground hover:text-foreground">Csatornák</a>
          <a href="#pricing" className="text-muted-foreground hover:text-foreground">Árak</a>
        </nav>
        <div className="flex items-center gap-2">
          <Link to="/login"><Button variant="ghost" size="sm" className="rounded-full">Belépés</Button></Link>
          <Link to="/signup">
            <Button size="sm" className="rounded-full shadow-md shadow-primary/15">
              Ingyenes próba
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden gradient-hero">
      <div className="mx-auto max-w-6xl px-5 py-16 md:py-28">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-sm font-medium text-primary shadow-sm">
            <Sparkles className="h-4 w-4" /> AI Marketing Operációs Rendszer
          </div>
          <h1 className="mt-6 font-display text-4xl font-extrabold tracking-tight text-foreground md:text-6xl lg:text-7xl text-balance">
            A marketingesed, aki minden nap{" "}
            <span className="gradient-text">dolgozik helyetted.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground leading-relaxed">
            Készíts teljes havi marketingkampányokat mesterséges intelligenciával néhány perc alatt.
            Posztok, kampányok, képek, naptár — egy helyen.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link to="/signup">
              <Button size="lg" className="h-12 rounded-full px-8 shadow-lg shadow-primary/20">
                Ingyenes kipróbálás <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/login">
              <Button size="lg" variant="outline" className="h-12 rounded-full px-8">
                Belépés
              </Button>
            </Link>
          </div>
        </div>

        <div className="mt-14 md:mt-20 flex justify-center">
          <div className="relative w-full max-w-4xl overflow-hidden rounded-[2.5rem] border border-border bg-card shadow-elevated">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent"></div>
            <div className="flex">
              <div className="hidden w-14 flex-col items-center gap-4 border-r border-border py-6 sm:flex">
                <div className="h-8 w-8 rounded-xl bg-primary/10"></div>
                <div className="h-8 w-8 rounded-xl bg-secondary"></div>
                <div className="h-8 w-8 rounded-xl bg-secondary"></div>
                <div className="h-8 w-8 rounded-xl bg-secondary"></div>
              </div>
              <div className="flex-1 p-5 md:p-7">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Május 2026</div>
                    <div className="mt-1 font-display text-lg font-bold text-foreground">30 napos marketing terv</div>
                  </div>
                  <div className="flex gap-2">
                    <div className="h-8 rounded-full bg-secondary px-3 text-xs font-medium leading-8 text-foreground">Hét</div>
                    <div className="h-8 rounded-full bg-primary px-3 text-xs font-medium leading-8 text-primary-foreground">Hónap</div>
                  </div>
                </div>
                <div className="mt-5 grid grid-cols-7 gap-2">
                  {["H","K","Sze","Cs","P","Szo","V"].map((d) => (
                    <div key={d} className="text-center text-xs font-semibold text-muted-foreground">{d}</div>
                  ))}
                  {Array.from({ length: 14 }).map((_, i) => {
                    const day = i + 1;
                    const active = [3, 5, 7, 10, 12].includes(day);
                    return (
                      <div key={day} className={`relative aspect-square rounded-xl text-center text-sm leading-[2.2rem] ${active ? "bg-primary/10 font-semibold text-primary" : "bg-secondary text-foreground"}`}>
                        {day}
                        {active && <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-primary"></span>}
                      </div>
                    );
                  })}
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-border bg-secondary/50 p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <Instagram className="h-4 w-4 text-primary" /> Instagram poszt
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">„Nyári kollekció érkezik! 🌞”</div>
                  </div>
                  <div className="rounded-2xl border border-border bg-secondary/50 p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <FileText className="h-4 w-4 text-chart-3" /> Blog cikk
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">„5 tipp a szezonális kampányhoz”</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Ticker() {
  const items = ["30 NAPOS TERV", "KAMPÁNYGENERÁTOR", "AI KÉPEK", "MÁRKAMEMÓRIA", "TARTALOMNAPTÁR", "ANALITIKA"];
  return (
    <div className="overflow-hidden bg-inverse py-3 text-inverse-foreground">
      <div className="flex w-max marquee-track">
        {[0, 1].map((k) => (
          <div key={k} className="flex shrink-0">
            {items.map((i) => (
              <span key={`${k}-${i}`} className="px-8 font-display text-xs font-bold tracking-widest opacity-80">
                {i} <span className="text-primary">✦</span>
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function Features() {
  const items = [
    { icon: Calendar, t: "30 napos terv", d: "Minden napra kész tartalom, minden csatornára. Te csak jóváhagyod." },
    { icon: Wand2, t: "Kampánygenerátor", d: "„Karácsony” → 10 FB, 10 IG, 10 TikTok poszt, blog és hírlevél." },
    { icon: Palette, t: "Márkaközpont", d: "Logó, színek, hangnem, termékek — a rendszer örökre megjegyzi." },
    { icon: ImageIcon, t: "AI képek", d: "Márkahű vizuálok posztokhoz, Storykhoz és hirdetésekhez." },
    { icon: Sparkles, t: "AI ajánlások", d: "Időjárás, ünnepek és szezon alapján javasol tartalmat." },
    { icon: LineChart, t: "Analitika", d: "Mi működik, mi nem — érthető számokban, nem táblázatokban." },
  ];
  return (
    <section id="features" className="py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-5">
        <div className="text-center mb-12">
          <h2 className="font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Minden, amit a marketinghez kell.
          </h2>
          <p className="mt-3 text-muted-foreground">Egyetlen rendszerben tervezel, készítesz, időzítesz és mérhetsz.</p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((f) => (
            <div key={f.t} className="hard-lift p-6">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/10 text-primary">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-display text-lg font-bold text-foreground">{f.t}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Channels() {
  const chs = [
    { icon: Facebook, label: "Facebook" },
    { icon: Instagram, label: "Instagram" },
    { icon: Music2, label: "TikTok" },
    { icon: Globe, label: "Google" },
    { icon: FileText, label: "Blog" },
    { icon: Mail, label: "Hírlevél" },
  ];
  return (
    <section id="channels" className="border-y border-border bg-secondary/50">
      <div className="mx-auto max-w-6xl px-5 py-10">
        <div className="flex flex-wrap items-center justify-center gap-3">
          {chs.map((c) => (
            <div key={c.label} className="flex items-center gap-2 rounded-full border border-border bg-card px-5 py-2.5 shadow-sm">
              <c.icon className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground">{c.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  const tiers = [
    { name: "Free", price: "0 RON", sub: "Mindörökre", features: ["5 poszt/hó", "1 csatorna", "Alap AI szöveg", "Márka beállítások"] },
    { name: "Starter", price: "99 RON", sub: "havonta", features: ["50 poszt/hó", "3 csatorna", "AI képgenerálás", "Email támogatás"] },
    { name: "Pro", price: "249 RON", sub: "havonta", features: ["Korlátlan poszt", "Minden csatorna", "30 napos AI terv", "Időzítés & analitika"], featured: true },
    { name: "Business", price: "599 RON", sub: "havonta", features: ["5+ felhasználó", "Több márka", "API & webhook", "Dedikált támogatás"] },
  ];
  return (
    <section id="pricing" className="relative overflow-hidden py-16 md:py-24">
      <div className="absolute inset-0 -z-10 bg-secondary/50" />
      <div className="mx-auto max-w-6xl px-5">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-semibold text-primary">
            <Zap className="h-4 w-4" /> Árak
          </div>
          <h2 className="mt-4 font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">Egyszerű, kiszámítható árak.</h2>
          <p className="mt-3 text-muted-foreground max-w-lg mx-auto">Válaszd ki a vállalkozásodhoz illő csomagot. Bármikor válthatsz vagy lemondhatsz.</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {tiers.map((t) => (
            <div
              key={t.name}
              className={`relative flex flex-col rounded-[2.5rem] border bg-card p-6 shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-elevated ${
                t.featured ? "border-primary/40 ring-2 ring-primary/20" : "border-border"
              }`}
            >
              {t.featured && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-4 py-1 text-xs font-bold text-primary-foreground shadow-md">
                  Legnépszerűbb
                </div>
              )}
              <div className="text-center">
                <div className="text-sm font-bold uppercase tracking-wider text-muted-foreground">{t.name}</div>
                <div className="mx-auto mt-4 grid h-24 w-24 place-items-center rounded-full bg-gradient-to-br from-primary/20 to-primary/5">
                  <div>
                    <div className="font-display text-2xl font-extrabold text-foreground leading-none">{t.price}</div>
                    <div className={`text-[10px] font-medium ${t.featured ? "text-primary" : "text-muted-foreground"}`}>{t.sub}</div>
                  </div>
                </div>
              </div>
              <ul className="mt-6 space-y-3 text-sm flex-1">
                {t.features.map((f) => (
                  <li key={f} className="flex items-center gap-3">
                    <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full ${t.featured ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"}`}>
                      <Check className="h-3 w-3" />
                    </span>
                    <span className="text-foreground/90">{f}</span>
                  </li>
                ))}
              </ul>
                <Link to="/signup" className="mt-6 block">
                <Button className="h-11 w-full rounded-full" variant={t.featured ? "default" : "outline"}>
                  Kezdés
                </Button>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section className="py-8 md:py-12">
      <div className="mx-auto max-w-6xl px-5">
        <div className="relative overflow-hidden rounded-[2.5rem] gradient-brand p-10 md:p-16 text-center text-primary-foreground shadow-elevated">
          <div className="relative z-10 mx-auto max-w-2xl">
            <h2 className="font-display text-3xl font-bold tracking-tight md:text-5xl">
              Töltsd fel a márkádat 3 perc alatt.
            </h2>
            <p className="mt-4 text-primary-foreground/80">Hozd létre a munkateredet, majd építsd fel a márkád valódi adatait.</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link to="/signup">
                <Button size="lg" className="h-12 rounded-full bg-primary-foreground text-primary px-8 shadow-lg hover:bg-primary-foreground/90">
                  Ingyen indítás
                </Button>
              </Link>
              <Link to="/login">
                <Button size="lg" variant="outline" className="h-12 rounded-full border-primary-foreground/30 bg-transparent text-primary-foreground px-8 hover:bg-primary-foreground/10">
                  Belépés
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 py-8 text-sm text-muted-foreground md:flex-row">
        <div className="flex items-center gap-2">
          <div className="grid h-6 w-6 place-items-center rounded-lg gradient-brand text-xs font-bold text-primary-foreground">M</div>
          MarketingPilot AI © 2026
        </div>
        <div className="flex gap-5">
          <a href="#" className="hover:text-foreground">Adatvédelem</a>
          <a href="#" className="hover:text-foreground">ÁSZF</a>
          <a href="#" className="hover:text-foreground">Kapcsolat</a>
        </div>
      </div>
    </footer>
  );
}
