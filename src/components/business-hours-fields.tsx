import { useState, type Dispatch, type SetStateAction } from "react";
import type { BusinessHours } from "@/lib/onboarding-details";
import { Input } from "@/components/ui/input";

export function BusinessHoursFields({
  value,
  onChange,
}: {
  value: BusinessHours;
  onChange: Dispatch<SetStateAction<BusinessHours>>;
}) {
  const [mode, setMode] = useState<"all" | "groups" | "daily">("groups");
  const groups =
    mode === "all"
      ? [{ label: "Minden nap", indexes: [0, 1, 2, 3, 4, 5, 6] }]
      : mode === "groups"
        ? [
            { label: "Hétköznap", indexes: [0, 1, 2, 3, 4] },
            { label: "Szombat", indexes: [5] },
            { label: "Vasárnap", indexes: [6] },
          ]
        : value.map((day, index) => ({ label: day.day, indexes: [index] }));
  const count = value.filter((day) => day.status !== "unknown").length;
  return (
    <details className="mt-4 rounded-xl border p-3">
      <summary className="cursor-pointer text-sm font-medium">
        Nyitvatartás (opcionális) · {count ? `${count} nap megadva` : "Megadás"}
      </summary>
      <fieldset className="mt-3 space-y-3">
        <legend className="sr-only">Nyitvatartás szerkesztése</legend>
        <div className="flex flex-wrap gap-2" aria-label="Nyitvatartás gyorsválasztó">
          {(
            [
              ["all", "Minden nap ugyanaz"],
              ["groups", "Hétköznap / hétvége"],
              ["daily", "Naponként"],
            ] as const
          ).map(([key, label]) => (
            <button
              type="button"
              key={key}
              aria-pressed={mode === key}
              onClick={() => setMode(key)}
              className={`min-h-11 rounded-lg border px-3 text-sm ${mode === key ? "border-brand bg-brand-soft" : "bg-background"}`}
            >
              {label}
            </button>
          ))}
        </div>
        {groups.map(({ label, indexes }) => {
          const first = value[indexes[0]];
          const mixed = indexes.some(
            (index) =>
              value[index].status !== first.status ||
              value[index].from !== first.from ||
              value[index].to !== first.to,
          );
          const closed = !mixed && first.status === "closed";
          const update = (fields: Partial<BusinessHours[number]>) =>
            onChange((current) =>
              current.map((day, index) => {
                if (!indexes.includes(index)) return day;
                const next = {
                  ...day,
                  ...(mixed ? { from: "", to: "", status: "unknown" as const } : {}),
                  ...fields,
                };
                if (fields.from !== undefined || fields.to !== undefined)
                  next.status = next.from || next.to ? "open" : "unknown";
                return next;
              }),
            );
          return (
            <div key={label} className="space-y-1">
              <span className="text-sm font-medium">{label}</span>
              {mixed && (
                <p className="text-xs text-muted-foreground">
                  Eltérő napi időpontok. Itt együtt módosíthatod, vagy válaszd a Naponként nézetet.
                </p>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  className="h-11 min-w-0 w-[calc(50%-4px)] sm:w-32"
                  aria-label={`${label} nyitás`}
                  type="time"
                  disabled={closed}
                  value={mixed ? "" : first.from}
                  onChange={(event) => update({ from: event.target.value })}
                />
                <Input
                  className="h-11 min-w-0 w-[calc(50%-4px)] sm:w-32"
                  aria-label={`${label} zárás`}
                  type="time"
                  disabled={closed}
                  value={mixed ? "" : first.to}
                  onChange={(event) => update({ to: event.target.value })}
                />
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input
                    className="h-4 w-4 accent-primary"
                    type="checkbox"
                    checked={closed}
                    onChange={(event) =>
                      update({
                        status: event.target.checked
                          ? "closed"
                          : first.from || first.to
                            ? "open"
                            : "unknown",
                      })
                    }
                  />
                  {label} zárva
                </label>
              </div>
            </div>
          );
        })}
        <p className="text-sm text-muted-foreground">Az üres időpont nem jelent zárva tartást.</p>
      </fieldset>
    </details>
  );
}
