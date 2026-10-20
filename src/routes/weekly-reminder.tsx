import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { unsubscribeWeeklyReminder } from "@/lib/reminder.functions";
import { Button } from "@/components/ui/button";
import { AuthShell } from "./login";

export const Route = createFileRoute("/weekly-reminder")({
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, nofollow" },
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  component: UnsubscribePage,
});
function UnsubscribePage() {
  const unsubscribe = useServerFn(unsubscribeWeeklyReminder);
  const [token, setToken] = useState(""),
    [pending, setPending] = useState(false);
  const [done, setDone] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    const fragment = window.location.hash.slice(1);
    // Keep the captured token when development strict effects run twice.
    if (fragment) {
      setToken(fragment);
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);
  return (
    <AuthShell title="Heti emlékeztető" sub="Te döntöd el, szeretnél-e hétfői e-mailt.">
      {done ? (
        <p role="status">
          Leiratkoztál a heti emlékeztetőről. A fiókod és a posztjaid megmaradtak.
        </p>
      ) : (
        <>
          <p className="text-sm">
            A leiratkozás csak az emlékeztetőt kapcsolja ki. A szolgáltatást továbbra is
            használhatod.
          </p>
          <Button
            className="mt-5 min-h-11 w-full"
            disabled={pending || !token}
            onClick={async () => {
              setPending(true);
              setError("");
              try {
                await unsubscribe({ data: { token } });
                setDone(true);
                setToken("");
              } catch (cause) {
                setError(
                  cause instanceof Error
                    ? cause.message
                    : "Nem sikerült leiratkozni. Próbáld újra.",
                );
              } finally {
                setPending(false);
              }
            }}
          >
            {pending ? "Leiratkozás…" : "Leiratkozom az emlékeztetőről"}
          </Button>
          {!token && (
            <p className="mt-3 text-sm">
              Nyisd meg a levélben található leiratkozási hivatkozást, vagy módosítsd a beállítást a
              Vállalkozásom oldalon.
            </p>
          )}
        </>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      )}
      <Link to="/app/brand" className="mt-5 inline-flex min-h-11 items-center underline">
        Vállalkozásom
      </Link>
    </AuthShell>
  );
}
