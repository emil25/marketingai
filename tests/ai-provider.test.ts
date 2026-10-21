import assert from "node:assert/strict";
import { test } from "node:test";
import {
  chatRequestBody,
  configuredTextAiProvider,
  openRouterChat,
  openRouterImage,
  textCompletionUrl,
} from "../src/lib/server/ai-provider.server.ts";

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

