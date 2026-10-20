import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getReminderPreference, saveReminderPreference } from "@/lib/reminder.functions";
import { Card } from "./ui/card";
import { Button } from "./ui/button";

export function WeeklyReminderSetting() {
  const load = useServerFn(getReminderPreference),
    save = useServerFn(saveReminderPreference);
  const [state, setState] = useState<{ enabled: boolean; available: boolean } | null>(null);
  const [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const busy = useRef(false);
  useEffect(() => {
    let active = true;
    void load()
      .then((value) => {
        if (active) setState(value);
      })
      .catch(() => {
        if (active)
          setError("Nem sikerült betölteni az emlékeztető beállítását. Frissítsd az oldalt.");
      });
    return () => {
      active = false;
    };
  }, [load]);
  return (
    <Card className="space-y-3 p-5" id="weekly-reminder">
      <h2 className="text-xl font-semibold">Heti emlékeztető</h2>
      <p className="text-sm text-muted-foreground">
        Ha kéred, hétfő reggel e-mailben emlékeztetünk a heti tervedre. Nem posztolunk helyetted.
        Bármikor kikapcsolhatod.
      </p>
      {state ? (
        <>
          <label className="flex min-h-11 cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              className="h-5 w-5 accent-primary"
              checked={state.enabled}
              disabled={pending || (!state.available && !state.enabled)}
              onChange={async (event) => {
                if (busy.current) return;
                const enabled = event.target.checked;
                busy.current = true;
                setPending(true);
                setError("");
                setMessage("");
                try {
                  const result = await save({ data: { enabled } });
                  setState((current) =>
                    current ? { ...current, enabled: result.enabled } : current,
                  );
                  setMessage(
                    result.enabled
                      ? "Bekapcsoltuk a heti emlékeztetőt."
                      : "Kikapcsoltuk a heti emlékeztetőt.",
                  );
                } catch (cause) {
                  setError(
                    cause instanceof Error ? cause.message : "Nem sikerült menteni. Próbáld újra.",
                  );
                } finally {
                  busy.current = false;
                  setPending(false);
                }
              }}
            />
            <span>Kérek hétfői emlékeztetőt</span>
          </label>
          {!state.available && (
            <p className="text-sm text-muted-foreground">
              Az e-mailes emlékeztető még előkészítés alatt áll. A heti tervet addig is bármikor
              megnyithatod.
            </p>
          )}
        </>
      ) : (
        !error && (
          <p role="status" className="text-sm">
            Beállítás betöltése…
          </p>
        )
      )}
      {pending && (
        <p role="status" className="text-sm">
          Mentés…
        </p>
      )}
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
      {error && (
        <>
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
          {!state && (
            <Button
              variant="outline"
              onClick={async () => {
                setError("");
                try {
                  setState(await load());
                } catch {
                  setError("A beállítás most nem érhető el. Próbáld újra később.");
                }
              }}
            >
              Újrapróbálom
            </Button>
          )}
        </>
      )}
    </Card>
  );
}
