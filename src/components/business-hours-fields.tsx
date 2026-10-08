import type { Dispatch, SetStateAction } from "react";
import type { BusinessHours } from "@/lib/onboarding-details";
import { Input } from "@/components/ui/input";

export function BusinessHoursFields({
  value,
  onChange,
}: {
  value: BusinessHours;
  onChange: Dispatch<SetStateAction<BusinessHours>>;
}) {
  const update = (index: number, fields: Partial<BusinessHours[number]>) =>
    onChange((current) => current.map((day, i) => (i === index ? { ...day, ...fields } : day)));
  return (
    <fieldset className="mt-4 space-y-2">
      <legend className="text-sm font-medium">Nyitvatartás napok szerint (opcionális)</legend>
      <p className="text-sm text-muted-foreground">
        Csak a megadott napokat mentjük. Az üres nap nem jelent zárva tartást.
      </p>
      {value.map((day, index) => (
        <div
          key={day.day}
          className="grid grid-cols-2 items-center gap-2 sm:grid-cols-[90px_1fr_1fr_1fr]"
        >
          <span className="text-sm">{day.day}</span>
          <select
            aria-label={`${day.day} állapota`}
            value={day.status}
            onChange={(event) =>
              update(index, { status: event.target.value as BusinessHours[number]["status"] })
            }
            className="h-10 min-w-0 rounded-md border bg-background px-2 text-sm"
          >
            <option value="unknown">Nincs megadva</option>
            <option value="open">Nyitva</option>
            <option value="closed">Zárva</option>
          </select>
          {day.status === "open" && (
            <>
              <Input
                aria-label={`${day.day} nyitás`}
                type="time"
                value={day.from}
                onChange={(event) => update(index, { from: event.target.value })}
              />
              <Input
                aria-label={`${day.day} zárás`}
                type="time"
                value={day.to}
                onChange={(event) => update(index, { to: event.target.value })}
              />
            </>
          )}
        </div>
      ))}
    </fieldset>
  );
}
