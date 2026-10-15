import assert from "node:assert/strict";
import { test } from "node:test";
import { openRouterChat, openRouterImage } from "../src/lib/server/ai-provider.server.ts";

test("Gemini text provider uses its server key and leaves images on OpenRouter", async () => {
  const env = {
    provider: process.env.AI_TEXT_PROVIDER,
    geminiKey: process.env.GEMINI_API_KEY,
    openRouterKey: process.env.OPENROUTER_API_KEY,
    geminiModel: process.env.GEMINI_TEXT_MODEL,
  };
  const originalFetch = globalThis.fetch;
  const requests: Array<{ url: string; authorization: string | null; body: Record<string, unknown> }> = [];
  process.env.AI_TEXT_PROVIDER = "gemini";
  process.env.GEMINI_API_KEY = "test-gemini-key-not-a-real-credential";
  process.env.OPENROUTER_API_KEY = "test-openrouter-key-not-a-real-credential";
  process.env.GEMINI_TEXT_MODEL = "gemini-3.1-flash-lite";
  globalThis.fetch = async (url, init) => {
    requests.push({
      url: String(url),
      authorization: new Headers(init?.headers).get("authorization"),
      body: JSON.parse(String(init?.body)) as Record<string, unknown>,
    });
    return Response.json({ choices: [{ message: { content: "{}" } }] });
  };

  try {
    await openRouterChat({
      messages: [{ role: "user", content: "Teszt" }],
      schemaName: "test",
      schema: { type: "object" },
      maxTokens: 20_000,
    });
    await openRouterImage({ prompt: "Tesztkép", stream: false });

    assert.equal(
      requests[0]?.url,
      "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    );
    assert.equal(requests[0]?.authorization, "Bearer test-gemini-key-not-a-real-credential");
    assert.equal(requests[0]?.body.model, "gemini-3.1-flash-lite");
    assert.equal(requests[0]?.body.max_tokens, 16_000);
    assert.equal("usage" in (requests[0]?.body ?? {}), false);
    assert.equal(JSON.stringify(requests[0]?.body).includes("test-gemini-key"), false);
    assert.equal(requests[1]?.url, "https://openrouter.ai/api/v1/images");
    assert.equal(requests[1]?.authorization, "Bearer test-openrouter-key-not-a-real-credential");
  } finally {
    globalThis.fetch = originalFetch;
    if (env.provider === undefined) delete process.env.AI_TEXT_PROVIDER;
    else process.env.AI_TEXT_PROVIDER = env.provider;
    if (env.geminiKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = env.geminiKey;
    if (env.openRouterKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = env.openRouterKey;
    if (env.geminiModel === undefined) delete process.env.GEMINI_TEXT_MODEL;
    else process.env.GEMINI_TEXT_MODEL = env.geminiModel;
  }
});
