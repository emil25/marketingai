import { redirectSignedInUser } from "@/lib/guest-route";
import { FormEvent, useEffect, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { loginUser } from "@/lib/auth.functions";
import { getLocalAdminLoginAvailability, loginLocalAdmin } from "@/lib/local-admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { PublicInfoLinks } from "@/components/public-info-page";
import { AuthChallenge } from "@/components/auth-challenge";
import { getAuthConfiguration } from "@/lib/account.functions";
import { brandForLocale, DEFAULT_MARKET_LOCALE } from "@/config/brand";

const productName = brandForLocale(DEFAULT_MARKET_LOCALE).productName;

export const Route = createFileRoute("/login")({
  beforeLoad: redirectSignedInUser,
  loader: async () => ({
    localAdmin: await getLocalAdminLoginAvailability(),
    config: await getAuthConfiguration(),
  }),
  component: LoginPage,
});

function LoginPage() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const login = useServerFn(loginUser);
  const adminLogin = useServerFn(loginLocalAdmin);
  const { localAdmin: localAdminAvailable, config } = Route.useLoaderData();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [botToken, setToken] = useState("");
  const [ready, setReady] = useState(false);
  const [attempt, setAttempt] = useState(0);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setPending(true);
    try {
      const result = await login({ data: { email, password, botToken } });
      window.location.assign(result.user.canUseAi ? "/app" : "/verify-email");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Nem sikerült bejelentkezni.");
      setAttempt((n) => n + 1);
    } finally {
      setPending(false);
    }
  }

  async function enterLocalAdmin() {
    setError("");
    setPending(true);
    try {
      await adminLogin();
      window.location.assign("/app");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Nem sikerült belépni az admin munkatérbe.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthShell title="Üdv újra" sub={`Jelentkezz be a saját ${productName}-fiókodba.`}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            disabled={!hydrated}
            id="email"
            autoComplete="username"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-2"
          />
        </div>
        <div>
          <Label htmlFor="password">Jelszó</Label>
          <Input
            disabled={!hydrated}
            id="password"
            autoComplete="current-password"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-2"
          />
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <AuthChallenge key={attempt} action="login" onReady={setReady} onToken={setToken} />
        <Button className="w-full rounded-full" disabled={pending || !ready || !hydrated}>
          {pending ? "Beléptetés…" : "Bejelentkezés"}
        </Button>
        {config.passwordResetAvailable && (
          <p className="text-center text-sm">
            <Link to="/forgot-password" className="inline-flex min-h-11 items-center underline">
              Elfelejtett jelszó
            </Link>
          </p>
        )}
      </form>
      {localAdminAvailable && (
        <div className="mt-6 border-t pt-5">
          <Button
            type="button"
            variant="outline"
            className="w-full rounded-full"
            disabled={pending || !hydrated}
            onClick={() => void enterLocalAdmin()}
          >
            {pending ? "Beléptetés…" : "Belépés adminnak"}
          </Button>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Csak ezen a gépen, fejlesztés közben. Nem kell jelszó.
          </p>
        </div>
      )}
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Még nincs fiókod?{" "}
        <Link to="/signup" className="font-medium text-primary hover:underline">
          Regisztráció
        </Link>
      </p>
      <div className="mt-6 border-t pt-4 text-muted-foreground">
        <PublicInfoLinks />
      </div>
    </AuthShell>
  );
}

function AuthShell({
  title,
  sub,
  children,
}: {
  title: string;
  sub: string;
  children: React.ReactNode;
}) {
  return (
    <div className="theme-marketingpilot-v2 public-site grid min-h-screen place-items-center bg-background p-4">
      <Card className="w-full max-w-md rounded-3xl p-8">
        <Link to="/" className="mb-8 flex items-center gap-2 font-semibold">
          <span className="grid h-8 w-8 place-items-center rounded-xl gradient-brand text-primary-foreground">
            M
          </span>
          {productName}
        </Link>
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{sub}</p>
        <div className="mt-8">{children}</div>
      </Card>
    </div>
  );
}

export { AuthShell };
