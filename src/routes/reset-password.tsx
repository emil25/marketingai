import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { resetPassword } from "@/lib/account.functions";
import { AuthShell } from "./login";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
export const Route = createFileRoute("/reset-password")({ component: ResetPasswordPage });
function ResetPasswordPage() {
  const reset = useServerFn(resetPassword);
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const fragment = window.location.hash.slice(1);
    // Development strict effects may run twice; never replace the captured token with an empty fragment.
    if (fragment) {
      setToken(fragment);
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);
  return (
    <AuthShell title="Új jelszó" sub="Legalább 8 karaktert adj meg.">
      {done ? (
        <p role="status">Elmentettük az új jelszavad. Minden korábbi munkamenetet lezártunk.</p>
      ) : (
        <form
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            setPending(true);
            setError("");
            try {
              await reset({ data: { token, password } });
              setDone(true);
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : "A mentés nem sikerült.");
            } finally {
              setPending(false);
            }
          }}
        >
          <Label htmlFor="new-password">Új jelszó</Label>
          <Input
            id="new-password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button disabled={pending || !token} className="w-full">
            {pending ? "Mentés…" : "Új jelszó mentése"}
          </Button>
          {!token && <p role="alert">Nyisd meg a leveledben kapott hivatkozást.</p>}
        </form>
      )}
      <p className="mt-5 text-sm">
        <Link to={done ? "/login" : "/forgot-password"} className="underline">
          {done ? "Bejelentkezés" : "Új hivatkozást kérek"}
        </Link>
      </p>
    </AuthShell>
  );
}
