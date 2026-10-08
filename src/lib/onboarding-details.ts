export function normalizeBusinessWebsite(value: string) {
  const text = value.trim();
  if (!text) return "";
  const candidate = /^[a-z][a-z\d+.-]*:/i.test(text) ? text : `https://${text}`;
  try {
    const url = new URL(candidate);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      !url.hostname.includes(".") ||
      url.username ||
      url.password
    )
      throw new Error();
    return url.toString();
  } catch {
    throw new Error("Adj meg érvényes webcímet, például pelda.ro.");
  }
}

export const BUSINESS_DAYS = [
  "Hétfő",
  "Kedd",
  "Szerda",
  "Csütörtök",
  "Péntek",
  "Szombat",
  "Vasárnap",
] as const;
export type BusinessHours = {
  day: string;
  status: "unknown" | "open" | "closed";
  from: string;
  to: string;
}[];
export const emptyBusinessHours = (): BusinessHours =>
  BUSINESS_DAYS.map((day) => ({ day, status: "unknown", from: "", to: "" }));
export function serializeBusinessHours(days: BusinessHours) {
  return days
    .filter((day) => day.status !== "unknown")
    .map((day) => {
      if (day.status === "closed") return `${day.day}: zárva`;
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(day.from) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(day.to))
        throw new Error(
          `${day.day}: add meg a nyitás és zárás időpontját, vagy válaszd a Nincs megadva állapotot.`,
        );
      return `${day.day}: ${day.from}–${day.to}${day.to <= day.from ? " (zárás másnap)" : ""}`;
    })
    .join("; ");
}

export const MAX_LOGO_SIZE = 2 * 1024 * 1024;
export const LOGO_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"];
export function validateLogoFile(file: { size: number; type: string }) {
  if (!LOGO_MIME_TYPES.includes(file.type.toLowerCase()))
    throw new Error("PNG, JPEG vagy WebP logót válassz.");
  if (!file.size || file.size > MAX_LOGO_SIZE) throw new Error("A logó legfeljebb 2 MB lehet.");
}
export function validateLogoBytes(bytes: Uint8Array, mimeType: string) {
  validateLogoFile({ size: bytes.length, type: mimeType });
  const png =
    bytes.length >= 8 &&
    [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value);
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const text = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));
  const webp = bytes.length >= 12 && text(0, 4) === "RIFF" && text(8, 12) === "WEBP";
  if (!(mimeType === "image/png" ? png : mimeType === "image/jpeg" ? jpeg : webp))
    throw new Error("A fájl tartalma nem felel meg a választott képtípusnak.");
}
