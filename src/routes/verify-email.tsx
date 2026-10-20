import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { verifyEmail, resendVerification, getAuthConfiguration } from "@/lib/account.functions";
import { getCurrentUser } from "@/lib/auth.functions";
import { AuthShell } from "./login";
import { Button } from "@/components/ui/button";
export const Route = createFileRoute("/verify-email")({ loader: async () => ({ config: await getAuthConfiguration(), account: await getCurrentUser() }), component: VerifyEmailPage });
function VerifyEmailPage() {
  const { config, account } = Route.useLoaderData();
  const verify = useServerFn(verifyEmail);
  const resend = useServerFn(resendVerification);
  const started = useRef(false);
  const [message, setMessage] = useState(
    "Nyisd meg a levelünkben található megerősítő hivatkozást. Utána már készítheted is az első posztodat.",
  );
  const [verified, setVerified] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const consume = () => {
      const token = window.location.hash.slice(1);
      if (!token || started.current) return;
      started.current = true;
      window.history.replaceState(null, "", window.location.pathname);
      setPending(true);
      void verify({ data: { token } })
        .then(() => {
          setVerified(true);
          setMessage("Az e-mail-címedet megerősítetted. Készítsd el az első posztodat!");
        })
        .catch((cause) =>
          setError(cause instanceof Error ? cause.message : "A megerősítés nem sikerült."),
        )
        .finally(() => setPending(false));
    };
    consume();
    window.addEventListener("hashchange", consume);
    return () => window.removeEventListener("hashchange", consume);
  }, [verify]);
  return (
    <AuthShell
      title={account?.user.canUseAi ? "A fiókod használható" : "Erősítsd meg az e-mail-címed"}
      sub={account?.user.canUseAi && !account.user.emailVerified ? "A meghívókódos zárt bétában nincs szükség e-mail-megerősítésre." : config.developmentEmail ? "Fejlesztői próba: a hivatkozás a gép privát kimenőlevél-fájljában található." : "A megerősítő hivatkozás a levelünkben található."}
    >
      <p role="status" className="text-sm">
        {pending ? "Ellenőrzés…" : account?.user.canUseAi && !verified ? "Már elkezdheted a posztkészítést." : config.developmentEmail && !verified ? "Valódi levelet nem küldtünk; a fejlesztői kimenőlevelet használd a próbához." : !config.passwordResetAvailable ? "A levélküldés még nincs bekapcsolva." : message}
      </p>
      {error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      )}
      {verified || account?.user.canUseAi ? (
        <a
          className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-primary px-4 text-primary-foreground"
          href="/app/posts/new?first=1"
        >
          Első poszt elkészítése
        </a>
      ) : config.passwordResetAvailable ? (
        <Button
          className="mt-5 w-full"
          disabled={pending}
          onClick={async () => {
            setError("");
            setPending(true);
            try {
              await resend();
              setMessage(config.developmentEmail ? "A hivatkozást a privát fejlesztői kimenőlevél-fájlba mentettük." : "Elküldtük a levelet. Nézd meg a kéretlen levelek mappáját is.");
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : "A küldés nem sikerült.");
            } finally {
              setPending(false);
            }
          }}
        >
          Megerősítő e-mail újraküldése
        </Button>
      ) : null}
      <p className="mt-5 text-sm">
        <Link to="/login" className="underline">
          Bejelentkezés másik fiókkal
        </Link>
      </p>
    </AuthShell>
  );
}
