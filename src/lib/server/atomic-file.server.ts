import { rename } from "node:fs/promises";
import { setTimeout } from "node:timers/promises";

/** Windows readers/antivirus can briefly lock the destination. Never truncate it. */
export async function replaceAtomicFile(
  source: string,
  destination: string,
  move = rename,
  pause: (ms: number) => Promise<unknown> = setTimeout,
) {
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      await move(source, destination);
      return;
    } catch (error) {
      const code =
        error && typeof error === "object" && "code" in error ? String(error.code) : "UNKNOWN";
      if (["EPERM", "EACCES", "EBUSY"].includes(code) && attempt < 7) {
        await pause(Math.min(200, 20 * 2 ** attempt));
        continue;
      }
      console.error("Atomic local storage replacement failed", { code, attempts: attempt + 1 });
      throw new Error("A mentés most nem sikerült. A korábbi adataid megmaradtak; próbáld újra.");
    }
  }
}
