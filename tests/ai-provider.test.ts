import assert from "node:assert/strict";
import { test } from "node:test";
import {
  chatRequestBody,
  configuredTextAiProvider,
  openRouterChat,
  openRouterImage,
  requestGroqWithModelFallback,
  retryTransientProviderResponse,
  textAiProviderStatus,
  textCompletionUrl,
} from "../src/lib/server/ai-provider.server.ts";

test("AI provider diagnostics expose only the provider and key presence", () => {
  const previous = {
    provider: process.env.AI_TEXT_PROVIDER,
    groqKey: process.env.GROQ_API_KEY,
  };
  process.env.AI_TEXT_PROVIDER = "groq";
  process.env.GROQ_API_KEY = "test-groq-key-not-a-real-credential";
  try {
    assert.deepEqual(textAiProviderStatus(), { provider: "groq", keyConfigured: true });
    assert.equal(JSON.stringify(textAiProviderStatus()).includes("test-groq-key"), false);
  } finally {
    if (previous.provider === undefined) delete process.env.AI_TEXT_PROVIDER;
    else process.env.AI_TEXT_PROVIDER = previous.provider;
    if (previous.groqKey === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = previous.groqKey;
  }
});

test("temporary AI provider errors get one retry; quota errors do not", async () => {
  let attempts = 0;
  const response = await retryTransientProviderResponse(
    async () => {
      attempts += 1;
      return attempts === 1
        ? Response.json({ error: "temporary" }, { status: 503 })
        : Response.json({ choices: [] });
    },
    async () => undefined,
  );
  assert.equal(response.status, 200);
  assert.equal(attempts, 2);

  attempts = 0;
  const limited = await retryTransientProviderResponse(
    async () => {
      attempts += 1;
      return Response.json({ error: "limited" }, { status: 429 });
    },
    async () => undefined,
  );
  assert.equal(limited.status, 429);
  assert.equal(attempts, 1);
});

test("a persistent provider outage is attempted at most twice", async () => {
  let attempts = 0;
  const response = await retryTransientProviderResponse(
    async () => {
      attempts += 1;
      return Response.json({ error: "unavailable" }, { status: 503 });
    },
    async () => undefined,
  );
  assert.equal(response.status, 503);
  assert.equal(attempts, 2);
});

test("Groq retries the economical model once, then falls back within Groq only on 503", async () => {
  let primaryAttempts = 0;
  let fallbackAttempts = 0;
  const response = await requestGroqWithModelFallback(
    async () => {
      primaryAttempts += 1;
      return Response.json({ error: "busy" }, { status: 503 });
    },
    async () => {
      fallbackAttempts += 1;
      return Response.json({ choices: [{ message: { content: "ok" } }] });
    },
    async () => undefined,
  );
  assert.equal(response.status, 200);
  assert.equal(primaryAttempts, 2);
  assert.equal(fallbackAttempts, 1);

  primaryAttempts = 0;
  fallbackAttempts = 0;
  const unauthorized = await requestGroqWithModelFallback(
    async () => {
      primaryAttempts += 1;
      return Response.json({ error: "unauthorized" }, { status: 401 });
    },
    async () => {
      fallbackAttempts += 1;
      return Response.json({ choices: [] });
    },
    async () => undefined,
  );
  assert.equal(unauthorized.status, 401);
  assert.equal(primaryAttempts, 1);
  assert.equal(fallbackAttempts, 0);
});

test("Groq uses its configured OpenAI-compatible model and the strict JSON schema request shape", () => {
  const previous = {
    provider: process.env.AI_TEXT_PROVIDER,
    groqModel: process.env.GROQ_TEXT_MODEL,
  };
  process.env.AI_TEXT_PROVIDER = "groq";
  process.env.GROQ_TEXT_MODEL = "openai/gpt-oss-20b";
  try {
    const provider = configuredTextAiProvider();
    assert.equal(provider, "groq");
    assert.equal(textCompletionUrl(provider), "https://api.groq.com/openai/v1/chat/completions");
    assert.deepEqual(
      chatRequestBody(
        {
          messages: [{ role: "user", content: "Írj rövid posztot." }],
          schemaName: "post",
          schema: {
            type: "object",
            properties: { content: { type: "string" } },
            required: ["content"],
            additionalProperties: false,
          },
          maxTokens: 400,
        },
        provider,
      ),
      {
        model: "openai/gpt-oss-20b",
        messages: [{ role: "user", content: "Írj rövid posztot." }],
        max_tokens: 400,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "post",
            strict: true,
            schema: {
              type: "object",
              properties: { content: { type: "string" } },
              required: ["content"],
              additionalProperties: false,
            },
          },
        },
      },
    );
  } finally {
    if (previous.provider === undefined) delete process.env.AI_TEXT_PROVIDER;
    else process.env.AI_TEXT_PROVIDER = previous.provider;
    if (previous.groqModel === undefined) delete process.env.GROQ_TEXT_MODEL;
    else process.env.GROQ_TEXT_MODEL = previous.groqModel;
  }
});

test("Gemini text and OpenRouter image calls require an authenticated request before contacting a provider", async () => {
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
    await assert.rejects(openRouterChat({
      messages: [{ role: "user", content: "Teszt" }],
      schemaName: "test",
      schema: { type: "object" },
      maxTokens: 20_000,
    }), /No StartEvent/);
    await assert.rejects(openRouterImage({ prompt: "Tesztkép", stream: false }), /No StartEvent/);
    assert.equal(requests.length, 0, "An unauthenticated call must not send prompts or credentials");
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
