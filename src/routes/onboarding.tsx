import { getCurrentUser, completeOnboarding } from "@/lib/auth.functions";
import { useServerFn } from "@tanstack/react-start";
import { createFileRoute, Link } from "@tanstack/react-router";
import { SignupForm } from "@/components/signup-form";
import { useEffect, useId, useState, type HTMLAttributes } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { ArrowRight, ArrowLeft } from "lucide-react";
import { translate } from "@/i18n";
import { brandForLocale, DEFAULT_MARKET_LOCALE } from "@/config/brand";
import { validateBusinessTypeDetails } from "@/lib/onboarding-details";
import { sanitizeOnboardingDraft, ONBOARDING_DRAFT_KEY } from "@/lib/onboarding-brand";
import type { Addressing } from "@/lib/onboarding-brand";

export const Route = createFileRoute("/onboarding")({
  loader: () => getCurrentUser(),
  head: () => ({
    meta: [
      { title: `Első belépés — ${brandForLocale(DEFAULT_MARKET_LOCALE).productName}` },
      {
        name: "description",
        content: "Add meg a vállalkozásod nevét és kínálatát, majd készítsd el az első posztodat.",
      },
    ],
  }),
  component: Onboarding,
});
const STEPS = ["Vállalkozásod", "Fiók"] as const;
const INITIAL_DETAILS = {
  name: "",
  website: "",
  logoUrl: "",
  openingHours: "",
  address: "",
  houseNumber: "",
  county: "",
  phone: "",
  cityNameMode: "hu",
  localPhrases: "",
  localEvents: "",
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
  const productName = brandForLocale(DEFAULT_MARKET_LOCALE).productName;
  const account = Route.useLoaderData();
  const ownedBrand = account?.activeBrand;
  const profile = ownedBrand?.profile;
  const complete = useServerFn(completeOnboarding);
  const [saving, setSaving] = useState(false);
  const draftKey = account ? `${ONBOARDING_DRAFT_KEY}-${account.user.id}` : ONBOARDING_DRAFT_KEY;
  const steps = account ? ["Vállalkozásod", "Kezdés"] : STEPS;
  const [step, setStep] = useState(0);
  const [businessType, setBusinessType] = useState(profile?.businessType || "local_business");
  const [approvedClaims, setApprovedClaims] = useState<string[]>(profile?.approvedClaims ?? []);
  const [tone, setTone] = useState(profile?.tone || "Barátságos");
  const [mood, setMood] = useState<"" | "Letisztult" | "Prémium" | "Lendületes">("");
  const [color, setColor] = useState(profile?.colors[0] || "#ed674d");
  const [error, setError] = useState("");
  const [nameError, setNameError] = useState("");
  const [details, setDetails] = useState(() => ({
    ...INITIAL_DETAILS,
    ...(ownedBrand
      ? {
          name: ownedBrand.name,
          website: ownedBrand.website,
          cityRegion: ownedBrand.cityRegion,
          offers: ownedBrand.offers,
          products: ownedBrand.products,
          services: ownedBrand.services,
          audience: ownedBrand.audience,
          industry: ownedBrand.industry,
          address: profile?.address || "",
          houseNumber: profile?.houseNumber || "",
          county: profile?.county || "",
          phone: profile?.phone || "",
          cityNameMode: profile?.cityNameMode || "hu",
          localPhrases: profile?.localPhrases || "",
          localEvents: profile?.localEvents || "",
          openingHours: profile?.openingHours || "",
          logoUrl: profile?.logoUrl || "",
          addressing: profile?.aiGuardrails.includes("(Ön)")
            ? ("Ön" as Addressing)
            : profile?.aiGuardrails.includes("(ti)")
              ? ("ti" as Addressing)
              : ("te" as Addressing),
        }
      : {}),
  }));
  const [draftReady, setDraftReady] = useState(false);
  const [draftNotice, setDraftNotice] = useState("");
  const [draftCompleted, setDraftCompleted] = useState(false);
  const setDetail = (key: keyof typeof details, value: string) =>
    setDetails((current) => ({ ...current, [key]: value }));

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(draftKey);
      const draft = saved ? sanitizeOnboardingDraft(JSON.parse(saved)) : null;
      if (draft) {
        // Old onboarding steps 0–1 were profile setup; step 2 onward was account creation.
        setStep(draft.step >= 2 ? 1 : 0);
        setBusinessType(draft.businessType || "local_business");
        setApprovedClaims(draft.approvedClaims);
        setTone(draft.tone);
        setMood(draft.mood as typeof mood);
        setColor(draft.color);
        setDetails((current) => ({
          ...current,
          ...draft.details,
          addressing: draft.details.addressing as Addressing,
        }));
        if (draft.step > 0 || draft.businessType || draft.details.name || draft.details.industry)
          setDraftNotice(
            "A félbehagyott szöveges adatokat visszatöltöttük.",
          );
      } else if (saved) sessionStorage.removeItem(draftKey);
    } catch {
      setDraftNotice(
        "Ebben a böngészőben a piszkozat nem tölthető vissza. A kitöltést folytathatod.",
      );
    }
    setDraftReady(true);
  }, [draftKey]);
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
          details,
          approvedClaims,
        });
        if (draft) sessionStorage.setItem(draftKey, JSON.stringify(draft));
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
    details,
    approvedClaims,
    draftKey,
  ]);
  function next() {
    setError("");
    try {
      if (step === 0) {
        if (details.name.trim().length < 2) {
          setNameError("Add meg a vállalkozás nevét (legalább 2 karakter).");
          document.getElementById("onboarding-name")?.focus();
          return;
        }
        if (details.products.trim().length < 5) {
          setError("Írd le röviden, mit kínálsz. Egy-két konkrét példa elég.");
          document.getElementById("onboarding-products")?.focus();
          return;
        }
        validateBusinessTypeDetails(businessType, details.industry, details.products);
      }
      setStep((current) => Math.min(STEPS.length - 1, current + 1));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Ellenőrizd az adatokat.");
    }
  }
  async function finish() {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      await complete({
        data: {
          businessType: businessType || "local_business",
          brandDetails: {
            ...details,
            approvedClaims,
            industry: businessType === "other" ? details.industry : "",
            tone,
            mood,
            color,
          },
        },
      });
      setDraftCompleted(true);
      try {
        sessionStorage.removeItem(draftKey);
      } catch {
        /* Optional browser draft. */
      }
      window.location.assign("/app/posts/new?first=1");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "A mentés nem sikerült. Próbáld újra.");
    } finally {
      setSaving(false);
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
          <span className="font-semibold tracking-tight">{productName}</span>
        </Link>
        <div className="mb-4 flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {step + 1}. lépés / {STEPS.length}
          </span>
          <span>{steps[step]}</span>
        </div>
        <Progress
          aria-label={`Beállítás: ${step + 1}. lépés a ${STEPS.length} közül`}
          value={((step + 1) / STEPS.length) * 100}
          className="mb-6 h-1.5"
        />
        <div className="glass-strong rounded-3xl p-5 sm:p-8">
          {step === 0 && (
            <>
              <H
                title="Induljunk az első poszttal"
                sub="A vállalkozás neve és néhány konkrét kínálat elég. A többi adatot később is megadhatod."
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
                  label={translate("onboarding.city")}
                  value={details.cityRegion}
                  onChange={(value) => setDetail("cityRegion", value)}
                  maxLength={160}
                  autoComplete="address-level2"
                  placeholder="pl. Csíkszereda"
                />
              </div>
              <div className="mt-5">
                <Label htmlFor="onboarding-products">Mit kínálsz? *</Label>
                <Textarea
                  id="onboarding-products"
                  value={details.products}
                  maxLength={4000}
                  required
                  aria-invalid={!!error && error.includes("mit kínálsz")}
                  aria-describedby="onboarding-products-help"
                  onChange={(event) => setDetail("products", event.target.value)}
                  className="mt-2 min-h-24"
                  placeholder="Például: kovászos kenyér és kakaós csiga"
                />
                <p id="onboarding-products-help" className="mt-1 text-sm text-muted-foreground">
                  Írj 1–5 konkrét terméket vagy szolgáltatást. A típust, hangnemet és további adatokat később is beállíthatod.
                </p>
              </div>
              {businessType === "other" && !details.industry.trim() && (
                <div className="mt-4">
                  <Field
                    label="Mivel foglalkozol? Egy-két mondatban *"
                    placeholder="pl. Kerékpárszervizt és túravezetést vállalok a környéken"
                    value={details.industry}
                    onChange={(value) => setDetail("industry", value)}
                    maxLength={500}
                    required
                  />
                </div>
              )}
            </>
          )}
          {step === 1 && account && (
            <div className="space-y-5">
              <H
                title="Készülhet az első posztod"
                sub="Minden beállítást később is módosíthatsz. Most már indulhat a poszt."
              />
              <p className="rounded-xl border bg-card p-4">
                <strong>{details.name}</strong>
                <br />
                {details.products}
              </p>
              <Button
                className="min-h-11 w-full"
                disabled={saving}
                onClick={() => void finish()}
              >
                {saving ? "Mentés…" : "Első poszt elkészítése"}
              </Button>
            </div>
          )}
          {step === 1 && !account && (
            <>
              <H
                title="Hozd létre a fiókod"
                sub={`${details.name || "A vállalkozásod"} · az első posztod alapadatai készen állnak.`}
              />
              <SignupForm
                embedded
                businessType={businessType || "local_business"}
                brandDetails={{
                  ...details,
                  approvedClaims,
                  industry: businessType === "other" ? details.industry : "",
                  tone,
                  mood,
                  color,
                }}
                onRegistered={() => {
                  setDraftCompleted(true);
                  try {
                    sessionStorage.removeItem(draftKey);
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
              disabled={step === 0 || draftCompleted || saving}
              onClick={() => {
                setError("");
                setStep((current) => Math.max(0, current - 1));
              }}
            >
              <ArrowLeft className="mr-1 h-4 w-4" />
              Vissza
            </Button>
            {step < STEPS.length - 1 && (
              <Button
                className="min-h-11 rounded-full"
                disabled={!draftReady}
                onClick={next}
              >
                Tovább
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        {step === 0 && !account && (
          <p className="mt-4 text-center text-sm">
            Van már fiókod?{" "}
            <Link to="/login" className="font-medium underline">
              Belépés
            </Link>
          </p>
        )}
        <p className="mt-4 text-sm text-muted-foreground">
          A megadott adatokat ezen a böngészőlapon ideiglenesen megőrizzük. Jelszót nem mentünk a böngészőtárba.
        </p>
        {draftNotice && (
          <p role="status" className="mt-2 text-sm">
            {draftNotice}
            {draftNotice.startsWith("A félbehagyott") && (
              <Button
                type="button"
                variant="ghost"
                className="ml-2"
                onClick={() => {
                  setStep(0);
                  setBusinessType("local_business");
                  setTone("Barátságos");
                  setMood("");
                  setColor("#ed674d");
                  setDetails(INITIAL_DETAILS);
                  setDraftNotice("");
                  setError("");
                  setNameError("");
                  try {
                    sessionStorage.removeItem(draftKey);
                  } catch {
                    /* Browser storage can be unavailable. */
                  }
                }}
              >
                Újrakezdem
              </Button>
            )}
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
