import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useRouter } from "@tanstack/react-router";
import type { WorkspaceSnapshot } from "@/lib/data-model";
import { updateBrand, saveBrandVoice, createBrand } from "@/lib/workspace.functions";
import { normalizeBusinessWebsite } from "@/lib/onboarding-details";
import { BUSINESS_TYPES } from "@/lib/business-types";
import { mainChannel } from "@/lib/main-channel";
import { BrandLogoUpload } from "./brand-logo-upload";
import { AccountSettings } from "./account-settings";
import { UiModeSwitch } from "./ui-mode";
import { WeeklyReminderSetting } from "./weekly-reminder-setting";
import { ApprovedClaimsPicker } from "./approved-claims-picker";
import { formatRomanianPhone, normalizeRomanianPhone } from "@/lib/market/ro";
import { translate } from "@/i18n";
import { Card } from "./ui/card";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Button } from "./ui/button";
export function EasyBusiness({ workspace }: { workspace: WorkspaceSnapshot }) {
  const brand = workspace.activeBrand;
  const profile = brand?.profile;
  const [form, setForm] = useState({
    name: brand?.name ?? "",
    website: brand?.website ?? "",
    cityRegion: brand?.cityRegion ?? "",
    products: brand?.products ?? "",
    services: brand?.services ?? "",
    offers: brand?.offers ?? "",
    audience: brand?.audience ?? "",
    languageMarket: brand?.languageMarket ?? "magyar",
    businessType: profile?.businessType ?? "other",
    mainChannel: mainChannel(profile),
    address: profile?.address ?? "",
    houseNumber: profile?.houseNumber ?? "",
    county: profile?.county ?? "",
    phone: formatRomanianPhone(profile?.phone ?? ""),
    cityNameMode: profile?.cityNameMode ?? "hu",
    localPhrases: profile?.localPhrases ?? "",
    localEvents: profile?.localEvents ?? "",
    openingHours: profile?.openingHours ?? "",
    tone: profile?.tone ?? "Barátságos",
    ctaStyle: profile?.ctaStyle ?? "",
    logoUrl: profile?.logoUrl ?? "",
    addressing: profile?.aiGuardrails.includes("(Ön)")
      ? "Ön"
      : profile?.aiGuardrails.includes("(ti)")
        ? "ti"
        : "te",
  });
  const [busy, setBusy] = useState(false);
  const [approvedClaims, setApprovedClaims] = useState<string[]>(profile?.approvedClaims ?? []);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const update = useServerFn(updateBrand),
    create = useServerFn(createBrand),
    voice = useServerFn(saveBrandVoice);
  const router = useRouter();
  const fields: Array<[keyof typeof form, string, string, boolean?]> = [
    ["name", "Vállalkozás neve", "Ezzel a névvel mutatunk be a posztokban."],
    ["website", "Weboldal", "Ide irányíthatjuk az érdeklődőket."],
    ["cityRegion", "Város / régió", "Így a helyi közönségedhez szólnak a posztok."],
    ["address", "Pontos cím", "Ezt használjuk, ha személyes látogatásra hívsz."],
    ["houseNumber", "Házszám", "Az utca mellett ezt is feltüntetjük."],
    ["county", "Megye", "Így pontosabb a helyi megszólítás."],
    ["phone", translate("onboarding.phone"), "A megadott számot használjuk elérhetőségként."],
    ["openingHours", "Nyitvatartás", "A megadott időket használjuk a posztokban."],
    ["localPhrases", translate("onboarding.localPhrases"), translate("onboarding.localPhrasesHelp"), true],
    ["localEvents", translate("onboarding.localEvents"), translate("onboarding.localEventsHelp"), true],
    ["products", "Fő termékek", "Ezekből konkrét posztötletek készülhetnek.", true],
    ["services", "Szolgáltatások", "Ezeket az ajánlataidat is bemutathatjuk.", true],
    ["offers", "Aktuális ajánlat", "Csak az itt megadott akciókat és árakat használjuk.", true],
    ["audience", "Kiknek szeretnél posztolni?", "Hozzájuk igazítjuk a megfogalmazást.", true],
    [
      "ctaStyle",
      "Elérhetőség / rendelés módja",
      "Telefon, e-mail vagy foglalási link kerülhet a felhívásba.",
    ],
    ["languageMarket", "Posztok nyelve", "Ezen a nyelven készülnek a szövegek."],
  ];
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <h1 className="text-2xl font-semibold">Vállalkozásom</h1>
      <Card className="p-5">
        <UiModeSwitch />
      </Card>
      <Card className="p-5 md:p-8">
        <form
          className="space-y-5"
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy) return;
            setBusy(true);
            setError("");
            setMessage("");
            try {
              const core = {
                ...(brand ?? {}),
                name: form.name,
                website: normalizeBusinessWebsite(form.website),
                cityRegion: form.cityRegion,
                products: form.products,
                services: form.services,
                offers: form.offers,
                audience: form.audience,
                languageMarket: form.languageMarket,
              };
              const saved = brand
                ? await update({ data: { ...core, id: brand.id } })
                : await create({ data: core });
              const id = brand?.id ?? saved?.activeBrand?.id;
              if (!id) throw new Error("Nem sikerült létrehozni a vállalkozást.");
              const guardrails =
                profile?.aiGuardrails ??
                "Ne találj ki árakat, akciókat, nyitvatartást vagy véleményeket.";
              const addressing =
                form.addressing === "Ön"
                  ? "magázás (Ön)"
                  : form.addressing === "ti"
                    ? "tegezés, többes szám (ti)"
                    : "tegezés, egyes szám (te)";
              await voice({
                data: {
                  ...profile,
                  brandId: id,
                  businessType: form.businessType,
                  mainChannel: form.mainChannel,
                  address: form.address,
                  houseNumber: form.houseNumber,
                  county: form.county,
                  phone: normalizeRomanianPhone(form.phone),
                  cityNameMode: form.cityNameMode,
                  localPhrases: form.localPhrases,
                  localEvents: form.localEvents,
                  approvedClaims,
                  openingHours: form.openingHours,
                  tone: form.tone,
                  ctaStyle: form.ctaStyle,
                  logoUrl: form.logoUrl,
                  aiGuardrails: `${guardrails.replace(/Megszólítás:[^.]*\.[^.]*(?:megszólítással\.)?/u, "").trim()} Megszólítás: ${addressing}. Ne keverd más megszólítással.`,
                },
              });
              setForm((current) => ({ ...current, phone: formatRomanianPhone(form.phone) }));
              setMessage("A vállalkozásod adatait mentettük.");
              await router.invalidate();
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : "Nem sikerült menteni.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <fieldset disabled={busy} className="grid gap-5 md:grid-cols-2">
            {fields.map(([key, label, help, multiline]) => (
              <label className="block" key={key}>
                <span className="block font-medium">
                  {label}
                  {key === "name" ? " *" : ""}
                </span>
                {multiline ? (
                  <Textarea
                    className="mt-2"
                    value={form[key]}
                    maxLength={4000}
                    onChange={(e) => setForm((v) => ({ ...v, [key]: e.target.value }))}
                  />
                ) : (
                  <Input
                    className="mt-2"
                    value={form[key]}
                    required={key === "name"}
                    maxLength={key === "name" ? 160 : key === "ctaStyle" ? 240 : 1000}
                    onChange={(e) => setForm((v) => ({ ...v, [key]: e.target.value }))}
                  />
                )}
                <span className="mt-1 block text-sm text-muted-foreground">{help}</span>
              </label>
            ))}
            <label>
              {translate("business.cityNameMode")}
              <select
                className="mt-2 min-h-11 w-full rounded-md border bg-card p-2"
                value={form.cityNameMode}
                onChange={(event) => setForm((v) => ({ ...v, cityNameMode: event.target.value as "hu" | "ro" | "both" }))}
              >
                <option value="hu">{translate("business.cityNameHungarian")}</option>
                <option value="ro">{translate("business.cityNameRomanian")}</option>
                <option value="both">{translate("business.cityNameBoth")}</option>
              </select>
              <span className="mt-1 block text-sm text-muted-foreground">{translate("onboarding.cityNameModeHelp")}</span>
            </label>
            <label>
              Fő csatorna
              <select
                className="mt-2 min-h-11 w-full rounded-md border bg-card p-2"
                value={form.mainChannel}
                onChange={(e) =>
                  setForm((v) => ({
                    ...v,
                    mainChannel: e.target.value as "facebook" | "instagram",
                  }))
                }
              >
                <option value="facebook">Facebook</option>
                <option value="instagram">Instagram</option>
              </select>
              <span className="mt-1 block text-sm text-muted-foreground">
                Az új posztjaid alapból erre a felületre készülnek. Később bármikor válthatsz.
              </span>
            </label>
            <label>
              Vállalkozástípus
              <select
                className="mt-2 min-h-11 w-full rounded-md border bg-card p-2"
                value={form.businessType}
                onChange={(e) => setForm((v) => ({ ...v, businessType: e.target.value }))}
              >
                {BUSINESS_TYPES.map((type) => (
                  <option value={type.value} key={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-sm text-muted-foreground">
                A vállalkozásodhoz illő ötleteket ajánlunk.
              </span>
            </label>
            <label>
              Hangnem
              <select
                className="mt-2 min-h-11 w-full rounded-md border bg-card p-2"
                value={form.tone}
                onChange={(e) => setForm((v) => ({ ...v, tone: e.target.value }))}
              >
                {[...new Set([form.tone, "Barátságos", "Professzionális", "Játékos"])].map(
                  (tone) => (
                    <option key={tone}>{tone}</option>
                  ),
                )}
              </select>
              <span className="mt-1 block text-sm text-muted-foreground">
                Így szólal meg a vállalkozásod a posztokban.
              </span>
            </label>
            <label>
              Megszólítás
              <select
                className="mt-2 min-h-11 w-full rounded-md border bg-card p-2"
                value={form.addressing}
                onChange={(e) => setForm((v) => ({ ...v, addressing: e.target.value }))}
              >
                <option value="te">Tegezve</option>
                <option value="Ön">Magázva</option>
                <option value="ti">Többes szám (ti)</option>
              </select>
              <span className="mt-1 block text-sm text-muted-foreground">
                Minden posztban következetesen így szólítjuk meg az olvasót.
              </span>
            </label>
            {brand && (
              <BrandLogoUpload
                brandId={brand.id}
                logoUrl={form.logoUrl}
                onUploaded={(logoUrl) => setForm((v) => ({ ...v, logoUrl }))}
              />
            )}
          </fieldset>
          <ApprovedClaimsPicker
            businessType={form.businessType}
            value={approvedClaims}
            onChange={setApprovedClaims}
          />
          {error && (
            <p role="alert" className="text-destructive">
              {error}
            </p>
          )}
          {message && <p role="status">{message}</p>}
          <Button disabled={busy || !form.name.trim()} className="w-full sm:w-auto">
            {busy ? "Mentés…" : "Változtatások mentése"}
          </Button>
        </form>
      </Card>
      <WeeklyReminderSetting />
      <AccountSettings user={workspace.user} />
    </div>
  );
}
