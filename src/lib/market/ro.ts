export type CityNameMode = "hu" | "ro" | "both";

const CITY_NAMES: Record<string, string> = {
  csíkszereda: "Miercurea Ciuc",
  sepsiszentgyörgy: "Sfântu Gheorghe",
  kézdivásárhely: "Târgu Secuiesc",
  székelyudvarhely: "Odorheiu Secuiesc",
  gyergyószentmiklós: "Gheorgheni",
  marosvásárhely: "Târgu Mureș",
  kolozsvár: "Cluj-Napoca",
  nagyvárad: "Oradea",
  brassó: "Brașov",
};

export function displayCityName(city: string, mode: CityNameMode = "hu") {
  const source = city.trim();
  if (!source) return "";
  const romanian = CITY_NAMES[source.toLocaleLowerCase("hu-RO")];
  if (mode === "hu" || !romanian) return source;
  return mode === "ro" ? romanian : `${source} / ${romanian}`;
}

export function formatRonAmount(amount: number | string, unit: "lei" | "RON" = "lei") {
  const numeric = typeof amount === "number" ? amount : Number(amount.replace(",", "."));
  if (!Number.isFinite(numeric) || numeric < 0) throw new Error("Adj meg érvényes lej összeget.");
  const value = new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 2 }).format(numeric);
  return `${value} ${unit}`;
}

/** Keep Romanian numbers in international +40 form when normalizing a stored contact. */
export function normalizeRomanianPhone(input: string) {
  const value = input.trim();
  if (!value) return "";
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("0040")) return `+40${digits.slice(4)}`;
  if (digits.startsWith("40")) return `+${digits}`;
  if (digits.startsWith("0")) return `+40${digits.slice(1)}`;
  return value.startsWith("+") ? `+${digits}` : value;
}

export function formatRomanianPhone(input: string) {
  const normalized = normalizeRomanianPhone(input);
  if (!normalized.startsWith("+40")) return normalized;
  const national = normalized.slice(3).replace(/\D/g, "");
  if (!national) return "+40";
  const groups = national.length === 9
    ? [national.slice(0, 3), national.slice(3, 6), national.slice(6)]
    : [national.slice(0, 3), national.slice(3, 6), national.slice(6)];
  return `+40 ${groups.filter(Boolean).join(" ")}`;
}

export type RomanianAddress = {
  city?: string;
  street?: string;
  houseNumber?: string;
  county?: string;
};

export function formatRomanianAddress(address: RomanianAddress, cityMode: CityNameMode = "hu") {
  return [
    displayCityName(address.city ?? "", cityMode),
    address.street?.trim(),
    address.houseNumber?.trim(),
    address.county?.trim(),
  ]
    .filter(Boolean)
    .join(", ");
}

type MarketEvent = { date: string; name: string; source: "romanian" | "hungarian" | "local"; };
const validIsoDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

function westernEaster(year: number) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

function orthodoxEaster(year: number) {
  const a = year % 4, b = year % 7, c = year % 19;
  const d = (19 * c + 15) % 30, e = (2 * a + 4 * b - d + 34) % 7;
  const month = Math.floor((d + e + 114) / 31), day = ((d + e + 114) % 31) + 1;
  // Julian to Gregorian offset for the supported contemporary market calendar.
  return new Date(Date.UTC(year, month - 1, day + 13));
}

const isoDate = (date: Date) => date.toISOString().slice(0, 10);

/** Only events with exact dates are passed to the weekly generator. */
export function localMarketEvents(startDate: string, endDate: string, customEvents = ""): MarketEvent[] {
  const start = Date.parse(`${startDate}T00:00:00Z`), end = Date.parse(`${endDate}T23:59:59Z`);
  if (!validIsoDate(startDate) || !validIsoDate(endDate) || !Number.isFinite(start) || !Number.isFinite(end) || end < start) return [];
  const startYear = new Date(start).getUTCFullYear(), endYear = new Date(end).getUTCFullYear();
  const events: MarketEvent[] = [];
  const add = (date: string, name: string, source: MarketEvent["source"]) => {
    const stamp = Date.parse(`${date}T12:00:00Z`);
    if (stamp >= start && stamp <= end) events.push({ date, name, source });
  };
  for (let year = startYear; year <= endYear; year++) {
    for (const [month, day, name, source] of [
      [1, 1, "Újév", "romanian"], [1, 24, "Román fejedelemségek egyesülése", "romanian"],
      [1, 2, "Újév másnapja", "romanian"], [1, 6, "Vízkereszt", "romanian"],
      [1, 7, "Keresztelő Szent János napja", "romanian"], [3, 15, "Március 15.", "hungarian"],
      [5, 1, "A munka ünnepe", "romanian"],
      [6, 1, "Gyermeknap", "romanian"], [8, 15, "Nagyboldogasszony", "romanian"],
      [8, 20, "Szent István napja", "hungarian"], [10, 23, "Az 1956-os forradalom emléknapja", "hungarian"],
      [11, 1, "Mindenszentek", "hungarian"], [11, 30, "Szent András napja", "romanian"],
      [12, 1, "Románia nemzeti ünnepe", "romanian"], [12, 25, "Karácsony", "romanian"],
      [12, 26, "Karácsony másnapja", "romanian"],
    ] as const) add(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`, name, source);
    for (const [easter, name, source] of [
      [westernEaster(year), "Nyugati húsvét (katolikus és református naptár)", "hungarian"],
      [orthodoxEaster(year), "Ortodox húsvét", "romanian"],
    ] as const) {
      for (const [offset, dayLabel] of [[-2, "Nagypéntek"], [0, name], [1, "Húsvéthétfő"]] as const) {
        const date = new Date(easter.getTime() + offset * 86400000);
        add(isoDate(date), offset === 0 ? name : `${dayLabel} · ${name}`, source);
      }
    }
  }
  for (const line of customEvents.split(/\r?\n/)) {
    const match = line.trim().match(/^(\d{4}-\d{2}-\d{2})\s*(?:[–—|:]\s*|\s+)(.{2,160})$/u);
    if (match && validIsoDate(match[1]) && match[1] >= startDate && match[1] <= endDate)
      events.push({ date: match[1], name: match[2].trim(), source: "local" });
  }
  return [...new Map(events.map((event) => [`${event.date}:${event.name}`, event])).values()]
    .sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name, "hu-RO"));
}

export type SeasonKey = "tavasz" | "nyár" | "ősz" | "tél";
export function seasonForDate(date: string): SeasonKey | undefined {
  if (!validIsoDate(date)) return undefined;
  const month = Number(date.slice(5, 7));
  return month >= 3 && month <= 5 ? "tavasz" : month >= 6 && month <= 8 ? "nyár" : month >= 9 && month <= 11 ? "ősz" : "tél";
}
