import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowRight,
  CalendarDays,
  Check,
  ChevronDown,
  Menu,
  Palette,
  ShieldCheck,
  Sparkles,
  WandSparkles,
  X,
} from "lucide-react";
import { PublicInfoLinks } from "@/components/public-info-page";
import { LANDING_EXAMPLE } from "@/lib/landing-example";
import "@/landing.css";

const PREVIEWS = [
  {
    label: "Kész poszt",
    icon: WandSparkles,
    image: "marketingpilot-simple-result.jpg",
    title: "Olvasd át. Javíts bele. Másold ki.",
    description:
      "A saját hangodon írt szöveg szerkeszthető. Facebookra és Instagramra külön változatot kérhetsz.",
    alt: "Egyszerű mód: a Példa Pékség kész posztja és a négy menüpont.",
    mode: "Egyszerű módban",
  },
  {
    label: "Kezdőlap",
    icon: Palette,
    image: "marketingpilot-simple-home.jpg",
    title: "Egy helyen maradnak a posztjaid és az ötleteid.",
    description:
      "A vállalkozásod adatai segítenek, hogy a következő posztnál se kelljen mindent újra elmondanod.",
    alt: "Egyszerű mód: egy ötletmező a Példa Pékség kezdőlapján, négy menüponttal.",
    mode: "Egyszerű módban",
  },
  {
    label: "Naptár",
    icon: CalendarDays,
    image: "marketingpilot-detailed-calendar.jpg",
    title: "Több lehetőség, amikor szükséged van rá.",
    description:
      "Részletes módban naptárban is rendezheted a tartalmaidat. A tervezett időpont jelenleg nem indít automatikus közzétételt.",
    alt: "Részletes mód: a Példa Pékség tartalomnaptára.",
    mode: "Részletes módban",
  },
];

export function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const navigation = [
    ["#preview", "Így működik"],
    ["#features", "Mit kapsz?"],
    ["#pricing", "Ingyenes béta"],
    ["#faq", "Kérdések"],
  ];
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
              MarketingPilot<small>Posztok egyszerűen, a te hangodon.</small>
            </span>
          </Link>
          <nav aria-label="Fő navigáció" className="mp-desktop-nav">
            {navigation.map(([href, label]) => (
              <a key={href} href={href}>
                {label}
              </a>
            ))}
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
            {navigation.map(([href, label]) => (
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
        <ProductPreview />
        <Features />
        <Beta />
        <FAQ />
      </main>
      <footer className="mp-container mp-footer">
        <div>
          <Link to="/" className="mp-brand">
            <span className="mp-logo">M</span>
            <span>
              MarketingPilot<small>Posztok egyszerűen, a te hangodon.</small>
            </span>
          </Link>
          <p>© 2026 MarketingPilot · Díjmentes béta</p>
        </div>
        <div>
          <PublicInfoLinks />
          <Link to="/contact" className="mp-text-link">
            Ki áll mögötte? Üzemeltető és kapcsolat <ArrowRight size={16} />
          </Link>
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
          <span /> Kisvállalkozóknak, akiknek nincs marketingesük
        </p>
        <h1>
          Egy mondatból
          <br />
          kész poszt.
          <br />
          <em>Percek alatt.</em>
        </h1>
        <p className="mp-hero-description">
          Leírod, mit szeretnél megosztani. A MarketingPilot megírja a te hangodon. Te jóváhagyod,
          és kiteszed.
        </p>
        <div className="mp-visual-request mp-hero-brief">
          <WandSparkles size={20} />
          <div>
            <small>TE EZT ÍROD</small>
            <p>„{LANDING_EXAMPLE.idea}”</p>
          </div>
        </div>
        <div className="mp-hero-actions">
          <Link to="/signup" className="mp-button">
            Kipróbálom ingyen <ArrowRight size={18} />
          </Link>
          <a href="#preview" className="mp-text-link">
            Megnézem, hogyan működik <ArrowDown size={17} />
          </a>
        </div>
        <p className="mp-micro">
          <Check size={15} /> Bankkártya nélkül <span>·</span> Facebook-kapcsolat sem kell
        </p>
      </div>
      <div className="mp-hero-visual">
        <div className="mp-visual-heading">
          <span>
            <Sparkles size={17} /> Ilyen posztot készíthetsz
          </span>
          <span className="mp-window-dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        </div>
        <article className="mp-example-post" aria-label="Szerkesztett bemutatóposzt">
          <header>
            <span className="mp-example-avatar" aria-hidden="true">
              P
            </span>
            <div>
              <strong>{LANDING_EXAMPLE.brand}</strong>
              <small>Facebook · Kitalált példamárka</small>
            </div>
          </header>
          <p>{LANDING_EXAMPLE.text}</p>
        </article>
        <div className="mp-visual-foot">
          <span>
            <Check size={16} /> Szerkeszthető szöveg és előnézet
          </span>
          <small>Szerkesztett bemutatópélda</small>
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
      <div className="mp-steps mp-simple-steps">
        {[
          {
            title: "Leírod az ötleted",
            text: "Egy ajánlat, újdonság vagy köszönet. Nem kell hozzá marketingtudás.",
          },
          {
            title: "Átnézed a kész posztot",
            text: "Megírjuk a vállalkozásod hangján. Bármit átírhatsz benne.",
          },
          {
            title: "Kimásolod és kiteszed",
            text: "A szöveget átmásolod a közösségi oldaladra. Mindig te döntesz.",
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
      <div className="mp-section-heading">
        <div>
          <p className="mp-eyebrow">Nézd meg, mit kapsz</p>
          <h2>
            A kész posztot látod.
            <br />
            Nem egy újabb űrlapot.
          </h2>
        </div>
        <p>
          Az új, egyszerűbb felület előnézete.
          <br />A belső felület frissítését még előkészítjük.
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
            <p className="mp-preview-mode">{preview.mode} · Előkészített felület · példamárka</p>
            <h3>{preview.title}</h3>
            <p>{preview.description}</p>
          </div>
          <span>
            Következő belső kiadás
            <br />
            <strong>Helyi tesztben ellenőrizve</strong>
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
            height={900}
            loading="lazy"
            alt={preview.alt}
          />
        </a>
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
            <p className="mp-eyebrow">Négy dolog, ami megkönnyíti a heted</p>
            <h2>
              Kevesebb gondolkodás.
              <br />
              Több kész poszt.
            </h2>
          </div>
        </div>
        <div className="mp-benefits">
          {[
            {
              icon: WandSparkles,
              title: "Egy mondatból kész poszt",
              text: "A vállalkozásod mentett adatai segítenek a poszt elkészítésében.",
            },
            {
              icon: Palette,
              title: "A te hangodon, nem robotként",
              text: "A termékeid, a közönséged és a megadott hangnem adja a kiindulást. A szöveget te ellenőrzöd.",
            },
            {
              icon: ShieldCheck,
              title: "A hiányzó adatot jelzi",
              text: "Ha hiányzik például a cím vagy az ár, kitöltendő mezőt kérünk. Közzététel előtt pótold a hiányzó adatokat, és mindig nézd át az AI szövegét.",
            },
            {
              icon: CalendarDays,
              title: "Posztötletek a következő hétre",
              text: "A vállalkozásodhoz illő 3–4 poszt javaslata. Külön megnyithatod, szerkesztheted és másolhatod őket.",
            },
          ].map(({ icon: Icon, title, text }) => (
            <article key={title} className="mp-feature">
              <Icon size={26} />
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
        <div className="mp-continuity">
          <h3>A posztolás könnyen elmarad, ha mindent egyedül csinálsz.</h3>
          <p>
            A heti tervben előre látod a következő 3–4 posztötletedet. Amikor van pár perced,
            megnyitod az egyiket, átnézed, és kiteszed.
          </p>
        </div>
      </div>
    </section>
  );
}

function Beta() {
  return (
    <section id="pricing" className="mp-container mp-pricing">
      <div>
        <p className="mp-eyebrow">Ingyenes belépés, bankkártya nélkül</p>
        <h2>Kezdd egy poszttal.</h2>
        <p>A béta díjmentes. Nincs fizetés, nincs automatikus terhelés.</p>
        <p className="mp-pricing-note">
          A generálás használati limitekhez és szolgáltatói keretekhez kötött. A béta nem korlátlan,
          és nem ígéret örök ingyenességre.
        </p>
        <h3 className="mp-beta-exclusions">Amit most még nem kapsz</h3>
        <ul className="mp-beta-exclusions">
          <li>Automatikus Facebook- és Instagram-közzététel: a kapcsolat előkészítés alatt áll.</li>
          <li>AI-képgenerálás: még nincs. Saját fotóból viszont készíthetsz képposztot.</li>
        </ul>
      </div>
      <div className="mp-price-card">
        <div className="mp-price-top">
          <span>Díjmentes béta</span>
          <Sparkles size={22} />
        </div>
        <p className="mp-price">
          0 <span>RON / a béta alatt</span>
        </p>
        <ul>
          {[
            "Posztok a vállalkozásod hangján",
            "Külön Facebook- és Instagram-szöveg",
            "Heti terv és mentett posztok",
            "Saját kép és szerkeszthető feliratok",
          ].map((text) => (
            <li key={text}>
              <Check size={17} />
              {text}
            </li>
          ))}
        </ul>
        <Link to="/signup" className="mp-button">
          Elkészítem az első posztomat <ArrowRight size={18} />
        </Link>
        <small>A közzétételt te végzed a saját közösségi oldaladon.</small>
      </div>
    </section>
  );
}

const QUESTIONS = [
  [
    "Fel kell kötnöm a Facebookot?",
    "Nem. A kész szöveget kimásolod, majd beilleszted a Facebookra vagy az Instagramra. Kapcsolat nélkül is használható. A közvetlen közzététel még előkészítés alatt áll.",
  ],
  [
    "Mennyibe kerül?",
    "A béta ingyenes, bankkártyát sem kérünk. A generálásnak van használati kerete. Későbbi fizetős csomagra nem váltunk át automatikusan.",
  ],
  [
    "Jóváhagyás nélkül posztol?",
    "Nem. Jelenleg te teszed ki a kész szöveget. A naptárban mentett időpont tervezésre szolgál, nem indít automatikus közzétételt.",
  ],
  [
    "Kitalál tényeket?",
    "A megadott tényekre építünk, a hiányzó konkrét adatot szögletes zárójelben jelezzük, például [cím]. A hiányzó adatot szerkesztéskor pótolhatod; hiányos szöveget ne tegyél közzé. Az AI így is hibázhat: az árakat, dátumokat és állításokat mindig ellenőrizd.",
  ],
  [
    "Magyarul készülnek a posztok?",
    "Igen, a vállalkozásodnál megadott nyelven. A kezelőfelület magyar. Román nyelvű szöveget is kérhetsz, de azt is ellenőrizd közzététel előtt.",
  ],
  [
    "Hová kerülnek az adataim?",
    "A fiók és a vállalkozás adatait Neon adatbázisban, a feltöltött fájlokat privát Vercel tárhelyen tároljuk. A generáláshoz szükséges márkaadatokat és ötletet az OpenRouter és a kiválasztott modell szolgáltatója kapja meg. A részleteket az Adatvédelem oldalon találod.",
  ],
  [
    "Megszüntethetem a fiókomat?",
    "A fiók megszüntetését az üzemeltetőtől kérheted. Az önkiszolgáló adatexport és fióktörlés a következő belső kiadás része; jelenleg még nem elérhető.",
  ],
  [
    "Meg kell jelölnöm, ha AI segített?",
    "A platformok és a jogszabályok előírásai változhatnak. A valósághű, AI-val készült vagy módosított képre, videóra és hangra külön szabályok vonatkozhatnak. Közzététel előtt nézd meg az adott platform aktuális tájékoztatóját, jogi kérdésben pedig kérj szakértői segítséget. Ez nem jogi tanács.",
  ],
];
function FAQ() {
  return (
    <section id="faq" className="mp-container mp-section mp-faq">
      <div>
        <p className="mp-eyebrow">Mielőtt belevágsz</p>
        <h2>Egyszerű válaszok.</h2>
        <Link to="/contact" className="mp-text-link">
          Üzemeltető és kapcsolat <ArrowRight size={17} />
        </Link>
        <Link to="/signup" className="mp-button mp-faq-start">
          Kipróbálom ingyen <ArrowRight size={18} />
        </Link>
      </div>
      <div>
        {QUESTIONS.map(([question, answer]) => (
          <details key={question}>
            <summary>
              {question}
              <ChevronDown size={19} />
            </summary>
            <p>
              {answer}
              {question === "Hová kerülnek az adataim?" && (
                <>
                  <br />
                  <Link to="/privacy" className="mp-text-link">
                    Adatvédelmi tájékoztató <ArrowRight size={16} />
                  </Link>
                </>
              )}
              {question === "Meg kell jelölnöm, ha AI segített?" && (
                <>
                  <br />
                  <a
                    className="mp-text-link"
                    href="https://about.fb.com/news/2024/04/metas-approach-to-labeling-ai-generated-content-and-manipulated-media/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Meta tájékoztató az AI-jelölésről <ArrowRight size={16} />
                  </a>
                </>
              )}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}
