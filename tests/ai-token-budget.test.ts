import assert from "node:assert/strict";
import { test } from "node:test";
import { chatRequestBody, openRouterChat } from "../src/lib/server/ai-provider.server";

test("bounded server token budgets and usage accounting preserve structured output", () => {
  const input = {
    messages: [{ role: "user" as const, content: "Test" }],
    schemaName: "test",
    schema: { type: "object" },
  };
  const bodies = [3500, 2000, undefined, 4000, 99999, 0].map((maxTokens) =>
    chatRequestBody({ ...input, maxTokens, deadlineAt: Date.now() + 5000 }),
  );
  assert.deepEqual(
    bodies.map((body) => body.max_tokens),
    [3500, 2000, 16000, 4000, 16000, 1],
  );
  assert.ok(bodies.every((body) => body.usage.include && body.response_format.json_schema.strict));
  assert.ok(bodies.every((body) => !("deadlineAt" in body) && !("Authorization" in body)));
  assert.throws(() => openRouterChat({ ...input, deadlineAt: Date.now() - 1 }), /időkorlát/);
});

test("Gemini text requests use the configured Gemini model and omit OpenRouter-only fields", () => {
  const body = chatRequestBody(
    {
      messages: [{ role: "user", content: "Csak kitalált teszt." }],
      schemaName: "test",
      schema: { type: "object" },
    },
    "gemini",
  );

  assert.equal(body.model, "gemini-3.1-flash-lite");
  assert.equal("usage" in body, false);
  assert.equal(body.response_format.json_schema.strict, true);
});
