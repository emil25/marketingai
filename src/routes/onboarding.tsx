import { redirectSignedInUser } from "@/lib/guest-route";
import { createFileRoute, Link } from "@tanstack/react-router";
import { SignupForm } from "@/components/signup-form";
import { useEffect, useId, useState, type HTMLAttributes } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { BUSINESS_TYPES, businessTypeLabel } from "@/lib/business-types";
import { ArrowRight, ArrowLeft, Check } from "lucide-react";
import { BusinessHoursFields } from "@/components/business-hours-fields";
import { LogoFilePicker } from "@/components/logo-file-picker";
import {
  normalizeBusinessWebsite,
  serializeBusinessHours,
  emptyBusinessHours,
} from "@/lib/onboarding-details";
import {
  ONBOARDING_TONES,
  BRAND_MOODS,
  defaultAddressing,
  brandStyleSample,
  sanitizeOnboardingDraft,
  ONBOARDING_DRAFT_KEY,
  type Addressing,
} from "@/lib/onboarding-brand";

export const Route = createFileRoute("/onboarding")({
  beforeLoad: redirectSignedInUser,
  head: () => ({
    meta: [
      { title: "Első belépés — MarketingPilot AI" },
      {
        name: "description",
        content: "Add meg a vállalkozásod kínálatát és hangnemét, és kezdd el a tartalomkészítést.",
      },
    ],
  }),
  component: Onboarding,
});
const STEPS = ["Vállalkozástípus", "Cég és kínálat", "Márka", "Fiók"] as const;
const INITIAL_DETAILS = {
  name: "",
  website: "",
  logoUrl: "",
  openingHours: "",
  address: "",
  cityRegion: "",
  offers: "",
  services: "",
  products: "",
  contactMethod: "",
  addressing: "te" as Addressing,
  audience: "",
  industry: "",
};

function Onboarding() {
  const [step, setStep] = useState(0);
  const [businessType, setBusinessType] = useState("");
  const [tone, setTone] = useState("Barátságos");
  const [mood, setMood] = useState<"" | (typeof BRAND_MOODS)[number]>("");
  const [color, setColor] = useState("#ed674d");
  const [addressingTouched, setAddressingTouched] = useState(false);
  const [hours, setHours] = useState(emptyBusinessHours);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState("");
  const [error, setError] = useState("");
  const [nameError, setNameError] = useState("");
  const [logoPending, setLogoPending] = useState(false);
  const [details, setDetails] = useState(INITIAL_DETAILS);
  const [draftReady, setDraftReady] = useState(false);
  const [draftNotice, setDraftNotice] = useState("");
  const [draftCompleted, setDraftCompleted] = useState(false);
  const setDetail = (key: keyof typeof details, value: string) =>
    setDetails((current) => ({ ...current, [key]: value }));

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(ONBOARDING_DRAFT_KEY);
      const draft = saved ? sanitizeOnboardingDraft(JSON.parse(saved)) : null;
      if (draft) {
        setStep(draft.step);
        setBusinessType(draft.businessType);
        setTone(draft.tone);
        setMood(draft.mood as typeof mood);
        setColor(draft.color);
        setAddressingTouched(draft.addressingTouched);
        setDetails((current) => ({
          ...current,
          ...draft.details,
          addressing: draft.details.addressing as Addressing,
        }));
        if (draft.hours)
          setHours(emptyBusinessHours().map((day, index) => ({ ...day, ...draft.hours![index] })));
        if (draft.step > 0 || draft.businessType || draft.details.name || draft.details.industry)
          setDraftNotice(
            `A félbehagyott szöveges adatokat visszatöltöttük.${draft.hadLogo ? " A logófájlt válaszd ki újra a Márka lépésben." : ""}`,
          );
      } else if (saved) sessionStorage.removeItem(ONBOARDING_DRAFT_KEY);
    } catch {
      setDraftNotice(
        "Ebben a böngészőben a piszkozat nem tölthető vissza. A kitöltést folytathatod.",
      );
    }
    setDraftReady(true);
  }, []);
  useEffect(() => {
    if (!draftReady || draftCompleted) return;
    const timer = setTimeout(() => {
      try {
        const draft = sanitizeOnboardingDraft({
          version: 1,
          savedAt: Date.now(),
          step,
          businessType,
          tone,
          mood,
          color,
          addressingTouched,
          details,
          hours,
          hadLogo: !!logoFile,
        });
        if (draft) sessionStorage.setItem(ONBOARDING_DRAFT_KEY, JSON.stringify(draft));
      } catch {
        setDraftNotice(
          "A böngésző nem engedi a piszkozat megőrzését; újratöltéskor elveszhetnek az adatok.",
        );
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [
    draftReady,
    draftCompleted,
    step,
    businessType,
    tone,
    mood,
    color,
    addressingTouched,
    details,
    hours,
    logoFile,
  ]);
  useEffect(() => {
    if (!logoFile) {
      setLogoPreview("");
      return;
    }
    const url = URL.createObjectURL(logoFile);
    setLogoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [logoFile]);

  function chooseType(type: string) {
    setBusinessType(type);
    setError("");
    setDetails((current) => ({
      ...current,
      industry: type === "other" ? current.industry : "",
      addressing: addressingTouched ? current.addressing : defaultAddressing(type),
    }));
  }
  function next() {
    setError("");
    try {
      if (step === 0) {
        if (!businessType)
          throw new Error(
            "Válassz vállalkozástípust, vagy lépj tovább a Később választok gombbal.",
          );
        if (businessType === "other" && !details.industry.trim())
          throw new Error("Írd le röviden, mivel foglalkozol.");
      }
      if (step === 1) {
        if (details.name.trim().length < 2) {
          setNameError("Add meg a cég nevét (legalább 2 karakter).");
          document.getElementById("onboarding-name")?.focus();
          return;
        }
        const website = normalizeBusinessWebsite(details.website);
        const openingHours = serializeBusinessHours(hours);
        setDetails((current) => ({ ...current, website, openingHours }));
      }
      if (step === 2 && !/^#[0-9a-f]{6}$/i.test(color))
        throw new Error("Adj meg érvényes színkódot, például #ed674d.");
      setStep((current) => Math.min(STEPS.length - 1, current + 1));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Ellenőrizd az adatokat.");
    }
  }
  return (
    <div
      className="theme-marketingpilot-v2 public-site min-h-screen gradient-hero"
      style={{ backgroundColor: "var(--background)" }}
    >
      <div className="mx-auto max-w-3xl px-5 py-8 sm:px-6 sm:py-10">
        <Link to="/" className="mb-6 inline-flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-xl gradient-brand text-primary-foreground font-bold">
            M
          </div>
          <span className="font-semibold tracking-tight">MarketingPilot AI</span>
        </Link>
        <div className="mb-4 flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {step + 1}. lépés / {STEPS.length}
          </span>
          <span>{STEPS[step]}</span>
        </div>
        <Progress value={((step + 1) / STEPS.length) * 100} className="mb-6 h-1.5" />
        <div className="glass-strong rounded-3xl p-5 sm:p-8">
          {step === 0 && (
            <>
              <H
                title="Milyen vállalkozásod van?"
                sub="Válassz egyet; ehhez igazítjuk az ötleteket és a gyorsindítókat."
              />
              <div
                className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3"
                role="group"
                aria-label="Vállalkozástípus kiválasztása"
              >
                {BUSINESS_TYPES.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    aria-pressed={businessType === item.value}
                    onClick={() => chooseType(item.value)}
                    className={`flex min-h-16 items-center justify-between gap-2 rounded-2xl border p-3 text-left text-sm transition hover:border-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${businessType === item.value ? "border-brand bg-brand-soft" : "bg-card"}`}
                  >
                    <span className="font-medium">{item.label}</span>
                    {businessType === item.value && (
                      <Check className="h-4 w-4 shrink-0" aria-label="Kiválasztva" />
                    )}
                  </button>
                ))}
              </div>
              {businessType === "other" && (
                <div className="mt-4">
                  <Field
                    label="Mivel foglalkozol? *"
                    placeholder="pl. Kerékpárkölcsönzés és túravezetés"
                    value={details.industry}
                    onChange={(value) => setDetail("industry", value)}
                    maxLength={160}
                    required
                  />
                </div>
              )}
            </>
          )}
          {step === 1 && (
            <>
              <H
                title="A céged és a kínálatod"
                sub="A konkrét termékekből és ajánlatból lesz igazán saját a posztod."
              />
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <Field
                  id="onboarding-name"
                  label="Cég neve *"
                  value={details.name}
                  onChange={(value) => {
                    setDetail("name", value);
                    if (value.trim().length >= 2) setNameError("");
                  }}
                  maxLength={160}
                  autoComplete="organization"
                  required
                  error={nameError}
                  placeholder="A vállalkozásod neve"
                />
                <Field
                  label="Város / régió (opcionális)"
                  value={details.cityRegion}
                  onChange={(value) => setDetail("cityRegion", value)}
                  maxLength={160}
                  autoComplete="address-level2"
                  placeholder="pl. Csíkszereda"
                />
              </div>
              <div className="mt-5 space-y-4">
                <div>
                  <Label htmlFor="onboarding-products">Fő termékek (3–5 konkrét tétel)</Label>
                  <Textarea
                    id="onboarding-products"
                    value={details.products}
                    maxLength={4000}
                    onChange={(event) => setDetail("products", event.target.value)}
                    className="mt-2 min-h-20"
                    placeholder="pl. Kovászos kenyér, kakaós csiga, sajtos pogácsa — csak ami valóban kapható"
                  />
                </div>
                <div>
                  <Label htmlFor="onboarding-services">Szolgáltatások (ha van)</Label>
                  <Textarea
                    id="onboarding-services"
                    value={details.services}
                    maxLength={4000}
                    onChange={(event) => setDetail("services", event.target.value)}
                    className="mt-2 min-h-20"
                    placeholder="pl. Előrendelés, helyben fogyasztás, kiszállítás — csak ami elérhető"
                  />
                </div>
                <div>
                  <Label htmlFor="onboarding-offers">Aktuális ajánlat (opcionális)</Label>
                  <Textarea
                    id="onboarding-offers"
                    value={details.offers}
                    maxLength={4000}
                    onChange={(event) => setDetail("offers", event.target.value)}
                    className="mt-2 min-h-20"
                    placeholder="Valós ajánlat, árral és időszakkal, ha ismert"
                  />
                </div>
                <Field
                  label="Kinek szól? (opcionális)"
                  value={details.audience}
                  onChange={(value) => setDetail("audience", value)}
                  maxLength={2000}
                  placeholder="pl. Környékbeli dolgozók és családok"
                />
              </div>
              <details className="mt-5 rounded-xl border p-3">
                <summary className="cursor-pointer text-sm font-medium">
                  Elérhetőség, cím és nyitvatartás (opcionális)
                </summary>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <Field
                    label="Weboldal"
                    placeholder="pelda.ro"
                    value={details.website}
                    onChange={(value) => setDetail("website", value)}
                    maxLength={500}
                    inputMode="url"
                    autoComplete="url"
                    hint="A https:// előtagot ránk bízhatod."
                  />
                  <Field
                    label="Telefon / e-mail / Facebook-oldal"
                    placeholder="pl. +40…; hello@pelda.ro; facebook.com/…"
                    value={details.contactMethod}
                    onChange={(value) => setDetail("contactMethod", value)}
                    maxLength={1000}
                  />
                  <Field
                    label="Pontos cím"
                    placeholder="Utca, házszám"
                    value={details.address}
                    onChange={(value) => setDetail("address", value)}
                    maxLength={1000}
                    autoComplete="street-address"
                  />
                </div>
                <BusinessHoursFields value={hours} onChange={setHours} />
              </details>
              <p className="mt-3 text-sm text-muted-foreground">
                Címmel, nyitvatartással és elérhetőséggel kevesebb helykitöltőt kell pótolnod.
              </p>
            </>
          )}
          {step === 2 && (
            <>
              <H
                title="Így szóljon a márkád"
                sub="Egy hangnemet és egy megszólítást válassz. Később is módosíthatod."
              />
              <div className="mt-5 space-y-5">
                <div>
                  <Label>Hangnem · egy választható</Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {ONBOARDING_TONES.map((item) => (
                      <button
                        type="button"
                        key={item}
                        aria-pressed={tone === item}
                        onClick={() => setTone(item)}
                        className={`flex min-h-11 items-center gap-2 rounded-full border px-4 py-2 text-sm ${tone === item ? "border-brand bg-brand-soft" : "bg-card"}`}
                      >
                        {item}
                        {tone === item && <Check className="h-3.5 w-3.5" />}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label htmlFor="onboarding-addressing">Megszólítás</Label>
                  <select
                    id="onboarding-addressing"
                    value={details.addressing}
                    onChange={(event) => {
                      setDetail("addressing", event.target.value);
                      setAddressingTouched(true);
                    }}
                    className="mt-2 min-h-11 w-full rounded-md border bg-background px-3 text-sm"
                  >
                    <option value="te">Tegezve (te)</option>
                    <option value="Ön">Magázva (Ön)</option>
                    <option value="ti">Többes szám (ti)</option>
                  </select>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Ügyvédnél és könyvelőnél magázást, más típusnál tegezést ajánlunk.
                  </p>
                </div>
                <div>
                  <Label htmlFor="onboarding-mood">Hangulat (opcionális) · egy választható</Label>
                  <select
                    id="onboarding-mood"
                    value={mood}
                    onChange={(event) => setMood(event.target.value as typeof mood)}
                    className="mt-2 min-h-11 w-full rounded-md border bg-background px-3 text-sm"
                  >
                    <option value="">Nincs külön megkötés</option>
                    {BRAND_MOODS.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="onboarding-color">Márkaszín</Label>
                  <div className="mt-2 flex items-center gap-3">
                    <input
                      type="color"
                      aria-label="Saját márkaszín kiválasztása"
                      value={/^#[0-9a-f]{6}$/i.test(color) ? color : "#ed674d"}
                      onChange={(event) => setColor(event.target.value)}
                      className="h-11 w-14 cursor-pointer rounded-md border p-1"
                    />
                    <Input
                      id="onboarding-color"
                      value={color}
                      onChange={(event) => setColor(event.target.value)}
                      maxLength={7}
                      className="h-11 max-w-40"
                      placeholder="#ed674d"
                    />
                  </div>
                </div>
                <div
                  className="rounded-2xl border bg-card p-4"
                  style={{
                    borderLeft: `4px solid ${/^#[0-9a-f]{6}$/i.test(color) ? color : "#ed674d"}`,
                  }}
                >
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide">
                    Élő stílusminta
                  </p>
                  <p aria-live="polite" className="whitespace-pre-line text-sm leading-relaxed">
                    {brandStyleSample(details.name, tone, details.addressing, mood)}
                  </p>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Szemléltető mondatok, nem AI-generált poszt.
                  </p>
                </div>
                <div>
                  <Label>Logó (opcionális)</Label>
                  <LogoFilePicker
                    selectedFile={logoFile}
                    onSelected={(file) => {
                      setLogoFile(file);
                      setDetail("logoUrl", "");
                    }}
                    onError={setError}
                    onPendingChange={setLogoPending}
                  />
                  {logoPreview && (
                    <img
                      src={logoPreview}
                      alt="Kiválasztott logó előnézete"
                      className="mt-2 h-16 max-w-full rounded-lg object-contain"
                    />
                  )}
                  <details className="mt-2 text-sm">
                    <summary className="cursor-pointer">Inkább képhivatkozást adok meg</summary>
                    <Field
                      label="Logó webcíme"
                      placeholder="https://…"
                      value={details.logoUrl}
                      onChange={(value) => {
                        setDetail("logoUrl", value);
                        if (value) setLogoFile(null);
                      }}
                      maxLength={1000}
                    />
                  </details>
                </div>
              </div>
            </>
          )}
          {step === 3 && (
            <>
              <H
                title="Hozd létre a fiókod"
                sub={`${details.name || "A vállalkozásod"} · ${businessType ? businessTypeLabel(businessType) : "Később választott típus"}`}
              />
              <SignupForm
                embedded
                businessType={businessType || "other"}
                brandDetails={{
                  ...details,
                  industry: businessType === "other" ? details.industry : "",
                  tone,
                  mood,
                  color,
                }}
                logoFile={logoFile}
                onRegistered={() => {
                  setDraftCompleted(true);
                  try {
                    sessionStorage.removeItem(ONBOARDING_DRAFT_KEY);
                  } catch {
                    /* Storage can be unavailable. Registration is already successful. */
                  }
                }}
              />
            </>
          )}
          {error && (
            <p role="alert" className="mt-3 text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <Button
              variant="ghost"
              className="min-h-11"
              disabled={step === 0 || logoPending || draftCompleted}
              onClick={() => {
                setError("");
                setStep((current) => Math.max(0, current - 1));
              }}
            >
              <ArrowLeft className="mr-1 h-4 w-4" />
              Vissza
            </Button>
            {step === 0 && (
              <Button
                variant="link"
                className="min-h-11 px-0 text-sm"
                onClick={() => {
                  chooseType("");
                  setStep(1);
                }}
              >
                Később választok
              </Button>
            )}
            {step < STEPS.length - 1 && (
              <Button className="min-h-11 rounded-full" disabled={logoPending} onClick={next}>
                Tovább
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            )}
          </div>
          {step === 0 && (
            <Link
              to="/signup"
              className="mt-3 block text-center text-sm underline underline-offset-4"
            >
              Kihagyom a beállítást, rögtön regisztrálok
            </Link>
          )}
        </div>
        {step === 0 && (
          <p className="mt-4 text-center text-sm">
            Van már fiókod?{" "}
            <Link to="/login" className="font-medium underline">
              Belépés
            </Link>
          </p>
        )}
        <p className="mt-4 text-sm text-muted-foreground">
          A szöveges piszkozatot ezen a böngészőlapon ideiglenesen megőrizzük. Jelszót és logófájlt
          nem mentünk a böngészőtárba.
        </p>
        {draftNotice && (
          <p role="status" className="mt-2 text-sm">
            {draftNotice}
          </p>
        )}
      </div>
    </div>
  );
}
function H({ title, sub }: { title: string; sub: string }) {
  return (
    <div>
      <h1 className="font-display text-3xl tracking-tight md:text-4xl">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{sub}</p>
    </div>
  );
}
function Field({
  label,
  placeholder,
  value,
  onChange,
  maxLength,
  required = false,
  hint,
  error,
  autoComplete,
  inputMode,
  id: providedId,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
  required?: boolean;
  hint?: string;
  error?: string;
  autoComplete?: string;
  inputMode?: HTMLAttributes<HTMLInputElement>["inputMode"];
  id?: string;
}) {
  const generatedId = useId();
  const id = providedId || generatedId;
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        className="mt-2"
        placeholder={placeholder}
        value={value}
        maxLength={maxLength}
        required={required}
        autoComplete={autoComplete}
        inputMode={inputMode}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1 text-sm text-destructive">
          {error}
        </p>
      )}
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-sm text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}
