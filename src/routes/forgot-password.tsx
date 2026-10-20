import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { requestPasswordReset, getAuthConfiguration } from "@/lib/account.functions";
import { AuthShell } from "./login";
import { AuthChallenge } from "@/components/auth-challenge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
export const Route = createFileRoute("/forgot-password")({ loader: () => getAuthConfiguration(), component: ForgotPasswordPage });
function ForgotPasswordPage() {
  const request = useServerFn(requestPasswordReset);
  const config = Route.useLoaderData();
  const [email, setEmail] = useState("");
  const [botToken, setToken] = useState("");
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  return (
    <AuthShell
      title="Elfelejtett jelszó"
      sub={config.passwordResetAvailable ? "Egyszer használható jelszó-visszaállító hivatkozást készítünk." : "Hamarosan: jelszó-visszaállítás e-mailben."}
    >
      {!config.passwordResetAvailable ? <p>A levélküldés még nincs bekapcsolva. Ha be vagy jelentkezve, a Vállalkozásom oldalon változtathatod meg a jelszavadat.</p> : sent ? (
        <p role="status">
          {config.developmentEmail ? "Fejlesztői környezet: a hivatkozást a gép privát kimenőlevél-fájljába mentettük, ha ehhez a címhez tartozik fiók. Valódi levelet nem küldtünk." : "Ha ehhez az e-mail-címhez tartozik fiók, elküldjük a levelet. Nézd meg a kéretlen levelek mappáját is."}
        </p>
      ) : (
        <form
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            setPending(true);
            setError("");
            try {
              await request({ data: { email, botToken } });
              setSent(true);
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : "A küldés nem sikerült.");
              setAttempt((n) => n + 1);
            } finally {
              setPending(false);
            }
          }}
        >
          <Label htmlFor="reset-email">E-mail-cím</Label>
          <Input
            id="reset-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <AuthChallenge key={attempt} action="reset" onReady={setReady} onToken={setToken} />
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button disabled={pending || !ready} className="w-full">
            {pending ? "Küldés…" : "Hivatkozás küldése"}
          </Button>
        </form>
      )}
      <p className="mt-5 text-sm">
        <Link to="/login" className="underline">
          Vissza a belépéshez
        </Link>
      </p>
    </AuthShell>
  );
}
