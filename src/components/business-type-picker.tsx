import { useState } from "react";
import {
  BedDouble,
  Car,
  Check,
  Dumbbell,
  House,
  Scale,
  Smile,
  Sparkles,
  Utensils,
} from "lucide-react";
import {
  BUSINESS_TYPES,
  businessTypeLabel,
  businessTypeQuickStarts,
  normalizeBusinessType,
} from "@/lib/business-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const featured = [
  "restaurant",
  "accommodation",
  "dental_practice",
  "lawyer",
  "real_estate",
  "fitness",
  "beauty_salon",
  "car_dealer",
];
const icons = {
  restaurant: Utensils,
  accommodation: BedDouble,
  dental_practice: Smile,
  lawyer: Scale,
  real_estate: House,
  fitness: Dumbbell,
  beauty_salon: Sparkles,
  car_dealer: Car,
};

export function BusinessTypePicker({
  value,
  savedValue,
  disabled,
  canSave,
  onChange,
  onSave,
}: {
  value: string;
  savedValue?: string;
  disabled: boolean;
  canSave: boolean;
  onChange: (value: string) => void;
  onSave: () => void;
}) {
  const [expanded, setExpanded] = useState(false),
    [query, setQuery] = useState("");
  const selected = normalizeBusinessType(value);
  const saved = savedValue == null ? null : normalizeBusinessType(savedValue);
  const types = [...BUSINESS_TYPES]
    .sort((a, b) => {
      const rank = (id: string) => (featured.includes(id) ? featured.indexOf(id) : featured.length);
      return rank(a.value) - rank(b.value);
    })
    .filter((item) =>
      query.trim()
        ? item.label.toLocaleLowerCase("hu-HU").includes(query.trim().toLocaleLowerCase("hu-HU"))
        : expanded || featured.includes(item.value) || item.value === selected,
    );
  return (
    <section
      id="business-type"
      className="tt-card rounded-2xl border bg-card p-5 sm:p-6"
      aria-labelledby="business-type-heading"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 id="business-type-heading" className="text-xl font-semibold">
            Vállalkozásodra szabva
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Válassz egy irányt, és a MarketingPilot hozzád illő posztötletekkel és gyorsindítókkal
            dolgozik. Nem kell új alkalmazást telepítened; később bármikor módosíthatod.
          </p>
        </div>
        <Input
          aria-label="Vállalkozástípus keresése"
          placeholder="Milyen vállalkozásod van?"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="w-full sm:w-64"
          disabled={disabled}
        />
      </div>
      <div
        className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
        role="group"
        aria-label="Vállalkozástípusok"
      >
        {types.map((item) => {
          const Icon = icons[item.value as keyof typeof icons] ?? Sparkles;
          const active = item.value === selected;
          return (
            <button
              key={item.value}
              type="button"
              aria-pressed={active}
              disabled={disabled}
              onClick={() => onChange(item.value)}
              className={`rounded-xl border p-4 text-left transition hover:border-primary disabled:opacity-50 ${active ? "border-primary bg-primary/5" : "bg-background"}`}
            >
              <div className="flex items-center justify-between">
                <Icon className="h-6 w-6 text-primary" />
                {active && <Check className="h-4 w-4 text-primary" />}
              </div>
              <strong className="mt-3 block text-base">{item.label}</strong>
              <span className="mt-2 block text-sm text-muted-foreground">
                {item.quickStarts.slice(0, 3).join(" · ")}
              </span>
              {active && (
                <span className="mt-3 block text-sm font-medium text-primary">
                  {selected === saved ? "Mentett típus" : "Kijelölve · mentésre vár"}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {!types.length && (
        <p className="mt-4 text-sm" role="status">
          Nincs ilyen találat. Válaszd az „Egyéb” típust, és a saját szolgáltatásaid alapján
          dolgozunk.
        </p>
      )}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setQuery("");
            setExpanded((current) => !current);
          }}
          disabled={disabled}
        >
          {expanded ? "Kevesebb típus" : "Összes vállalkozástípus"}
        </Button>
        <Button
          type="button"
          onClick={onSave}
          disabled={disabled || !canSave || selected === saved}
        >
          {disabled ? "Mentés…" : "Választás és márka mentése"}
        </Button>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">
        {businessTypeLabel(selected)}: {businessTypeQuickStarts(selected).slice(0, 3).join(" · ")}.{" "}
        {saved == null || selected !== saved
          ? "A választás mentés után érvényesül az AI-nál és az áttekintés gyorsgombjainál."
          : "Az új AI-generálások ezt a mentett típust használják."}
      </p>
      {!canSave && <p className="mt-2 text-sm">A mentéshez add meg lent a márkád nevét.</p>}
    </section>
  );
}
