import assert from "node:assert/strict";
import { test } from "node:test";
import { openRouterChat } from "../src/lib/server/ai-provider.server.ts";

test("short campaign requests use their own token budget without changing other AI requests", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.OPENROUTER_API_KEY;
  process.env.OPENROUTER_API_KEY = "unit-test-transport-only";
  const bodies: Array<Record<string, unknown>> = [];
  globalThis.fetch = async (_url, options) => {
    bodies.push(JSON.parse(String(options?.body)));
    return new Response("{}", { status: 200 });
  };
  try {
    const input = {
      messages: [{ role: "user" as const, content: "Test" }],
      schemaName: "test",
      schema: { type: "object" },
    };
    await openRouterChat({ ...input, maxTokens: 3500 });
    await openRouterChat({ ...input, maxTokens: 2000 });
    await openRouterChat(input);
    await openRouterChat({ ...input, maxTokens: 4000, deadlineAt: Date.now() + 5000 });
    assert.throws(() => openRouterChat({ ...input, deadlineAt: Date.now() - 1 }), /időkorlát/);
    assert.deepEqual(
      bodies.map((body) => body.max_tokens),
      [3500, 2000, 16000, 4000],
    );
    assert(bodies.every((body) => JSON.stringify(body.response_format).includes('"strict":true')));
    assert(bodies.every((body) => !JSON.stringify(body).includes("unit-test-transport-only")));
    assert(bodies.every((body) => !("deadlineAt" in body)));
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = originalKey;
  }
});
