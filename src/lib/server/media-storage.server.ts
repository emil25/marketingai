import { mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { del, get, put } from "@vercel/blob";

const MAX_BYTES = 20 * 1024 * 1024;
const blobApi = { del, get, put };

/** Called only after the application's workspace/brand ownership checks. */
export function createMediaStorage(
  directory: string,
  environment: NodeJS.ProcessEnv = process.env,
  api: typeof blobApi = blobApi,
) {
  function key(id: string) {
    if (!/^media_[a-f0-9-]+$/i.test(id)) throw new Error("Érvénytelen médiaazonosító.");
    return `marketingpilot/${id}`;
  }
  function useBlob() {
    const mode = environment.MEDIA_STORAGE?.trim();
    if (mode && mode !== "local" && mode !== "vercel-blob")
      throw new Error("Ismeretlen médiatároló beállítás.");
    if (environment.VERCEL && mode !== "vercel-blob")
      throw new Error("Az online képtár nincs beállítva. Ideiglenes lemezre nem mentünk képet.");
    return mode === "vercel-blob";
  }
  return {
    async write(id: string, bytes: Uint8Array) {
      const pathname = key(id);
      if (!bytes.byteLength || bytes.byteLength > MAX_BYTES)
        throw new Error("A médiafájl üres vagy túl nagy.");
      if (useBlob()) {
        await api.put(pathname, Buffer.from(bytes), {
          access: "private",
          addRandomSuffix: false,
          allowOverwrite: false,
          contentType: "application/octet-stream",
          abortSignal: AbortSignal.timeout(60_000),
        });
        return;
      }
      await mkdir(directory, { recursive: true });
      // IDs are immutable; a duplicate must never overwrite an existing asset.
      await writeFile(path.join(directory, id), bytes, { flag: "wx" });
    },
    async read(id: string) {
      const pathname = key(id);
      if (useBlob()) {
        const result = await api.get(pathname, {
          access: "private",
          abortSignal: AbortSignal.timeout(60_000),
        });
        if (!result || result.statusCode !== 200) throw new Error("A médiafájl nem található.");
        if (result.blob.size > MAX_BYTES) {
          await result.stream.cancel();
          throw new Error("A médiafájl túl nagy.");
        }
        const bytes = Buffer.from(await new Response(result.stream).arrayBuffer());
        if (bytes.length > MAX_BYTES) throw new Error("A médiafájl túl nagy.");
        return bytes;
      }
      const filename = path.join(directory, id);
      if ((await stat(filename)).size > MAX_BYTES) throw new Error("A médiafájl túl nagy.");
      return readFile(filename);
    },
    async remove(id: string) {
      const pathname = key(id);
      if (useBlob()) {
        await api.del(pathname, { abortSignal: AbortSignal.timeout(60_000) });
        return;
      }
      try {
        await unlink(path.join(directory, id));
      } catch (error) {
        if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
      }
    },
  };
}
