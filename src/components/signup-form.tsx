import { FormEvent, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { registerUser } from "@/lib/auth.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { BUSINESS_TYPES } from "@/lib/business-types";
import { PublicInfoLinks } from "@/components/public-info-page";


export interface OnboardingBrandDetails {
  name: string; website: string; logoUrl: string; openingHours: string;
  services: string; products: string; tone: string; color: string;
}
export function SignupForm({ businessType = "other", brandDetails }: { businessType?: string; brandDetails?: OnboardingBrandDetails }) {
  const register = useServerFn(registerUser);
  const [form, setForm] = useState({ displayName: "", workspaceName: brandDetails?.name ?? "", email: "", password: "", businessType });
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const update = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setPending(true);
    try {
      await register({ data: { ...form, brandDetails } });
      window.location.assign("/app/channels");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Nem sikerült regisztrálni.");
    } finally {
      setPending(false);
    }
  }
  return (
    <div>
      <Card className="w-full max-w-md rounded-3xl p-8">
        <Link to="/" className="mb-8 flex items-center gap-2 font-semibold">
          <span className="grid h-8 w-8 place-items-center rounded-xl gradient-brand text-primary-foreground">
            M
          </span>
          MarketingPilot
        </Link>
        <h1 className="text-2xl font-semibold">Munkatér létrehozása</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Indítsd a saját MarketingPilot munkateredet.
        </p>
        <form onSubmit={submit} className="mt-8 space-y-4">
          <div>
            <Label htmlFor="businessType">Vállalkozás típusa (opcionális)</Label>
            <select id="businessType" value={form.businessType} onChange={(event) => setForm((current) => ({ ...current, businessType: event.target.value }))} className="mt-2 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              {BUSINESS_TYPES.map((item) => <option key={item.value} value={item.value}>{item.value === "other" ? "Később adom meg / Egyéb" : item.label}</option>)}
            </select>
          </div>
          <div>
            <Label htmlFor="displayName">Neved</Label>
            <Input
              id="displayName"
              required
              value={form.displayName}
              onChange={update("displayName")}
              className="mt-2"
            />
          </div>
          <div>
            <Label htmlFor="workspaceName">Munkatér neve</Label>
            <Input
              id="workspaceName"
              required
              value={form.workspaceName}
              onChange={update("workspaceName")}
              className="mt-2"
            />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              value={form.email}
              onChange={update("email")}
              className="mt-2"
            />
          </div>
          <div>
            <Label htmlFor="password">Jelszó (legalább 8 karakter)</Label>
            <Input
              id="password"
              type="password"
              minLength={8}
              required
              value={form.password}
              onChange={update("password")}
              className="mt-2"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button className="w-full rounded-full" disabled={pending}>
            {pending ? "Létrehozás…" : "Regisztráció"}
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Van már fiókod?{" "}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Bejelentkezés
          </Link>
        </p>
        <div className="mt-6 border-t pt-4 text-muted-foreground"><PublicInfoLinks /><p className="mt-3 text-center text-sm">Nyilvános béta. Az üzemeltetői és végleges jogi adatok előkészítés alatt állnak.</p></div>
      </Card>
    </div>
  );
}
