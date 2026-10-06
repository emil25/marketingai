import { redirectSignedInUser } from "@/lib/guest-route";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { PublicInfoLinks } from "@/components/public-info-page";
import {
  Sparkles,
  Calendar,
  Wand2,
  Image as ImageIcon,
  Palette,
  Facebook,
  Instagram,
  Music2,
  Globe,
  Linkedin,
  ArrowRight,
  Check,
  Clock,
  Copy,
  Send,
  ShieldCheck,
} from "lucide-react";

const SITE_URL = "https://marketingai-self.vercel.app";
export const Route = createFileRoute("/")({
  beforeLoad: redirectSignedInUser,
  head: () => ({
    meta: [
      { title: "MarketingPilot — AI marketing-munkatér kisvállalkozásoknak" },
      {
        name: "description",
        content:
          "Egy rövid ötletből szerkeszthető posztok, saját márkahang és 30 napos tartalomterv. Ismerd meg a MarketingPilot díjmentes bétáját.",
      },
      { property: "og:title", content: "MarketingPilot — A márkád. Egy helyen." },
      {
        property: "og:description",
        content:
          "Valódi termékelőnézet: AI posztkészítő, platformváltozatok, kampányok és tartalomnaptár kisvállalkozásoknak.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: SITE_URL },
      { property: "og:image", content: `${SITE_URL}/images/marketingpilot-share.png` },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      {
        property: "og:image:alt",
        content: "MarketingPilot: AI posztkészítő, márkahang és tartalomterv",
      },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: `${SITE_URL}/images/marketingpilot-share.png` },
    ],
    links: [{ rel: "canonical", href: SITE_URL }],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="theme-marketingpilot-v2 public-site min-h-screen bg-background text-foreground">
      <Nav />
      <Hero />
      <ProductPreview />
      <Features />
      <Channels />
      <Pricing />
      <FAQ />
      <About />
      <CTA />
      <Footer />
    </div>
  );
}
function Nav() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-3">
        <Link to="/" className="flex items-center gap-2 font-display font-bold">
          <span className="grid h-8 w-8 place-items-center rounded-xl gradient-brand text-primary-foreground">
            M
          </span>
          MarketingPilot
        </Link>
        <nav aria-label="Fő navigáció" className="hidden gap-5 text-sm font-medium lg:flex">
          <a href="#preview">Termékelőnézet</a>
          <a href="#features">Funkciók</a>
          <a href="#channels">Publikálás</a>
          <a href="#pricing">Béta hozzáférés</a>
          <a href="#faq">GYIK</a>
        </nav>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/login">Belépés</Link>
          </Button>
          <Button asChild size="sm" className="rounded-full">
            <Link to="/signup">Regisztráció</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
function Hero() {
  return (
    <section className="gradient-hero">
      <div className="mx-auto max-w-6xl px-5 py-14 text-center md:py-20">
        <p className="inline-flex items-center gap-2 rounded-full border bg-card px-4 py-2 text-sm font-medium text-primary">
          <Sparkles className="h-4 w-4" /> AI marketing-munkatér · Nyilvános béta
        </p>
        <h1 className="mx-auto mt-6 max-w-4xl text-balance font-display text-4xl font-bold tracking-tight md:text-6xl">
          Nincs marketingesed?
          <br />
          <span className="gradient-text">Legyen egyszerűbb a tartalomkészítés.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          Írd le, mit szeretnél elmondani. A MarketingPilot a márkád hangján készít szerkeszthető
          posztváltozatokat, és egy helyen tartja a kampányaidat és a tartalomtervedet.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg" className="rounded-full px-8">
            <Link to="/signup">
              Díjmentes béta kipróbálása <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="rounded-full">
            <a href="#preview">Nézd meg, hogyan működik</a>
          </Button>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          Nem kérünk bankkártyát. Nem indul automatikus előfizetés. A tartalmakat te ellenőrzöd.
        </p>
      </div>
    </section>
  );
}
function ProductPreview() {
  return (
    <section id="preview" className="scroll-mt-24 px-5 pb-16">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-primary">
              A valódi alkalmazás
            </p>
            <h2 className="mt-2 font-display text-3xl font-bold">
              Egy ötlet. Saját szöveg. Élő előnézet.
            </h2>
          </div>
          <span className="rounded-full border px-3 py-1.5 text-sm text-muted-foreground">
            Képernyőkép tesztmárkával
          </span>
        </div>
        <a
          href="/images/marketingpilot-studio.jpg"
          target="_blank"
          rel="noreferrer"
          className="block overflow-hidden rounded-3xl border bg-card shadow-elevated"
          aria-label="Posztkészítő képernyőkép megnyitása nagyban"
        >
          <img
            src="/images/marketingpilot-studio.jpg"
            alt="A MarketingPilot működő posztkészítője: teszt pékségnek készült szerkeszthető Facebook-szöveg és közvetlen mellette a posztelőnézet."
            width="1280"
            height="800"
            className="h-auto w-full"
            fetchPriority="high"
          />
        </a>
        <p className="mt-3 text-sm text-muted-foreground">
          A működő szerkesztőben készített felvétel. A bemutatóban szereplő pékség tesztmárka, nem
          ügyfélvélemény vagy üzleti eredmény.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {[
            [
              "1",
              "Írd le az ajánlatod",
              "Nem kell hat lépésen végigmenned. A vállalkozástípus opcionális.",
            ],
            [
              "2",
              "Finomítsd a változatokat",
              "Külön szöveg készül a kiválasztott platformokra. Szerkesztheted és ellenőrizheted.",
            ],
            [
              "3",
              "Mentsd vagy másold",
              "A piszkozat megmarad. A publikálás és az időzítés lehetőségeit lent pontosan leírjuk.",
            ],
          ].map(([number, title, description]) => (
            <div key={number} className="flex gap-3 rounded-2xl border bg-card p-5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 font-semibold text-primary">
                {number}
              </span>
              <div>
                <h3 className="font-semibold">{title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
function Features() {
  const items = [
    {
      icon: Wand2,
      title: "Poszt, a saját hangodon",
      description:
        "Facebook, Instagram, LinkedIn, TikTok és Google Business szövegváltozatok. Hookok, A/B irányok és hirdetésszövegek a mentett poszthoz.",
    },
    {
      icon: Palette,
      title: "Márkahang és vállalkozástípus",
      description:
        "Saját szolgáltatásaid, célközönséged, régiód és korábbi posztpéldáid adják az AI kontextusát.",
    },
    {
      icon: Calendar,
      title: "Kampány és 30 napos terv",
      description:
        "Briefből AI-stratégia és szerkeszthető tervtételek. A Planner és a naptár ugyanazt a mentett tervet használja.",
    },
    {
      icon: ImageIcon,
      title: "Képposzt és carousel",
      description:
        "Saját fotókból szerkeszthető feliratokkal készíthetsz képposztot. Az AI-képgenerálás külső képkredithez kötött.",
    },
    {
      icon: Copy,
      title: "Szerkesztés és újrafelhasználás",
      description:
        "Másold a kész szöveget, mentsd a változatokat, duplikáld a posztot. A végső tartalomról te döntesz.",
    },
    {
      icon: ShieldCheck,
      title: "Saját marketing-munkatér",
      description:
        "A fiókodhoz saját munkatér és márka tartozik. A mentett tartalmakat új belépés után is eléred.",
    },
  ];
  return (
    <section id="features" className="scroll-mt-24 border-y bg-secondary/30 px-5 py-16">
      <div className="mx-auto max-w-6xl">
        <h2 className="font-display text-3xl font-bold">A vállalkozásodhoz igazodik.</h2>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Magyar kezelőfelület, a márkád nyelvére, régiójára és szolgáltatásaira épülő tartalom. Egy
          közös munkatér az ötlettől a kész piszkozatig.
        </p>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <div key={item.title} className="hard-lift p-6">
              <item.icon className="h-6 w-6 text-primary" />
              <h3 className="mt-4 text-lg font-bold">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
function Channels() {
  return (
    <section id="channels" className="scroll-mt-24 px-5 py-16">
      <div className="mx-auto max-w-6xl">
        <p className="text-sm font-semibold uppercase tracking-wider text-primary">
          Előkészítés és közzététel
        </p>
        <h2 className="mt-2 font-display text-3xl font-bold">
          Posztol helyetted? Jelenleg nem automatikusan.
        </h2>
        <p className="mt-3 max-w-3xl leading-relaxed text-muted-foreground">
          A szövegkészítés, mentés és másolás használható. A csatornák összekötése és az automatikus
          közzététel külön feltételekhez kötött; a béta ezt nem mutatja késznek, ha nincs működő
          kapcsolat.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          {[
            { icon: Facebook, name: "Facebook" },
            { icon: Instagram, name: "Instagram" },
            { icon: Linkedin, name: "LinkedIn" },
            { icon: Music2, name: "TikTok" },
            { icon: Globe, name: "Google Business" },
          ].map(({ icon: Icon, name }) => (
            <span
              key={name}
              className="flex items-center gap-2 rounded-full border bg-card px-4 py-2 text-sm"
            >
              <Icon className="h-4 w-4 text-primary" />
              {name} · szövegváltozat
            </span>
          ))}
        </div>
        <div className="mt-7 grid gap-4 md:grid-cols-3">
          {[
            {
              icon: Copy,
              title: "Szöveg és képposzt",
              status: "Használható",
              description:
                "Készíts, szerkessz, ments és másolj szöveget. Saját fotóval képposztot és carousel képeket is összeállíthatsz.",
            },
            {
              icon: Send,
              title: "Facebook / Instagram publikálás",
              status: "Meta-beállítás szükséges",
              description:
                "A publikálási rendszer elkészült, de a kapcsolat külső Meta-beállítás miatt blokkolt. Jelenleg ne számíts működő közvetlen posztolásra.",
            },
            {
              icon: Clock,
              title: "Naptár és ütemezés",
              status: "Tervezés használható",
              description:
                "A dátum és idő tartósan mentődik. Háttérben automatikusan futó publikáló nincs bekötve; az időpont mentése nem jelent közzétételt.",
            },
          ].map((item) => (
            <article key={item.title} className="rounded-2xl border bg-card p-5">
              <item.icon className="h-5 w-5 text-primary" />
              <h3 className="mt-3 font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm font-medium text-primary">{item.status}</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {item.description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
function Pricing() {
  return (
    <section id="pricing" className="scroll-mt-24 border-y bg-secondary/30 px-5 py-16">
      <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-2">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">
            Béta hozzáférés
          </p>
          <h2 className="mt-3 font-display text-3xl font-bold">
            Egy hozzáférés. Egyértelmű feltételek.
          </h2>
          <p className="mt-4 leading-relaxed text-muted-foreground">
            Most díjmentes bétát próbálhatsz ki. Nincs időkorlátos próbacsomag és utána automatikus
            fizetés. Fizetős csomagok jelenleg nem vásárolhatók meg.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Az AI-használatot külső szolgáltatói keretek befolyásolják. Nem ígérünk korlátlan
            generálást, örök ingyenességet vagy a bétában biztosított rendelkezésre állást.
          </p>
        </div>
        <div className="rounded-3xl border bg-card p-7 shadow-card">
          <h3 className="text-xl font-semibold">Díjmentes béta</h3>
          <p className="mt-3 font-display text-4xl font-bold">
            0 RON <span className="text-base font-normal text-muted-foreground">a béta alatt</span>
          </p>
          <ul className="my-6 space-y-3 text-sm">
            {[
              "Saját munkatér és márkahang",
              "AI szövegek és platformváltozatok",
              "Kampánybrief és 30 napos terv kipróbálása",
              "Mentett posztok, Planner és tartalomnaptár",
              "Bankkártya és automatikus terhelés nélkül",
            ].map((item) => (
              <li key={item} className="flex gap-2">
                <Check className="h-4 w-4 shrink-0 text-primary" />
                {item}
              </li>
            ))}
          </ul>
          <Button asChild className="w-full rounded-full">
            <Link to="/signup">Bétafiók létrehozása</Link>
          </Button>
          <p className="mt-4 text-sm text-muted-foreground">
            AI-kép: képkredit szükséges. Meta-publikálás: külső beállítás szükséges.
          </p>
        </div>
      </div>
    </section>
  );
}
const QUESTIONS = [
  [
    "Kell hozzá marketingtudás vagy hosszú prompt?",
    "Nem. Írd le az ajánlatodat hétköznapi nyelven, válassz csatornát, és készítsd el a posztot. A részletes szerkesztő opcionális. A vállalkozástípust is kihagyhatod.",
  ],
  [
    "Mennyire megbízható az AI szövege?",
    "A márkád adatait és hangját használja, de hibázhat. Közzététel előtt ellenőrizd a tényeket, árakat és dátumokat. Minden kész szöveg szerkeszthető; több hookot vagy eltérő változatot is kérhetsz.",
  ],
  [
    "Magyarul és románul is használható?",
    "A kezelőfelület jelenleg magyar. A márkánál megadhatod a tartalom nyelvét és régióját. Más nyelven generált szövegnél is szükséges a nyelvi ellenőrzés; a teljes román kezelőfelület még nem készült el.",
  ],
  [
    "Ugyanaz a szöveg kerül minden platformra?",
    "Nem: a kiválasztott platformokra külön változatot kérünk az AI-tól. Ezeket egyenként szerkesztheted és előnézetben ellenőrizheted.",
  ],
  [
    "A naptárból automatikusan kimegy a poszt?",
    "Jelenleg nem. A naptár és a Planner a mentett tartalomtervet kezeli. Az automatikus háttérpublikáláshoz külön futtató infrastruktúra és működő csatornakapcsolat szükséges.",
  ],
  [
    "Készíthetek reklámképet is?",
    "Saját fotóból és szerkeszthető feliratokból képposztot vagy carousel képeket készíthetsz. A külön AI-képgenerálás szolgáltatói képkredithez kötött; kredit hiányában hibaüzenetet kapsz, nem kész képet.",
  ],
  [
    "Kell bankkártya? Hogyan mondom le?",
    "A díjmentes bétában nincs bankkártyás fizetés vagy megújuló előfizetés, így nincs levonás, amit le kellene mondanod. A használatot abbahagyhatod. A fióktörlési kapcsolat és a végleges jogi feltételek még előkészítés alatt állnak.",
  ],
  [
    "Már kész, éles szolgáltatás ez?",
    "Ez nyilvános béta. A tartalomkészítési és tervezési funkciók használhatók, a Meta-kapcsolat, a képkredit, az automatikus publikálás és a jogi tájékoztatók még véglegesítést igényelnek.",
  ],
];
function FAQ() {
  return (
    <section id="faq" className="scroll-mt-24 mx-auto max-w-4xl px-5 py-16">
      <h2 className="font-display text-3xl font-bold">Gyakori kérdések</h2>
      <div className="mt-7 divide-y rounded-2xl border bg-card px-5">
        {QUESTIONS.map(([question, answer]) => (
          <details key={question} className="group py-5">
            <summary className="cursor-pointer text-base font-semibold focus-visible:outline-primary">
              {question}
            </summary>
            <p className="mt-3 text-base leading-relaxed text-muted-foreground">{answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
function About() {
  return (
    <section className="mx-auto max-w-6xl px-5 pb-12">
      <div className="rounded-2xl border p-6">
        <h2 className="text-xl font-semibold">Miért készül a MarketingPilot?</h2>
        <p className="mt-3 max-w-3xl leading-relaxed text-muted-foreground">
          Kisvállalkozásoknak, akik maguk kezelik a marketingjüket. Nem különálló promptokat kell
          rendszerezned: a vállalkozásod kontextusa, a márkahang, a platformváltozatok és a
          tartalomterv ugyanabban a munkatérben marad.
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          Még nem közlünk ügyfélvéleményeket vagy növekedési számokat. A termék jelenlegi működését
          a fenti valódi képernyőkép és az őszinte funkcióstátuszok mutatják.
        </p>
        <Link
          to="/contact"
          className="mt-4 inline-block text-sm font-semibold text-primary hover:underline"
        >
          Üzemeltető és kapcsolat →
        </Link>
      </div>
    </section>
  );
}
function CTA() {
  return (
    <section className="px-5 pb-16">
      <div className="mx-auto max-w-6xl rounded-3xl gradient-brand p-8 text-center text-primary-foreground md:p-12">
        <h2 className="font-display text-3xl font-bold">Kezdd egyetlen poszttal.</h2>
        <p className="mx-auto mt-3 max-w-xl leading-relaxed">
          Regisztrációkor létrejön a saját munkatered és márkád. A vállalkozásod részleteit később
          is megadhatod.
        </p>
        <Button
          asChild
          size="lg"
          className="mt-6 rounded-full bg-primary-foreground text-primary hover:bg-primary-foreground/90"
        >
          <Link to="/signup">Díjmentes béta kipróbálása</Link>
        </Button>
      </div>
    </section>
  );
}
function Footer() {
  return (
    <footer className="border-t px-5 py-8 text-muted-foreground">
      <div className="mx-auto flex max-w-6xl flex-col justify-between gap-5 md:flex-row">
        <p className="text-sm">MarketingPilot © 2026 · Nyilvános béta</p>
        <PublicInfoLinks />
      </div>
      <p className="mx-auto mt-4 max-w-6xl text-sm">
        Az üzemeltetői és végleges jogi adatok előkészítés alatt állnak; a tájékoztatók ezt külön
        jelzik.
      </p>
    </footer>
  );
}
