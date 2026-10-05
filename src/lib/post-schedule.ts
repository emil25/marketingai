const INPUT_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

function formatter(timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
}

function partsFor(
  date: Date,
  timeZone: string,
  includeSeconds = false,
  dateFormatter?: Intl.DateTimeFormat,
) {
  const activeFormatter = dateFormatter ?? formatter(timeZone);
  const values = Object.fromEntries(
    activeFormatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  const result = `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
  return includeSeconds ? `${result}:${values.second}` : result;
}

function parseInput(value: string) {
  const match = INPUT_RE.exec(value);
  if (!match) throw new Error("A dátum és idő formátuma érvénytelen.");
  const [, y, m, d, h, min, seconds = "00"] = match;
  const year = Number(y),
    month = Number(m),
    day = Number(d),
    hour = Number(h),
    minute = Number(min),
    second = Number(seconds);
  const utc = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== day ||
    utc.getUTCHours() !== hour ||
    utc.getUTCMinutes() !== minute ||
    utc.getUTCSeconds() !== second
  ) {
    throw new Error("A megadott dátum vagy időpont érvénytelen.");
  }
  return { year, month, day, hour, minute, second, utcMs: utc.getTime() };
}

export function formatPostScheduleInput(
  scheduledAt: string | null | undefined,
  timeZone: string,
): string {
  if (!scheduledAt) return "";
  try {
    const date = new Date(scheduledAt);
    if (Number.isNaN(date.getTime())) return "";
    return partsFor(date, timeZone);
  } catch {
    return "";
  }
}

/** Converts a datetime-local value in the selected IANA zone to an ISO instant.
 * Ambiguous fall-back times resolve to the earliest matching instant. */
export function parsePostScheduleInput(localInput: string, timeZone: string): string | null {
  if (!localInput) return null;
  const input = parseInput(localInput);
  // Validates the IANA zone and also gives a stable error for unknown zones.
  let dateFormatter: Intl.DateTimeFormat;
  try {
    dateFormatter = formatter(timeZone);
  } catch {
    throw new Error("Az időzóna érvénytelen vagy nem támogatott.");
  }
  const matches: number[] = [];
  // Gather the small set of offsets used around the requested date, then test
  // only the corresponding instants. This avoids thousands of Intl calls.
  const offsets = new Set<number>();
  for (let delta = -36; delta <= 36; delta += 3) {
    const sample = input.utcMs + delta * 60 * 60 * 1000;
    const sampleParts = Object.fromEntries(
      dateFormatter
        .formatToParts(new Date(sample))
        .filter((part) => part.type !== "literal")
        .map((part) => [part.type, part.value]),
    );
    offsets.add(
      Date.UTC(
        Number(sampleParts.year),
        Number(sampleParts.month) - 1,
        Number(sampleParts.day),
        Number(sampleParts.hour),
        Number(sampleParts.minute),
        Number(sampleParts.second),
      ) - sample,
    );
  }
  for (const offset of offsets) {
    const instant = input.utcMs - offset;
    if (
      partsFor(new Date(instant), timeZone, true, dateFormatter) ===
      `${localInput.slice(0, 16)}:${String(input.second).padStart(2, "0")}`
    ) {
      matches.push(instant);
    }
  }
  if (!matches.length) throw new Error("A megadott helyi időpont nem létezik ebben az időzónában.");
  return new Date(Math.min(...matches)).toISOString();
}
