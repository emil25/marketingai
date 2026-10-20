import { createContext, useContext, useId, useState, type ReactNode } from "react";
import { toast } from "sonner";
import type { UiMode } from "@/lib/ui-mode";
type Preferences = { ui_mode: UiMode; suggestionDismissed: boolean };
const Context = createContext<{
  mode: UiMode;
  dismissed: boolean;
  pending: boolean;
  change: (mode: UiMode) => Promise<void>;
  dismiss: () => Promise<void>;
} | null>(null);
export function UiModeProvider({
  initial,
  children,
}: {
  initial: Preferences;
  children: ReactNode;
}) {
  const [preferences, setPreferences] = useState(initial);
  const [pending, setPending] = useState(false);
  async function save(input: Partial<Preferences>) {
    if (pending) return;
    setPending(true);
    try {
      const response = await fetch("/api/ui-preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!response.ok) throw new Error("Nem sikerült menteni a nézetet. Próbáld újra.");
      setPreferences(await response.json());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nem sikerült menteni.");
    } finally {
      setPending(false);
    }
  }
  return (
    <Context.Provider
      value={{
        mode: preferences.ui_mode,
        dismissed: preferences.suggestionDismissed,
        pending,
        change: (ui_mode) =>
          save({ ui_mode, ...(ui_mode === "detailed" ? { suggestionDismissed: true } : {}) }),
        dismiss: () => save({ suggestionDismissed: true }),
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useUiMode() {
  const value = useContext(Context);
  if (!value) throw new Error("Hiányzik a felületbeállítás.");
  return value;
}
export function UiModeSwitch() {
  const { mode, pending, change } = useUiMode();
  const switchId = useId();
  return (
    <fieldset id={switchId} className="min-w-0 scroll-mt-28" disabled={pending}>
      <legend className="mb-2 font-semibold">Mennyi lehetőséget szeretnél látni?</legend>
      <div className="grid grid-cols-2 gap-2" role="group" aria-label="Felület módja">
        {(
          [
            ["simple", "Egyszerű", "Csak a legfontosabb: poszt, heti terv."],
            ["detailed", "Részletes", "Minden lehetőség: kampányok, naptár, médiatár, csatornák."],
          ] as const
        ).map(([value, label, description]) => (
          <button
            type="button"
            key={value}
            aria-pressed={mode === value}
            onClick={() => void change(value)}
            className={`min-h-11 rounded-xl border p-3 text-left ${mode === value ? "border-primary bg-brand-soft" : "bg-card"}`}
          >
            <strong className="block">
              {label}
              {mode === value ? " ✓" : ""}
            </strong>
            <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
              {description}
            </span>
          </button>
        ))}
      </div>
      <span className="sr-only" role="status">
        {pending
          ? "Nézet mentése…"
          : `Aktív nézet: ${mode === "simple" ? "Egyszerű" : "Részletes"}`}
      </span>
    </fieldset>
  );
}
