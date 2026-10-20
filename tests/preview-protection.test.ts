import test from "node:test";
import assert from "node:assert/strict";
import type { BrowserContext } from "@playwright/test";
import { preparePreviewProtection } from "./e2e/protection";

test("preview protection sends the credential only to the origin, with redirects disabled", async () => {
  let calls = 0,
    disposed = false;
  const context = {
    request: {
      get: async (
        url: string,
        options: { maxRedirects: number; headers: Record<string, string> },
      ) => {
        calls++;
        assert.equal(url, "https://preview.example.invalid");
        assert.equal(options.maxRedirects, 0);
        assert.equal(options.headers["x-vercel-set-bypass-cookie"], "true");
        return {
          status: () => 307,
          dispose: async () => {
            disposed = true;
          },
        };
      },
    },
  } as unknown as BrowserContext;
  await preparePreviewProtection(
    context,
    "https://preview.example.invalid/",
    "test-only-credential",
  );
  assert.equal(calls, 1);
  assert.equal(disposed, true);
});

test("preview protection discards network errors that could contain secret request headers", async () => {
  const context = {
    request: {
      get: async () => {
        throw new Error("request headers: test-only-credential");
      },
    },
  } as unknown as BrowserContext;
  await assert.rejects(
    preparePreviewProtection(context, "https://preview.example.invalid", "test-only-credential"),
    (error: Error) => {
      assert.ok(error.message.includes("hozzáférését"));
      assert.ok(!error.message.includes("test-only-credential"));
      return true;
    },
  );
});
