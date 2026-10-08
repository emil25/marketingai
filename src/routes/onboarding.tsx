import { redirectSignedInUser } from "@/lib/guest-route";
import { createFileRoute, Link } from "@tanstack/react-router";
import { SignupForm } from "@/components/signup-form";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { TONES } from "@/lib/marketing-config";
import { BUSINESS_TYPES } from "@/lib/business-types";
import { ArrowRight, ArrowLeft, Sparkles } from "lucide-react";

export const Route = createFileRoute("/onboarding")({
  beforeLoad: redirectSignedInUser,
  head: () => ({
    meta: [
      { title: "Első belépés — MarketingPilot AI" },
      {
        name: "description",
        content: "3 perces varázsló: cégadatok, márka, hangnem — és kész a marketinged.",
      },
      { property: "og:title", content: "Onboarding — MarketingPilot AI" },
      { property: "og:description", content: "Töltsd fel a márkádat 3 perc alatt." },
    ],
  }),
  component: Onboarding,
});

const STEPS = ["Vállalkozástípus", "Cégadatok", "Csatornák", "Ajánlat", "Márka", "Fiók"] as const;

function Onboarding() {
  const [step, setStep] = useState(0);
  const [businessType, setBusinessType] = useState("other");
  const [tone, setTone] = useState("Barátságos");
  const [color, setColor] = useState("#7c3aed");
  const [details, setDetails] = useState({
    name: "",
    website: "",
    logoUrl: "",
    openingHours: "",
    address: "",
    cityRegion: "",
    offers: "",
    services: "",
    products: "",
  });
  const setDetail = (key: keyof typeof details, value: string) =>
    setDetails((current) => ({ ...current, [key]: value }));
  const pct = ((step + 1) / STEPS.length) * 100;

  return (
    <div className="theme-marketingpilot-v2 public-site min-h-screen gradient-hero">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <Link to="/" className="mb-8 inline-flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-xl gradient-brand text-primary-foreground font-bold">
            M
          </div>
          <span className="font-semibold tracking-tight">MarketingPilot AI</span>
        </Link>

        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4">
          <div>
            <p className="font-semibold">Van már fiókod?</p>
            <p className="text-sm text-muted-foreground">
              Lépj be, a korábbi cégbeállításaid megmaradnak.
            </p>
          </div>
          <Button asChild>
            <Link to="/login">Belépés a munkatérbe</Link>
          </Button>
          <Link to="/signup" className="text-sm font-medium underline underline-offset-4">
            Új fiók – beállítás később
          </Link>
        </div>
        <div className="mb-6 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {step + 1}. lépés / {STEPS.length}
          </span>
          <span>{STEPS[step]}</span>
        </div>
        <Progress value={pct} className="mb-8 h-1.5" />

        <div className="glass-strong rounded-3xl p-8">
          {step === 0 && (
            <>
              <H
                title="Milyen vállalkozásod van?"
                sub="Ez alapján személyre szabjuk az AI ajánlásokat."
              />
              <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3">
                {BUSINESS_TYPES.map((item) => (
                  <button
                    key={item.value}
                    onClick={() => setBusinessType(item.value)}
                    className={`rounded-2xl border p-4 text-left text-sm transition hover:border-brand ${businessType === item.value ? "border-brand bg-brand-soft" : "bg-card"}`}
                  >
                    <div className="font-medium">{item.label}</div>
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <H title="Cégadatok" sub="Néhány alapadat a márkáról." />
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <Field
                  value={details.name}
                  onChange={(value) => setDetail("name", value)}
                  maxLength={160}
                  label="Cég neve"
                  placeholder="pl. A vállalkozás neve"
                />
                <Field
                  value={details.website}
                  onChange={(value) => setDetail("website", value)}
                  maxLength={500}
                  label="Weboldal"
                  placeholder="pelda.hu"
                />
                <Field
                  value={details.logoUrl}
                  onChange={(value) => setDetail("logoUrl", value)}
                  maxLength={1000}
                  label="Logó URL (opcionális)"
                  placeholder="https://…"
                />
                <Field
                  value={details.address}
                  onChange={(value) => setDetail("address", value)}
                  maxLength={1000}
                  label="Pontos cím (opcionális)"
                  placeholder="Utca, házszám"
                />
                <Field
                  value={details.cityRegion}
                  onChange={(value) => setDetail("cityRegion", value)}
                  maxLength={160}
                  label="Város / régió (opcionális)"
                  placeholder="pl. Csíkszereda"
                />
                <Field
                  value={details.openingHours}
                  onChange={(value) => setDetail("openingHours", value)}
                  maxLength={1000}
                  label="Nyitvatartás (opcionális)"
                  placeholder="H–V: 11:00–22:00"
                />
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <H
                title="Kösd össze a csatornákat"
                sub="A regisztráció után a Csatornák oldalon láthatod az elérhető kapcsolódási lehetőségeket."
              />
              <div className="mt-6 grid gap-3 md:grid-cols-2">
                {[
                  "Facebook oldal",
                  "Instagram fiók",
                  "Google Cégprofil",
                  "TikTok",
                  "YouTube",
                  "Hírlevél lista",
                ].map((c) => (
                  <div
                    key={c}
                    className="flex items-center justify-between rounded-2xl border bg-card p-4"
                  >
                    <span className="text-sm font-medium">{c}</span>
                    <span className="text-xs text-muted-foreground">Regisztráció után</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <H
                title="Termékek és szolgáltatások"
                sub="Sorolj fel párat — az AI ez alapján tervez."
              />
              <div className="mt-6 grid gap-4">
                <div>
                  <Label htmlFor="onboarding-services">Szolgáltatások</Label>
                  <Textarea
                    id="onboarding-services"
                    maxLength={4000}
                    value={details.services}
                    onChange={(event) => setDetail("services", event.target.value)}
                    placeholder="Írd le röviden a szolgáltatásaidat…"
                    className="mt-2 min-h-24"
                  />
                </div>
                <div>
                  <Label htmlFor="onboarding-products">Termékek / kiemelt tételek</Label>
                  <Textarea
                    id="onboarding-products"
                    maxLength={4000}
                    value={details.products}
                    onChange={(event) => setDetail("products", event.target.value)}
                    placeholder="Sorold fel a kiemelt termékeidet vagy ajánlataidat…"
                    className="mt-2 min-h-24"
                  />
                </div>
                <div>
                  <Label htmlFor="onboarding-offers">Aktuális ajánlat (opcionális)</Label>
                  <Textarea
                    id="onboarding-offers"
                    maxLength={4000}
                    value={details.offers}
                    onChange={(event) => setDetail("offers", event.target.value)}
                    placeholder="Csak valóban elérhető ajánlat, árral és időszakkal, ha ismert."
                    className="mt-2"
                  />
                </div>
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <H title="Márka" sub="Színek és hangnem — hogy minden poszt neked hangozzon." />
              <div className="mt-6 grid gap-6">
                <div>
                  <Label>Fő márkaszín</Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {["#7c3aed", "#0ea5e9", "#22c55e", "#f59e0b", "#ef4444", "#111827"].map((c) => (
                      <button
                        key={c}
                        onClick={() => setColor(c)}
                        className={`h-10 w-10 rounded-2xl border-2 transition ${color === c ? "border-foreground scale-110" : "border-transparent"}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <Label>Kommunikáció stílusa</Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {TONES.map((t) => (
                      <button
                        key={t}
                        onClick={() => setTone(t)}
                        className={`rounded-full border px-4 py-2 text-sm transition ${tone === t ? "border-brand bg-brand-soft" : "bg-card"}`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl bg-brand-soft p-4 text-sm">
                  <Sparkles className="mb-1 h-4 w-4" />
                  Előnézet: a mentett munkatérben az AI a saját márkaadataidból készít tervet.
                </div>
              </div>
            </>
          )}

          {step === 5 && (
            <SignupForm businessType={businessType} brandDetails={{ ...details, tone, color }} />
          )}

          <div className="mt-8 flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
            >
              <ArrowLeft className="mr-1 h-4 w-4" /> Vissza
            </Button>
            {step < STEPS.length - 1 ? (
              <Button
                className="rounded-full"
                disabled={step === 1 && details.name.trim().length < 2}
                onClick={() => setStep((s) => s + 1)}
              >
                Tovább <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            ) : null}
          </div>
        </div>
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
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
}) {
  return (
    <div>
      <Label htmlFor={`onboarding-${label}`}>{label}</Label>
      <Input
        id={`onboarding-${label}`}
        className="mt-2"
        placeholder={placeholder}
        value={value}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
