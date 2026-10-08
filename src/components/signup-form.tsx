import { FormEvent, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { registerUser } from "@/lib/auth.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BUSINESS_TYPES } from "@/lib/business-types";
import { PublicInfoLinks } from "@/components/public-info-page";
import { Eye, EyeOff } from "lucide-react";

export interface OnboardingBrandDetails {
  name: string;
  website: string;
  logoUrl: string;
  openingHours: string;
  services: string;
  products: string;
  tone: string;
  color: string;
  address?: string;
  cityRegion?: string;
  offers?: string;
  contactMethod?: string;
  addressing?: "te" | "Ön" | "ti";
  industry?: string;
  mood?: "" | "Letisztult" | "Prémium" | "Lendületes";
  audience?: string;
}
export function SignupForm({
  businessType = "other",
  brandDetails,
  logoFile,
  embedded = false,
  onRegistered,
}: {
  businessType?: string;
  brandDetails?: OnboardingBrandDetails;
  logoFile?: File | null;
  embedded?: boolean;
  onRegistered?: () => void;
}) {
  const register = useServerFn(registerUser);
  const [form, setForm] = useState({
    displayName: "",
    workspaceName: brandDetails?.name ?? "",
    email: "",
    password: "",
    businessType,
  });
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const update = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setPending(true);
    try {
      if (!registered) {
        await register({
          data: {
            ...form,
            ...(embedded && brandDetails ? { workspaceName: brandDetails.name, businessType } : {}),
            brandDetails,
          },
        });
        setRegistered(true);
        onRegistered?.();
      }
      if (logoFile) {
        const body = new FormData();
        body.set("file", logoFile);
        body.set("purpose", "brand-logo");
        body.set("altText", "Vállalkozás logója");
        const response = await fetch("/api/media", { method: "POST", body }).catch(() => {
          throw new Error(
            "A fiókod elkészült, de a logó feltöltése megszakadt. Próbáld újra, vagy folytasd logó nélkül.",
          );
        });
        if (!response.ok) {
          const result = await response.json().catch(() => ({}));
          throw new Error(
            `A fiókod elkészült, de a logó mentése nem sikerült. ${result.error || "Próbáld újra, vagy folytasd logó nélkül."}`,
          );
        }
      }
      window.location.assign("/app/channels");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Nem sikerült regisztrálni.");
    } finally {
      setPending(false);
    }
  }
  return (
    <div>
      <div className={embedded ? "" : "w-full max-w-md rounded-3xl border bg-card p-8 shadow-sm"}>
        {!embedded && (
          <>
            <Link to="/" className="mb-8 flex items-center gap-2 font-semibold">
              <span className="grid h-8 w-8 place-items-center rounded-xl gradient-brand text-primary-foreground">
                M
              </span>
              MarketingPilot
            </Link>
            <h1 className="text-2xl font-semibold">Fiók létrehozása</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Kezeld a vállalkozásod marketingjét egy helyen.
            </p>
          </>
        )}
        <form onSubmit={submit} className={`${embedded ? "mt-6" : "mt-8"} space-y-4`}>
          <fieldset disabled={registered} className="space-y-4">
            {!embedded && (
              <div>
                <Label htmlFor="businessType">Vállalkozás típusa (opcionális)</Label>
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
                      {item.value === "other" ? "Később adom meg / Egyéb" : item.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <Label htmlFor="displayName">Neved</Label>
              <Input
                id="displayName"
                autoComplete="name"
                minLength={2}
                maxLength={120}
                required
                value={form.displayName}
                onChange={update("displayName")}
                className="mt-2"
              />
            </div>
            {!embedded && (
              <div>
                <Label htmlFor="workspaceName">Vállalkozás neve</Label>
                <Input
                  id="workspaceName"
                  autoComplete="organization"
                  minLength={2}
                  maxLength={160}
                  required
                  value={form.workspaceName}
                  onChange={update("workspaceName")}
                  className="mt-2"
                />
              </div>
            )}
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                maxLength={180}
                required
                value={form.email}
                onChange={update("email")}
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="password">Jelszó (legalább 8 karakter)</Label>
              <div className="relative mt-2">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  maxLength={200}
                  minLength={8}
                  required
                  value={form.password}
                  onChange={update("password")}
                  className="pr-12"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-10 w-11"
                  aria-label={showPassword ? "Jelszó elrejtése" : "Jelszó megjelenítése"}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((value) => !value)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </fieldset>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            A regisztrációval elfogadod a{" "}
            <Link to="/terms" className="underline">
              Használati feltételeket
            </Link>
            . Az adatok kezeléséről az{" "}
            <Link to="/privacy" className="underline">
              Adatvédelmi tájékoztatóban
            </Link>{" "}
            olvashatsz.
          </p>
          <Button className="w-full rounded-full" disabled={pending}>
            {pending ? "Mentés…" : registered ? "Logó mentésének újrapróbálása" : "Regisztráció"}
          </Button>
          {registered && (
            <Button
              type="button"
              variant="outline"
              className="w-full rounded-full"
              onClick={() => window.location.assign("/app/channels")}
            >
              Folytatás logó nélkül
            </Button>
          )}
        </form>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Van már fiókod?{" "}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Bejelentkezés
          </Link>
        </p>
        <div className="mt-6 border-t pt-4 text-muted-foreground">
          <PublicInfoLinks />
          <p className="mt-3 text-center text-sm">
            Nyilvános béta. Az üzemeltetői és végleges jogi adatok előkészítés alatt állnak.
          </p>
        </div>
      </div>
    </div>
  );
}
