import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { createMediaStorage } from "../src/lib/server/media-storage.server";

const id = "media_1234-abcd";

test("local media survives reopening and cannot overwrite an existing asset", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "marketingpilot-media-test-"));
  try {
    const storage = createMediaStorage(directory, { MEDIA_STORAGE: "local" });
    await storage.write(id, Buffer.from("owned test bytes"));
    const reopened = createMediaStorage(directory, { MEDIA_STORAGE: "local" });
    assert.equal((await reopened.read(id)).toString(), "owned test bytes");
    await assert.rejects(storage.write(id, Buffer.from("overwrite")));
    assert.equal((await reopened.read(id)).toString(), "owned test bytes");
    await storage.remove(id);
    await assert.rejects(reopened.read(id));
  } finally {
    assert.equal(path.dirname(path.resolve(directory)), path.resolve(tmpdir()));
    assert.ok(path.basename(directory).startsWith("marketingpilot-media-test-"));
    await rm(directory, { recursive: true, force: true });
  }
});

test("Vercel never silently saves media to ephemeral disk", async () => {
  const storage = createMediaStorage("unused", { VERCEL: "1" });
  await assert.rejects(storage.write(id, Buffer.from("test")), /online képtár/);
  await assert.rejects(storage.read(id), /online képtár/);
});

test("invalid IDs and oversized bytes are rejected before storage calls", async () => {
  const storage = createMediaStorage("unused", { MEDIA_STORAGE: "vercel-blob" });
  await assert.rejects(storage.read("../outside"), /Érvénytelen/);
  await assert.rejects(storage.remove("https://other.example/key"), /Érvénytelen/);
  await assert.rejects(storage.write(id, new Uint8Array(0)), /üres/);
  await assert.rejects(storage.write(id, new Uint8Array(21 * 1024 * 1024)), /túl nagy/);
});

test("private Blob reads/writes use immutable IDs and propagate failures", async () => {
  const calls: string[] = [];
  let fail = false;
  const api = {
    put: async (pathname: string, _bytes: Buffer, options: Record<string, unknown>) => {
      calls.push(`write:${pathname}`);
      assert.equal(options.access, "private");
      assert.equal(options.allowOverwrite, false);
      assert.equal(options.addRandomSuffix, false);
      if (fail) throw new Error("Storage unavailable");
    },
    get: async (pathname: string, options: Record<string, unknown>) => {
      calls.push(`read:${pathname}`);
      assert.equal(options.access, "private");
      return { statusCode: 200, blob: { size: 4 }, stream: new Response("test").body };
    },
    del: async (pathname: string) => { calls.push(`remove:${pathname}`); },
  } as unknown as NonNullable<Parameters<typeof createMediaStorage>[2]>;
  const storage = createMediaStorage("unused", { MEDIA_STORAGE: "vercel-blob" }, api);
  await storage.write(id, Buffer.from("test"));
  assert.equal((await storage.read(id)).toString(), "test");
  await storage.remove(id);
  assert.deepEqual(calls, [
    `write:marketingpilot/${id}`, `read:marketingpilot/${id}`, `remove:marketingpilot/${id}`,
  ]);
  fail = true;
  await assert.rejects(storage.write(id, Buffer.from("test")), /Storage unavailable/);
});
