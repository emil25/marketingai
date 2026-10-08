import { useEffect, useId, useState } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/app-chrome";
import {
  getWorkspace,
  createBrand,
  updateBrand,
  deleteBrand,
  setActiveBrand,
  saveBrandVoice,
  learnBrandVoice,
} from "@/lib/workspace.functions";
import { FileText, Loader2, Palette, Save, Sparkles, Trash2, Plus } from "lucide-react";
import { BUSINESS_TYPES } from "@/lib/business-types";
import { BusinessTypePicker } from "@/components/business-type-picker";

export const Route = createFileRoute("/app/brand")({
  loader: () => getWorkspace(),
  component: BrandPage,
});

type FormState = {
  id?: string;
  name: string;
  address: string;
  openingHours: string;
  website: string;
  cityRegion: string;
  languageMarket: string;
  industry: string;
  businessType: string;
  products: string;
  services: string;
  offers: string;
  audience: string;
  tone: string;
  ctaStyle: string;
  values: string;
  preferredPhrases: string;
  avoidedPhrases: string;
  description: string;
  approvedExamples: string;
  aiGuardrails: string;
  logoUrl: string;
  colors: string;
  fontFamily: string;
};
const blank: FormState = {
  name: "",
  address: "",
  openingHours: "",
  website: "",
  cityRegion: "",
  languageMarket: "magyar",
  industry: "",
  businessType: "other",
  products: "",
  services: "",
  offers: "",
  audience: "",
  tone: "Barátságos",
  ctaStyle: "Barátságos és közvetlen",
  values: "",
  preferredPhrases: "",
  avoidedPhrases: "",
  description: "",
  approvedExamples: "",
  aiGuardrails: "Ne találj ki árakat, akciókat, nyitvatartást vagy ügyfélvéleményeket.",
  logoUrl: "",
  colors: "",
  fontFamily: "Plus Jakarta Sans",
};

function BrandPage() {
  const data = Route.useLoaderData();
  const router = useRouter();
  const create = useServerFn(createBrand);
  const update = useServerFn(updateBrand);
  const remove = useServerFn(deleteBrand);
  const activate = useServerFn(setActiveBrand);
  const saveVoice = useServerFn(saveBrandVoice);
  const learn = useServerFn(learnBrandVoice);
  const [form, setForm] = useState<FormState>(blank);
  const [learningText, setLearningText] = useState("");
  const [learning, setLearning] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const brand = data.activeBrand;
  const voiceProgress = brand
    ? [
        brand.profile.tone,
        brand.profile.ctaStyle,
        brand.profile.values,
        brand.profile.preferredPhrases,
        brand.profile.avoidedPhrases,
        brand.profile.description,
        brand.profile.aiGuardrails,
        brand.profile.learnedSummary ?? "",
      ].filter((value) => value.trim()).length
    : 0;
  useEffect(() => {
    if (brand) {
      setForm({
        id: brand.id,
        name: brand.name,
        address: brand.profile.address ?? "",
        openingHours: brand.profile.openingHours ?? "",
        website: brand.website,
        cityRegion: brand.cityRegion,
        languageMarket: brand.languageMarket,
        industry: brand.industry,
        businessType: brand.profile.businessType ?? "other",
        products: brand.products,
        services: brand.services,
        offers: brand.offers,
        audience: brand.audience,
        tone: brand.profile.tone,
        ctaStyle: brand.profile.ctaStyle,
        values: brand.profile.values,
        preferredPhrases: brand.profile.preferredPhrases,
        avoidedPhrases: brand.profile.avoidedPhrases,
        description: brand.profile.description,
        approvedExamples: brand.profile.approvedExamples,
        aiGuardrails: brand.profile.aiGuardrails,
        logoUrl: brand.profile.logoUrl,
        colors: brand.profile.colors.join(", "),
        fontFamily: brand.profile.fontFamily,
      });
      setLearningText((brand.profile.learningSamples ?? []).join("\n\n"));
    } else {
      setForm(blank);
      setLearningText("");
    }
  }, [brand?.id]);
  const set =
    (key: keyof FormState) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((current) => ({ ...current, [key]: event.target.value }));
  async function submit(event?: React.FormEvent) {
    event?.preventDefault();
    if (pending) return;
    setPending(true);
    setError("");
    setMessage("");
    try {
      const core = {
        id: form.id,
        name: form.name,
        website: form.website,
        cityRegion: form.cityRegion,
        languageMarket: form.languageMarket,
        industry: form.industry,
        products: form.products,
        services: form.services,
        offers: form.offers,
        audience: form.audience,
      };
      const saved = form.id
        ? await update({ data: { ...core, id: form.id } })
        : await create({ data: core });
      const brandId = form.id ?? saved?.activeBrand?.id;
      if (!brandId) throw new Error("A márka létrehozása nem adott azonosítót.");
      await saveVoice({
        data: {
          brandId,
          businessType: form.businessType,
          address: form.address,
          openingHours: form.openingHours,
          tone: form.tone,
          ctaStyle: form.ctaStyle,
          values: form.values,
          preferredPhrases: form.preferredPhrases,
          avoidedPhrases: form.avoidedPhrases,
          description: form.description,
          approvedExamples: form.approvedExamples,
          aiGuardrails: form.aiGuardrails,
          logoUrl: form.logoUrl,
          colors: form.colors
            .split(",")
            .map((color) => color.trim())
            .filter(Boolean),
          fontFamily: form.fontFamily,
        },
      });
      setMessage("A márka és a Brand Voice mentve.");
      await router.invalidate();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Nem sikerült menteni.");
    } finally {
      setPending(false);
    }
  }
  async function choose(id: string) {
    setError("");
    try {
      await activate({ data: { brandId: id } });
      await router.invalidate();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Nem sikerült váltani.");
    }
  }
  async function removeCurrent() {
    if (!form.id) return;
    setPending(true);
    try {
      await remove({ data: { brandId: form.id } });
      setForm(blank);
      await router.invalidate();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Nem sikerült törölni.");
    } finally {
      setPending(false);
    }
  }
  async function learnFromExamples() {
    if (!brand || learning) return;
    const samples = learningText
      .split(/\n\s*\n|\n?---+\n?/)
      .map((sample) => sample.trim())
      .filter((sample) => sample.length >= 20)
      .slice(0, 20);
    if (!samples.length) {
      setError("Adj meg legalább egy, 20 karakternél hosszabb saját posztpéldát.");
      return;
    }
    setLearning(true);
    setError("");
    setMessage("");
    try {
      await learn({ data: { brandId: brand.id, samples } });
      setMessage(
        "A márkahang tanulása elkészült; az új AI-generálások ezt az összefoglalót is használják.",
      );
      await router.invalidate();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Nem sikerült megtanulni a márkahangot.");
    } finally {
      setLearning(false);
    }
  }
  async function readExamplesFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      setLearningText((current) =>
        current.trim() ? `${current.trim()}\n\n${text.trim()}` : text.trim(),
      );
    } catch {
      setError("A fájl olvasása sikertelen.");
    } finally {
      event.target.value = "";
    }
  }
  return (
    <div className="space-y-6">
      <PageHeader
        title="Márkaprofil és márkahang"
        sub="Az aktív márka kontextusa kerül minden AI-munkába."
        action={
          <Link to="/app">
            <Button variant="outline" className="tt-outline">
              Vissza az áttekintéshez
            </Button>
          </Link>
        }
      />
      <Card className="tt-onboarding rounded-2xl p-6 md:p-7">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <Badge className="tt-pill">MÁRKAALAPOK · AI KONTEXTUS</Badge>
            <h2 className="mt-3 font-display text-2xl font-extrabold tracking-tight">
              Adj a MarketingPilotnak valódi hangot.
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              A rövid márkaalapokból következetes szöveg, vizuális irány és kampánybrief készül.
              Minden mentés az aktív márkához kötődik.
            </p>
          </div>
          <div className="min-w-44 rounded-xl border border-primary/10 bg-white/70 p-3">
            <div className="flex items-center justify-between text-xs font-bold">
              <span>Brand Voice</span>
              <span className="text-primary">{voiceProgress}/8</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-brand-soft">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${Math.round((voiceProgress / 8) * 100)}%` }}
              />
            </div>
            <div className="mt-2 text-[10px] text-muted-foreground">kitöltött AI-mezők</div>
          </div>
        </div>
        <div className="mt-6 grid gap-2 sm:grid-cols-3">
          <OnboardingHint number="01" title="Alapok" detail="Vállalkozás és ajánlat" />
          <OnboardingHint number="02" title="Hang" detail="Tone, CTA és kifejezések" />
          <OnboardingHint number="03" title="Szabályok" detail="Példák és guardrail" />
        </div>
      </Card>
      {data.brands.length > 0 && (
        <Card className="tt-card p-5">
          <div className="flex flex-wrap items-center gap-2">
            <div className="mr-2 text-sm font-semibold">Munkatér márkái</div>
            {data.brands.map((item) => (
              <Button
                key={item.id}
                variant={item.id === brand?.id ? "default" : "outline"}
                className="rounded-full"
                onClick={() => void choose(item.id)}
              >
                {item.name}
              </Button>
            ))}
            <Button variant="ghost" className="rounded-full" onClick={() => setForm(blank)}>
              <Plus className="mr-1 h-4 w-4" />
              Új márka
            </Button>
          </div>
        </Card>
      )}
      <form onSubmit={submit} className="space-y-6">
        <BusinessTypePicker
          value={form.businessType}
          savedValue={form.id === brand?.id ? brand?.profile.businessType : undefined}
          disabled={pending || learning}
          canSave={Boolean(form.name.trim())}
          onChange={(businessType) => {
            setForm((current) => ({ ...current, businessType }));
            setMessage("");
          }}
          onSave={() => void submit()}
        />
        <Card className="tt-card rounded-2xl p-6">
          <div className="mb-5 flex items-center gap-2">
            <Palette className="h-4 w-4 text-primary" />
            <div>
              <h2 className="font-display text-lg font-extrabold">Márka alapadatai</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                A közös kontextus minden generálásban megjelenik.
              </p>
            </div>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Márkanév" value={form.name} onChange={set("name")} required />
            <Field label="Pontos cím (opcionális)" value={form.address} onChange={set("address")} />
            <Field
              label="Nyitvatartás (opcionális)"
              value={form.openingHours}
              onChange={set("openingHours")}
            />
            <Field label="Weboldal" value={form.website} onChange={set("website")} />
            <Field label="Város / régió" value={form.cityRegion} onChange={set("cityRegion")} />
            <Field
              label="Nyelvi piac"
              value={form.languageMarket}
              onChange={set("languageMarket")}
            />
            <div>
              <Label htmlFor="businessType">Vállalkozás típusa</Label>
              <select
                id="businessType"
                value={form.businessType}
                onChange={(event) =>
                  setForm((current) => ({ ...current, businessType: event.target.value }))
                }
                className="mt-2 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {BUSINESS_TYPES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
            <Field label="Iparág" value={form.industry} onChange={set("industry")} />
            <Field label="Betűtípus" value={form.fontFamily} onChange={set("fontFamily")} />
            <TextField label="Termékek" value={form.products} onChange={set("products")} />
            <TextField label="Szolgáltatások" value={form.services} onChange={set("services")} />
            <TextField label="Ajánlatok" value={form.offers} onChange={set("offers")} />
            <TextField label="Célközönség" value={form.audience} onChange={set("audience")} />
          </div>
        </Card>
        <Card className="tt-card rounded-2xl p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-extrabold">Brand Voice / Márka AI</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Írd le, hogyan fogalmazzon és mit tartson be az AI.
              </p>
            </div>
            <Badge className="tt-badge">{voiceProgress}/8 kitöltve</Badge>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Hangnem" value={form.tone} onChange={set("tone")} />
            <Field label="CTA stílusa" value={form.ctaStyle} onChange={set("ctaStyle")} />
            <TextField label="Márkaértékek" value={form.values} onChange={set("values")} />
            <TextField
              label="Használandó kifejezések"
              value={form.preferredPhrases}
              onChange={set("preferredPhrases")}
            />
            <TextField
              label="Kerülendő kifejezések"
              value={form.avoidedPhrases}
              onChange={set("avoidedPhrases")}
            />
            <TextField
              label="Jóváhagyott példák"
              value={form.approvedExamples}
              onChange={set("approvedExamples")}
            />
            <TextField
              label="Márkaleírás / AI memória"
              value={form.description}
              onChange={set("description")}
            />
            <TextField
              label="AI guardrail"
              value={form.aiGuardrails}
              onChange={set("aiGuardrails")}
            />
            <Field label="Logó URL" value={form.logoUrl} onChange={set("logoUrl")} />
            <Field label="Színek (vesszővel)" value={form.colors} onChange={set("colors")} />
          </div>
          <div className="mt-6 rounded-2xl border border-dashed bg-secondary/30 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="flex items-center gap-2 font-semibold">
                  <FileText className="h-4 w-4 text-primary" />
                  Márkahang tanulása saját posztokból
                </h3>
                <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
                  Illessz be korábbi saját posztokat üres sorral elválasztva, vagy tölts fel .txt,
                  .md vagy .csv fájlt. Az AI stílusösszefoglalót készít, amely minden későbbi
                  generálás kontextusába bekerül.
                </p>
              </div>
              <Badge variant="outline" className="rounded-full">
                {brand?.profile.learnedAt ? "Tanult márkahang aktív" : "Még nincs tanult minta"}
              </Badge>
            </div>
            <Textarea
              value={learningText}
              onChange={(event) => setLearningText(event.target.value)}
              className="mt-3 min-h-36"
              placeholder="1. saját poszt…\n\n2. saját poszt…"
            />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 text-sm">
                <FileText className="h-4 w-4" />
                Fájl hozzáadása
                <input
                  type="file"
                  accept=".txt,.md,.csv,text/plain,text/markdown,text/csv"
                  className="sr-only"
                  onChange={(event) => void readExamplesFile(event)}
                />
              </label>
              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                onClick={() => void learnFromExamples()}
                disabled={!brand || learning}
              >
                {learning ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-1 h-4 w-4" />
                )}
                {learning ? "Tanulás…" : "Márkahang megtanulása"}
              </Button>
            </div>
            {brand?.profile.learnedSummary && (
              <p className="mt-3 whitespace-pre-line rounded-xl bg-brand-soft p-3 text-xs text-foreground/80">
                {brand.profile.learnedSummary}
              </p>
            )}
          </div>
        </Card>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" className="tt-primary" disabled={pending}>
            <Save className="mr-1 h-4 w-4" />
            {pending ? "Mentés…" : "Márka mentése"}
          </Button>
          {form.id && (
            <Button
              type="button"
              variant="outline"
              className="tt-outline text-destructive"
              onClick={() => void removeCurrent()}
              disabled={pending}
            >
              <Trash2 className="mr-1 h-4 w-4" />
              Márka törlése
            </Button>
          )}
          {message && <span className="text-sm text-emerald-600">{message}</span>}
          {error && <span className="text-sm text-destructive">{error}</span>}
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
}: {
  label: string;
  value: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
}) {
  const id = useId();
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} required={required} value={value} onChange={onChange} className="mt-2" />
    </div>
  );
}
function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
}) {
  const id = useId();
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Textarea id={id} value={value} onChange={onChange} className="mt-2 min-h-24" />
    </div>
  );
}

function OnboardingHint({
  number,
  title,
  detail,
}: {
  number: string;
  title: string;
  detail: string;
}) {
  return (
    <div className="tt-onboarding-step">
      <span>{number}</span>
      <div>
        <strong>{title}</strong>
        <small>{detail}</small>
      </div>
    </div>
  );
}
