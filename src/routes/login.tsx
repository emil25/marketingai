import { redirectSignedInUser } from "@/lib/guest-route";
import { FormEvent, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { loginUser } from "@/lib/auth.functions";
import { getLocalAdminLoginAvailability, loginLocalAdmin } from "@/lib/local-admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { PublicInfoLinks } from "@/components/public-info-page";

export const Route = createFileRoute("/login")({ beforeLoad: redirectSignedInUser, loader: () => getLocalAdminLoginAvailability(), component: LoginPage });

function LoginPage() {
  const login = useServerFn(loginUser);
  const adminLogin = useServerFn(loginLocalAdmin);
  const localAdminAvailable = Route.useLoaderData();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault(); setError(""); setPending(true);
    try { await login({ data: { email, password } }); window.location.assign("/app"); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Nem sikerült bejelentkezni."); }
    finally { setPending(false); }
  }

  async function enterLocalAdmin() {
    setError(""); setPending(true);
    try { await adminLogin(); window.location.assign("/app"); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Nem sikerült belépni az admin munkatérbe."); }
    finally { setPending(false); }
  }

  return <AuthShell title="Üdv újra" sub="Jelentkezz be a MarketingPilot munkateredbe.">
    <form onSubmit={submit} className="space-y-4">
      <div><Label htmlFor="email">Email</Label><Input id="email" autoComplete="username" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-2" /></div>
      <div><Label htmlFor="password">Jelszó</Label><Input id="password" autoComplete="current-password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="mt-2" /></div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button className="w-full rounded-full" disabled={pending}>{pending ? "Beléptetés…" : "Bejelentkezés"}</Button>
    </form>
    {localAdminAvailable && <div className="mt-6 border-t pt-5"><Button type="button" variant="outline" className="w-full rounded-full" disabled={pending} onClick={() => void enterLocalAdmin()}>{pending ? "Beléptetés…" : "Belépés adminnak"}</Button><p className="mt-2 text-center text-xs text-muted-foreground">Csak ezen a gépen, fejlesztés közben. Nem kell jelszó.</p></div>}
    <p className="mt-6 text-center text-sm text-muted-foreground">Még nincs fiókod? <Link to="/signup" className="font-medium text-primary hover:underline">Regisztráció</Link></p>
    <div className="mt-6 border-t pt-4 text-muted-foreground"><PublicInfoLinks /></div>
  </AuthShell>;
}

function AuthShell({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return <div className="theme-marketingpilot-v2 public-site grid min-h-screen place-items-center bg-background p-4"><Card className="w-full max-w-md rounded-3xl p-8"><Link to="/" className="mb-8 flex items-center gap-2 font-semibold"><span className="grid h-8 w-8 place-items-center rounded-xl gradient-brand text-primary-foreground">M</span>MarketingPilot</Link><h1 className="text-2xl font-semibold">{title}</h1><p className="mt-1 text-sm text-muted-foreground">{sub}</p><div className="mt-8">{children}</div></Card></div>;
}

export { AuthShell };
