import { type KeyboardEvent as ReactKeyboardEvent, useEffect, useRef, useState } from "react";
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
import { LANDING_DEMOS } from "@/lib/landing-example";
import { brandForLanguage, translate } from "@/i18n";
import "@/landing.css";

const PREVIEWS = [
  {
    label: "landing.preview.post.label",
    icon: WandSparkles,
    image: "marketingpilot-simple-result.jpg",
    title: "landing.preview.post.title",
    description: "landing.preview.post.description",
    alt: "landing.preview.post.alt",
    mode: "landing.mode.simple",
  },
  {
    label: "landing.preview.home.label",
    icon: Palette,
    image: "marketingpilot-simple-home.jpg",
    title: "landing.preview.home.title",
    description: "landing.preview.home.description",
    alt: "landing.preview.home.alt",
    mode: "landing.mode.simple",
  },
  {
    label: "landing.preview.calendar.label",
    icon: CalendarDays,
    image: "marketingpilot-detailed-calendar.jpg",
    title: "landing.preview.calendar.title",
    description: "landing.preview.calendar.description",
    alt: "landing.preview.calendar.alt",
    mode: "landing.mode.detailed",
  },
] as const;

export function LandingPage({
  privateBeta = false,
  contactAvailable = false,
}: {
  privateBeta?: boolean;
  contactAvailable?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [interactiveReady, setInteractiveReady] = useState(false);
  useEffect(() => setInteractiveReady(true), []);
  const brand = brandForLanguage("magyar");
  const navigation = [
    ["#preview", "landing.nav.preview"],
    ["#features", "landing.nav.features"],
    ["#pricing", "landing.nav.pricing"],
    ["#faq", "landing.nav.faq"],
  ] as const;
  return (
    <div
      className="theme-marketingpilot-v2 public-site mp-landing"
      data-landing-ready={interactiveReady}
    >
      <a className="mp-skip" href="#main">
        {translate("landing.skip")}
      </a>
      <header className="mp-nav">
        <div className="mp-container mp-nav-inner">
          <Link to="/" className="mp-brand" aria-label={`${brand.productName} főoldal`}>
            <span className="mp-logo">M</span>
            <span>
              {brand.productName}
              <small>{brand.shortSlogan}</small>
            </span>
          </Link>
          <nav aria-label={translate("landing.navigation.aria")} className="mp-desktop-nav">
            {navigation.map(([href, label]) => (
              <a key={href} href={href}>
                {translate(label)}
              </a>
            ))}
          </nav>
          <div className="mp-nav-actions">
            <Link to="/login" className="mp-login">
              {translate("landing.login")}
            </Link>
            <Link to="/signup" className="mp-button mp-button-small">
              {translate("landing.try")} <ArrowRight size={16} />
            </Link>
            <button
              className="mp-menu-button"
              disabled={!interactiveReady}
              aria-expanded={menuOpen}
              aria-controls="mobile-navigation"
              aria-label={translate(menuOpen ? "landing.menu.close" : "landing.menu.open")}
              onClick={() => setMenuOpen(!menuOpen)}
            >
              {menuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
        {menuOpen && (
          <nav
            id="mobile-navigation"
            aria-label={translate("landing.navigation.mobileAria")}
            className="mp-mobile-nav"
          >
            {navigation.map(([href, label]) => (
              <a key={href} href={href} onClick={() => setMenuOpen(false)}>
                {translate(label)}
                <ArrowRight size={16} />
              </a>
            ))}
          </nav>
        )}
      </header>
      <main id="main">
        {privateBeta && (
          <p className="mp-container pt-5 text-sm font-medium">
            {translate("landing.beta.invite")}
          </p>
        )}
        <Hero interactiveReady={interactiveReady} />
        <ProductPreview interactiveReady={interactiveReady} />
        <p
          className="mp-container pb-5 text-center text-sm text-muted-foreground"
          aria-label={translate("landing.examples")}
        >
          {translate("landing.examples")}
        </p>
        <Features />
        <Beta />
        <About contactAvailable={contactAvailable} />
        <FAQ />
      </main>
      <footer className="mp-container mp-footer">
        <div>
          <Link to="/" className="mp-brand">
            <span className="mp-logo">M</span>
            <span>
              {brand.productName}
              <small>{brand.shortSlogan}</small>
            </span>
          </Link>
          <p>
            © 2026 {brand.productName} · {translate("landing.footer.beta")}
          </p>
        </div>
        <div>
          <PublicInfoLinks />
          <Link to="/contact" className="mp-text-link">
            {translate("landing.footer.operator")} <ArrowRight size={16} />
          </Link>
        </div>
      </footer>
    </div>
  );
}

function Hero({ interactiveReady }: { interactiveReady: boolean }) {
  const [activeDemoIndex, setActiveDemoIndex] = useState(0);
  const [demoLanguage, setDemoLanguage] = useState<"hu" | "ro">("hu");
  const demo = LANDING_DEMOS[activeDemoIndex];

  function onProfessionKeyDown(index: number, event: ReactKeyboardEvent<HTMLButtonElement>) {
    const key = event.key;
    let next: number | undefined;
    if (key === "ArrowRight") next = (index + 1) % LANDING_DEMOS.length;
    if (key === "ArrowLeft") next = (index + LANDING_DEMOS.length - 1) % LANDING_DEMOS.length;
    if (key === "Home") next = 0;
    if (key === "End") next = LANDING_DEMOS.length - 1;
    if (next !== undefined) {
      event.preventDefault();
      setActiveDemoIndex(next);
      document.getElementById(`landing-demo-tab-${next}`)?.focus();
    }
  }

  return (
    <section className="mp-container mp-hero">
      <div className="mp-hero-copy">
        <p className="mp-pill">
          <span /> {translate("landing.badge")}
        </p>
        <h1>{translate("landing.title")}</h1>
        <p className="mp-hero-description">{translate("landing.description")}</p>
        <div className="mp-visual-request mp-hero-brief">
          <WandSparkles size={20} />
          <div>
            <small>{translate("landing.hero.ideaLabel")}</small>
            <p>„{demo.idea}”</p>
          </div>
        </div>
        <div className="mp-hero-actions">
          <Link to="/signup" className="mp-button">
            {translate("landing.hero.tryFree")} <ArrowRight size={18} />
          </Link>
          <a href="#preview" className="mp-text-link">
            {translate("landing.hero.how")} <ArrowDown size={17} />
          </a>
        </div>
        <p className="mp-micro">
          <Check size={15} /> {translate("landing.hero.noCard")} <span>·</span>{" "}
          {translate("landing.hero.noConnection")}
        </p>
      </div>
      <div className="mp-hero-visual">
        <div className="mp-visual-heading">
          <span>
            <Sparkles size={17} /> {translate("landing.hero.previewTitle")}
          </span>
          <span className="mp-window-dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        </div>
        <div className="mp-demo-switches">
          <div
            className="mp-demo-tabs"
            role="tablist"
            aria-label={translate("landing.hero.professionsAria")}
          >
            {LANDING_DEMOS.map((item, index) => (
              <button
                key={item.id}
                id={`landing-demo-tab-${index}`}
                type="button"
                role="tab"
                disabled={!interactiveReady}
                aria-selected={activeDemoIndex === index}
                aria-controls="landing-demo-panel"
                tabIndex={activeDemoIndex === index ? 0 : -1}
                onClick={() => setActiveDemoIndex(index)}
                onKeyDown={(event) => onProfessionKeyDown(index, event)}
              >
                <span aria-hidden="true">{item.emoji}</span>
                {translate(item.label)}
              </button>
            ))}
          </div>
          <div
            className="mp-demo-language"
            role="group"
            aria-label={translate("landing.hero.languageAria")}
          >
            {(["hu", "ro"] as const).map((language) => (
              <button
                key={language}
                type="button"
                aria-pressed={demoLanguage === language}
                disabled={!interactiveReady}
                onClick={() => setDemoLanguage(language)}
              >
                {language === "hu" ? "HU" : "RO"}
              </button>
            ))}
          </div>
        </div>
        <article className="mp-example-post" aria-label={translate("landing.hero.previewAria")}>
          <header>
            <span className="mp-example-avatar" aria-hidden="true">
              {demo.brand.slice(0, 1)}
            </span>
            <div>
              <strong>{demo.brand}</strong>
              <small>{translate("landing.hero.exampleNetwork")}</small>
            </div>
          </header>
          <div
            className="mp-demo-copy"
            id="landing-demo-panel"
            role="tabpanel"
            aria-labelledby={`landing-demo-tab-${activeDemoIndex}`}
            tabIndex={0}
          >
            <div className="mp-demo-prompt">
              <small>{translate("landing.hero.ideaLabel")}</small>
              <p>„{demo.idea}”</p>
            </div>
            <div className="mp-demo-result">
              <small>{translate("landing.hero.resultLabel")}</small>
              <p key={`${demo.id}-${demoLanguage}`} lang={demoLanguage} aria-live="polite">
                {demo.text[demoLanguage]}
              </p>
            </div>
          </div>
        </article>
        <div className="mp-visual-foot">
          <span>
            <Check size={16} /> {translate("landing.hero.previewEditable")}
          </span>
          <small>{translate("landing.hero.previewNote")}</small>
        </div>
      </div>
    </section>
  );
}

function ProductPreview({ interactiveReady }: { interactiveReady: boolean }) {
  const [active, setActive] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const lightboxRef = useRef<HTMLDialogElement>(null);
  const preview = PREVIEWS[active];

  useEffect(() => {
    if (lightboxOpen && lightboxRef.current && !lightboxRef.current.open)
      lightboxRef.current.showModal();
  }, [lightboxOpen]);

  return (
    <section id="preview" className="mp-section mp-container">
      <div className="mp-steps mp-simple-steps" aria-label={translate("landing.steps.aria")}>
        {[
          {
            title: translate("landing.steps.idea.title"),
            text: translate("landing.steps.idea.text"),
          },
          {
            title: translate("landing.steps.review.title"),
            text: translate("landing.steps.review.text"),
          },
          {
            title: translate("landing.steps.share.title"),
            text: translate("landing.steps.share.text"),
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
          <p className="mp-eyebrow">{translate("landing.preview.sectionEyebrow")}</p>
          <h2>
            {translate("landing.preview.sectionTitle1")}
            <br />
            {translate("landing.preview.sectionTitle2")}
          </h2>
        </div>
        <p>{translate("landing.preview.simpleStart1")}</p>
      </div>
      <div
        className="mp-preview-tabs"
        role="tablist"
        aria-label={translate("landing.preview.tabsAria")}
      >
        {PREVIEWS.map(({ label, icon: Icon }, index) => (
          <button
            key={label}
            id={`preview-tab-${index}`}
            role="tab"
            aria-selected={active === index}
            disabled={!interactiveReady}
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
            {translate(label)}
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
            <p className="mp-preview-mode">
              {translate("landing.preview.badge")} · {translate(preview.mode)}
            </p>
            <h3>{translate(preview.title)}</h3>
            <p>{translate(preview.description)}</p>
          </div>
          <span>
            {translate("landing.preview.app")}
            <br />
            <strong>{translate("landing.preview.sampleCaption")}</strong>
          </span>
        </div>
        <button
          type="button"
          className="mp-preview-image-trigger"
          disabled={!interactiveReady}
          onClick={() => setLightboxOpen(true)}
          aria-label={`${translate(preview.label)} ${translate("landing.preview.openImage")}`}
        >
          <img
            src={`/images/${preview.image}`}
            width={1280}
            height={900}
            loading="lazy"
            alt={translate(preview.alt)}
          />
        </button>
      </div>
      {lightboxOpen && (
        <dialog
          ref={lightboxRef}
          className="mp-lightbox"
          aria-labelledby="mp-lightbox-title"
          onClose={() => setLightboxOpen(false)}
          onClick={(event) => {
            if (event.target === event.currentTarget) lightboxRef.current?.close();
          }}
        >
          <div className="mp-lightbox-content">
            <div className="mp-lightbox-heading">
              <h2 id="mp-lightbox-title">{translate("landing.preview.lightbox.title")}</h2>
              <button
                type="button"
                className="mp-lightbox-close"
                aria-label={translate("landing.preview.lightbox.close")}
                onClick={() => lightboxRef.current?.close()}
              >
                <X size={22} />
                <span>{translate("landing.preview.lightbox.close")}</span>
              </button>
            </div>
            <img
              src={`/images/${preview.image}`}
              alt={translate(preview.alt)}
              width={1280}
              height={900}
            />
          </div>
        </dialog>
      )}
    </section>
  );
}

function About({ contactAvailable }: { contactAvailable: boolean }) {
  return (
    <section className="mp-container mp-section mp-about" aria-labelledby="landing-about-title">
      <div>
        <p className="mp-eyebrow">{translate("landing.about.eyebrow")}</p>
        <h2 id="landing-about-title">{translate("landing.about.title")}</h2>
      </div>
      <div>
        <p>{translate(contactAvailable ? "landing.about.text" : "landing.about.textNoContact")}</p>
        <Link to="/contact" className="mp-text-link">
          {translate(contactAvailable ? "landing.about.contact" : "landing.about.contactInfo")}{" "}
          <ArrowRight size={16} />
        </Link>
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
            <p className="mp-eyebrow">{translate("landing.features.eyebrow")}</p>
            <h2>
              {translate("landing.features.title1")}
              <br />
              {translate("landing.features.title2")}
            </h2>
          </div>
        </div>
        <div className="mp-benefits">
          {[
            {
              icon: WandSparkles,
              title: translate("landing.feature.one.title"),
              text: translate("landing.feature.one.text"),
            },
            {
              icon: Palette,
              title: translate("landing.feature.two.title"),
              text: translate("landing.feature.two.text"),
            },
            {
              icon: ShieldCheck,
              title: translate("landing.feature.three.title"),
              text: translate("landing.feature.three.text"),
            },
            {
              icon: CalendarDays,
              title: translate("landing.feature.four.title"),
              text: translate("landing.feature.four.text"),
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
          <h3>{translate("landing.continuity.title")}</h3>
          <p>{translate("landing.continuity.text")}</p>
        </div>
      </div>
    </section>
  );
}

function Beta() {
  return (
    <section id="pricing" className="mp-container mp-pricing">
      <div>
        <p className="mp-eyebrow">{translate("landing.pricing.eyebrow")}</p>
        <h2>{translate("landing.pricing.title")}</h2>
        <p>{translate("landing.pricing.free")}</p>
        <p className="mp-pricing-note">{translate("landing.pricing.limit")}</p>
        <h3 className="mp-beta-exclusions">{translate("landing.pricing.exclusions")}</h3>
        <ul className="mp-beta-exclusions">
          <li>{translate("landing.pricing.noPublishing")}</li>
          <li>{translate("landing.pricing.noImageAI")}</li>
        </ul>
      </div>
      <div className="mp-price-card">
        <div className="mp-price-top">
          <span>{translate("landing.pricing.beta")}</span>
          <Sparkles size={22} />
        </div>
        <p className="mp-price">
          0 <span>{translate("landing.pricing.period")}</span>
        </p>
        <ul>
          {(
            [
              "landing.pricing.item.one",
              "landing.pricing.item.two",
              "landing.pricing.item.three",
              "landing.pricing.item.four",
            ] as const
          ).map((text) => (
            <li key={text}>
              <Check size={17} />
              {translate(text)}
            </li>
          ))}
        </ul>
        <Link to="/signup" className="mp-button">
          {translate("landing.pricing.firstPost")} <ArrowRight size={18} />
        </Link>
        <small>{translate("landing.pricing.manual")}</small>
      </div>
    </section>
  );
}

const QUESTIONS = [
  ["landing.faq.q1", "landing.faq.a1"],
  ["landing.faq.q2", "landing.faq.a2"],
  ["landing.faq.q3", "landing.faq.a3"],
  ["landing.faq.q4", "landing.faq.a4"],
  ["landing.faq.q5", "landing.faq.a5"],
  ["landing.faq.q6", "landing.faq.a6"],
  ["landing.faq.q7", "landing.faq.a7"],
  ["landing.faq.q8", "landing.faq.a8"],
] as const;
function FAQ() {
  return (
    <section id="faq" className="mp-container mp-section mp-faq">
      <div>
        <p className="mp-eyebrow">{translate("landing.faq.eyebrow")}</p>
        <h2>{translate("landing.faq.title")}</h2>
        <Link to="/contact" className="mp-text-link">
          {translate("landing.faq.contact")} <ArrowRight size={17} />
        </Link>
        <Link to="/signup" className="mp-button mp-faq-start">
          {translate("landing.hero.tryFree")} <ArrowRight size={18} />
        </Link>
      </div>
      <div>
        {QUESTIONS.map(([questionKey, answerKey]) => (
          <details key={questionKey}>
            <summary>
              {translate(questionKey)}
              <ChevronDown size={19} />
            </summary>
            <p>
              {translate(answerKey)}
              {questionKey === "landing.faq.q6" && (
                <>
                  <br />
                  <Link to="/privacy" className="mp-text-link">
                    {translate("landing.faq.privacy")} <ArrowRight size={16} />
                  </Link>
                </>
              )}
              {questionKey === "landing.faq.q8" && (
                <>
                  <br />
                  <a
                    className="mp-text-link"
                    href="https://about.fb.com/news/2024/04/metas-approach-to-labeling-ai-generated-content-and-manipulated-media/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {translate("landing.faq.meta")} <ArrowRight size={16} />
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
