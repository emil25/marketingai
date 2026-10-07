import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowRight,
  CalendarDays,
  Check,
  ChevronDown,
  Copy,
  Facebook,
  Globe,
  Image as ImageIcon,
  Instagram,
  Linkedin,
  Menu,
  MessageSquare,
  Music2,
  Palette,
  Sparkles,
  WandSparkles,
  X,
} from "lucide-react";
import { PublicInfoLinks } from "@/components/public-info-page";
import "@/landing.css";

const PREVIEWS = [
  {
    label: "Posztkészítő",
    icon: WandSparkles,
    image: "marketingpilot-studio.jpg",
    title: "Az ötletedből szerkeszthető poszt.",
    description:
      "Külön szöveg a kiválasztott felületekre, a márkád hangján. Finomítsd a szöveget, nézd meg az előnézetet, majd mentsd vagy másold.",
    alt: "A MarketingPilot működő posztkészítője teszt pékséggel, szerkeszthető Facebook-szöveggel és élő posztelőnézettel.",
  },
  {
    label: "Munkatér",
    icon: Palette,
    image: "marketingpilot-workspace.jpg",
    title: "Lásd, hol tart a marketinged.",
    description:
      "A következő teendő, a mentett posztok és a heti tartalomterv egy helyen. A gyorsindítók a vállalkozásodhoz igazodnak.",
    alt: "A MarketingPilot valódi Dashboardja, tesztmárka mentett posztjaival és heti tartalomtervével.",
  },
  {
    label: "Tartalomnaptár",
    icon: CalendarDays,
    image: "marketingpilot-calendar.jpg",
    title: "A terveidnek is legyen helye.",
    description:
      "Hónap, hét vagy nap: a naptár és a Planner ugyanazt a mentett tervet mutatja. A tervezett időpont nem jelent automatikus publikálást.",
    alt: "A MarketingPilot működő tartalomnaptára, a tesztmárka valódi mentett tervtételeivel.",
  },
];

export function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="theme-marketingpilot-v2 public-site mp-landing">
      <a className="mp-skip" href="#main">
        Ugrás a tartalomhoz
      </a>
      <header className="mp-nav">
        <div className="mp-container mp-nav-inner">
          <Link to="/" className="mp-brand" aria-label="MarketingPilot főoldal">
            <span className="mp-logo">M</span>
            <span>
              MarketingPilot<small>A márkád. Egy helyen.</small>
            </span>
          </Link>
          <nav aria-label="Fő navigáció" className="mp-desktop-nav">
            <a href="#preview">Így működik</a>
            <a href="#features">Mit kapsz?</a>
            <a href="#pricing">Béta hozzáférés</a>
            <a href="#faq">Kérdések</a>
          </nav>
          <div className="mp-nav-actions">
            <Link to="/login" className="mp-login">
              Belépés
            </Link>
            <Link to="/signup" className="mp-button mp-button-small">
              Kipróbálom <ArrowRight size={16} />
            </Link>
            <button
              className="mp-menu-button"
              aria-expanded={menuOpen}
              aria-controls="mobile-navigation"
              aria-label={menuOpen ? "Menü bezárása" : "Menü megnyitása"}
              onClick={() => setMenuOpen(!menuOpen)}
            >
              {menuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
        {menuOpen && (
          <nav id="mobile-navigation" aria-label="Mobil navigáció" className="mp-mobile-nav">
            {[
              ["#preview", "Így működik"],
              ["#features", "Mit kapsz?"],
              ["#pricing", "Béta hozzáférés"],
              ["#faq", "Gyakori kérdések"],
            ].map(([href, label]) => (
              <a key={href} href={href} onClick={() => setMenuOpen(false)}>
                {label}
                <ArrowRight size={16} />
              </a>
            ))}
          </nav>
        )}
      </header>
      <main id="main">
        <Hero />
        <div className="mp-platform-strip mp-container">
          <p>
            Egy ötletből több felületre.<small>Külön szerkeszthető szövegváltozatok.</small>
          </p>
          <div>
            {[
              { icon: Facebook, label: "Facebook" },
              { icon: Instagram, label: "Instagram" },
              { icon: Linkedin, label: "LinkedIn" },
              { icon: Music2, label: "TikTok" },
              { icon: Globe, label: "Google Cégprofil" },
            ].map(({ icon: Icon, label }) => (
              <span key={label}>
                <Icon size={19} aria-hidden="true" />
                {label}
              </span>
            ))}
          </div>
        </div>
        <ProductPreview />
        <Features />
        <Channels />
        <Pricing />
        <FAQ />
        <section className="mp-container mp-about">
          <div>
            <p className="mp-eyebrow">Miért MarketingPilot?</p>
            <h2>
              A vállalkozásodhoz érts.
              <br />A tartalomban segítünk.
            </h2>
          </div>
          <div>
            <p>
              Azoknak készül, akik maguk viszik a vállalkozásukat, és a marketingre is nekik kell
              időt találniuk. A saját márkahangod, posztjaid és terveid egy munkatérben maradnak.
            </p>
            <Link to="/contact" className="mp-text-link">
              Üzemeltető és kapcsolat <ArrowRight size={17} />
            </Link>
          </div>
        </section>
        <section className="mp-container mp-final">
          <div>
            <p className="mp-eyebrow">A következő posztod itt kezdődik</p>
            <h2>
              Egy jó ötleted már van?
              <br />
              Adjunk neki formát.
            </h2>
            <p>
              Nem kell mindent előre beállítanod. Kezdd egy poszttal,
              <br className="mp-desktop-break" /> a márkád részleteit később is megadhatod.
            </p>
          </div>
          <div>
            <Link to="/signup" className="mp-button">
              Díjmentes béta kipróbálása <ArrowRight size={18} />
            </Link>
            <span>Bankkártya és automatikus előfizetés nélkül.</span>
          </div>
        </section>
      </main>
      <footer className="mp-container mp-footer">
        <div>
          <Link to="/" className="mp-brand">
            <span className="mp-logo">M</span>
            <span>
              MarketingPilot<small>AI marketing-munkatér</small>
            </span>
          </Link>
          <p>© 2026 MarketingPilot · Nyilvános béta</p>
        </div>
        <div>
          <PublicInfoLinks />
          <p>Az üzemeltetői és végleges jogi adatok előkészítés alatt állnak.</p>
        </div>
      </footer>
    </div>
  );
}

function Hero() {
  return (
    <section className="mp-container mp-hero">
      <div className="mp-hero-copy">
        <p className="mp-pill">
          <span /> A marketinged új munkatere · Béta
        </p>
        <h1>
          Te viszed
          <br />a vállalkozást.
          <br />
          <em>
            Mi segítünk
            <br />a tartalomban.
          </em>
        </h1>
        <p className="mp-hero-description">
          Egy rövid ötletből posztok a saját hangodon. Kampányok, képposztok és tartalomterv — egy
          helyen, marketinges nélkül is.
        </p>
        <div className="mp-hero-actions">
          <Link to="/signup" className="mp-button">
            Kipróbálom díjmentesen <ArrowRight size={18} />
          </Link>
          <a href="#preview" className="mp-text-link">
            Mutasd a felületet <ArrowDown size={17} />
          </a>
        </div>
        <p className="mp-micro">
          <Check size={15} /> Nem kell bankkártya <span>·</span> A kész szövegről te döntesz
        </p>
      </div>
      <div className="mp-hero-visual">
        <div className="mp-visual-heading">
          <span>
            <Sparkles size={17} /> Az ötlettől a kész posztig
          </span>
          <span className="mp-window-dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        </div>
        <div className="mp-visual-request">
          <MessageSquare size={20} />
          <div>
            <small>EGYSZERŰEN MONDD EL</small>
            <p>„Mutassuk be a pékségünk friss reggelijét.”</p>
          </div>
        </div>
        <a href="#preview" className="mp-hero-screen" aria-label="Valódi posztkészítő megtekintése">
          <img
            src="/images/marketingpilot-studio.jpg"
            width={1280}
            height={800}
            fetchPriority="high"
            alt="Valódi MarketingPilot posztkészítő: szerkeszthető szöveg és mellette a Facebook-előnézet egy teszt pékségnek."
          />
        </a>
        <div className="mp-visual-foot">
          <span>
            <Check size={16} /> Szöveg + előnézet + mentés
          </span>
          <small>Valódi felület · tesztmárka</small>
        </div>
        <div className="mp-visual-caption">
          <WandSparkles size={19} />
          <span>
            A márkád hangja.
            <br />
            <strong>A te kezedben.</strong>
          </span>
        </div>
      </div>
    </section>
  );
}

function ProductPreview() {
  const [active, setActive] = useState(0);
  const preview = PREVIEWS[active];
  return (
    <section id="preview" className="mp-section mp-container">
      <div className="mp-section-heading">
        <div>
          <p className="mp-eyebrow">Nézz bele a munkatérbe</p>
          <h2>
            Kevesebb „mit posztoljak?”.
            <br />
            Több kész tartalom.
          </h2>
        </div>
        <p>
          Nem kell hosszú promptot írnod.
          <br />
          Egy ötlet, néhány finomítás, és mentheted is.
        </p>
      </div>
      <div className="mp-preview-tabs" role="tablist" aria-label="Termékelőnézet">
        {PREVIEWS.map(({ label, icon: Icon }, index) => (
          <button
            key={label}
            id={`preview-tab-${index}`}
            role="tab"
            aria-selected={active === index}
            aria-controls="product-preview-panel"
            tabIndex={active === index ? 0 : -1}
            onClick={() => setActive(index)}
            onKeyDown={(event) => {
              let next: number | undefined;
              if (event.key === "ArrowRight") next = (index + 1) % PREVIEWS.length;
              if (event.key === "ArrowLeft") next = (index + PREVIEWS.length - 1) % PREVIEWS.length;
              if (event.key === "Home") next = 0;
              if (event.key === "End") next = PREVIEWS.length - 1;
              if (next !== undefined) {
                event.preventDefault();
                setActive(next);
                document.getElementById(`preview-tab-${next}`)?.focus();
              }
            }}
          >
            <Icon size={18} />
            {label}
          </button>
        ))}
      </div>
      <div
        className="mp-preview-frame"
        id="product-preview-panel"
        role="tabpanel"
        aria-labelledby={`preview-tab-${active}`}
        tabIndex={0}
      >
        <div className="mp-preview-caption">
          <div>
            <h3>{preview.title}</h3>
            <p>{preview.description}</p>
          </div>
          <span>
            Valódi alkalmazás
            <br />
            <strong>Tesztmárkával bemutatva</strong>
          </span>
        </div>
        <a
          href={`/images/${preview.image}`}
          target="_blank"
          rel="noreferrer"
          aria-label={`${preview.label} képernyőkép megnyitása nagyban`}
        >
          <img
            src={`/images/${preview.image}`}
            width={1280}
            height={800}
            loading="lazy"
            alt={preview.alt}
          />
        </a>
      </div>
      <div className="mp-steps">
        {[
          {
            title: "Mondd el az ötleted",
            text: "Egy ajánlat, újdonság vagy hétköznapi történet. Nem kell hat lépésen végigmenned.",
          },
          {
            title: "Formáld a sajátodra",
            text: "Válassz szövegváltozatot, javíts bele, adj hozzá saját képet. Az előnézet segít ellenőrizni.",
          },
          {
            title: "Mentsd és használd",
            text: "Másold ki a szöveget, vagy térj vissza a mentett posztodhoz. A naptárban tervezhetsz is.",
          },
        ].map(({ title, text }, index) => (
          <div key={title}>
            <span>0{index + 1}</span>
            <div>
              <h3>{title}</h3>
              <p>{text}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Features() {
  return (
    <section id="features" className="mp-feature-section">
      <div className="mp-container">
        <div className="mp-section-heading">
          <div>
            <p className="mp-eyebrow">A vállalkozásodra szabva</p>
            <h2>
              Nem újabb teendő.
              <br />
              Segítség a meglévőkhöz.
            </h2>
          </div>
          <p>
            Magyar kezelőfelület. A márkád nyelve,
            <br />
            régiója és szolgáltatásai adják az AI kontextusát.
          </p>
        </div>
        <div className="mp-feature-grid">
          <article className="mp-feature mp-feature-dark">
            <Palette size={27} />
            <p className="mp-eyebrow">Márka AI</p>
            <h3>
              Olyan szöveg,
              <br />
              amiben magadra ismersz.
            </h3>
            <p>
              Add meg, mit kínálsz, kikhez szólsz és hogyan kommunikálsz. Korábbi saját posztjaidból
              az AI márkahangot is tanulhat.
            </p>
            <div className="mp-context-tags">
              <span>Vállalkozástípus</span>
              <span>Célközönség</span>
              <span>Saját hangnem</span>
              <span>Régió és nyelv</span>
            </div>
          </article>
          <article className="mp-feature mp-feature-plan">
            <CalendarDays size={27} />
            <p className="mp-eyebrow">Kampányok és tervezés</p>
            <h3>
              Ne minden nap
              <br />a nulláról indulj.
            </h3>
            <p>
              Kampánybriefből AI-stratégia és 30 napos terv. A mentett tervtételekből posztot
              készíthetsz, és a naptárban rendezheted őket.
            </p>
            <Link to="/signup" className="mp-text-link">
              Saját tartalomtervet szeretnék <ArrowRight size={17} />
            </Link>
          </article>
          {[
            {
              icon: WandSparkles,
              title: "Egy brief, több változat",
              text: "Külön platformszövegek, erősebb hookok, A/B megközelítések és Meta hirdetésszövegek.",
            },
            {
              icon: ImageIcon,
              title: "Képposzt és carousel",
              text: "Saját fotód, szerkeszthető feliratok, letölthető grafika. AI-képhez külön képkredit szükséges.",
            },
            {
              icon: Copy,
              title: "A kész tartalom megmarad",
              text: "Mentett posztok, változatok és verziók. Szerkeszthetsz, másolhatsz vagy duplikálhatsz is.",
            },
          ].map(({ icon: Icon, title, text }) => (
            <article key={title} className="mp-feature mp-feature-mini">
              <Icon size={25} />
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Channels() {
  return (
    <section id="channels" className="mp-container mp-section mp-status-section">
      <div>
        <p className="mp-eyebrow">Őszintén a lehetőségekről</p>
        <h2>
          Tudd, mi kész.
          <br />
          És mi következik.
        </h2>
        <p>
          A béta a tartalomkészítésben és a tervezésben segít. A közzétételről mindig egyértelmű
          visszajelzést kapsz.
        </p>
      </div>
      <div className="mp-status-list">
        {[
          {
            title: "AI szöveg, mentés és másolás",
            badge: "Használható",
            ready: true,
            text: "Szerkeszthető posztok, platformváltozatok és saját fotóból képposztok.",
          },
          {
            title: "Naptár és tartalomterv",
            badge: "Használható",
            ready: true,
            text: "A dátumok és időpontok mentődnek. Ez tervezés, nem automatikus közzététel.",
          },
          {
            title: "Facebook / Instagram publikálás",
            badge: "Előkészítés alatt",
            ready: false,
            text: "Külső Meta-beállítás miatt jelenleg nem használható. Automatikus háttérpublikálás sincs bekötve.",
          },
          {
            title: "AI-képgenerálás",
            badge: "Képkredit szükséges",
            ready: false,
            text: "Külső szolgáltatói képkredithez kötött. Kredit nélkül nem készül kép; saját fotót használhatsz.",
          },
        ].map(({ title, badge, ready, text }) => (
          <article key={title}>
            <span className={`mp-status-dot ${ready ? "is-ready" : ""}`} />
            <div>
              <h3>{title}</h3>
              <p>{text}</p>
            </div>
            <span className={`mp-status-badge ${ready ? "is-ready" : ""}`}>{badge}</span>
          </article>
        ))}
      </div>
    </section>
  );
}

function Pricing() {
  return (
    <section id="pricing" className="mp-container mp-pricing">
      <div>
        <p className="mp-eyebrow">Kezdd el egyszerűen</p>
        <h2>
          Próbáld ki.
          <br />
          Kötelezettség nélkül.
        </h2>
        <p>
          Most díjmentes bétát használhatsz. Nincs bankkártya, automatikus terhelés vagy
          megvásárolható fizetős csomag.
        </p>
        <p className="mp-pricing-note">
          Az AI használatát szolgáltatói keretek befolyásolják. A béta nem jelent korlátlan
          generálást vagy örök ingyenességet.
        </p>
      </div>
      <div className="mp-price-card">
        <div className="mp-price-top">
          <span>Nyilvános béta</span>
          <Sparkles size={22} />
        </div>
        <p className="mp-price">
          0 <span>RON / a béta alatt</span>
        </p>
        <ul>
          {[
            "Saját munkatér és márkahang",
            "AI posztok és platformváltozatok",
            "Kampány és 30 napos terv kipróbálása",
            "Mentett posztok, Planner és naptár",
            "Képposztok a saját fotóidból",
          ].map((text) => (
            <li key={text}>
              <Check size={17} />
              {text}
            </li>
          ))}
        </ul>
        <Link to="/signup" className="mp-button">
          Létrehozom a fiókom <ArrowRight size={18} />
        </Link>
        <small>AI-kép és Meta-publikálás: lásd a fenti státuszokat.</small>
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
    <section id="faq" className="mp-container mp-section mp-faq">
      <div>
        <p className="mp-eyebrow">Mielőtt belevágsz</p>
        <h2>
          Jó kérdések.
          <br />
          Egyszerű válaszok.
        </h2>
        <Link to="/contact" className="mp-text-link">
          Kapcsolat és tájékoztatók <ArrowRight size={17} />
        </Link>
      </div>
      <div>
        {QUESTIONS.map(([question, answer]) => (
          <details key={question}>
            <summary>
              {question}
              <ChevronDown size={19} />
            </summary>
            <p>{answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
