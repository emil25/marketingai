import test from "node:test";
import assert from "node:assert/strict";
import { previewAiAllowed, previewAiResponse } from "../src/lib/server/preview-ai.server";
const user = { email: "qa@example.invalid", displayName: "TESZT" },
  brand = { name: "TESZT Pékség" };
const env = {
  VERCEL_ENV: "preview",
  VERCEL: "1",
  MARKETINGPILOT_PREVIEW_TEST_AI: "true",
  MARKETINGPILOT_PREVIEW_TEST_EMAIL: user.email,
  DATABASE_URL: "test-present",
};
test("preview mock is disabled in production, for other users, without PostgreSQL and without explicit opt-in", () => {
  assert.equal(previewAiAllowed(user, brand, env), true);
  for (const changes of [
    { VERCEL_ENV: "production" },
    { NODE_ENV: "production" },
    { VERCEL: "" },
    { DATABASE_URL: "" },
    { MARKETINGPILOT_PREVIEW_TEST_AI: "false" },
    { MARKETINGPILOT_JSON_FIXTURE: "true" },
    { MARKETINGPILOT_PREVIEW_TEST_EMAIL: "real@example.com" },
  ])
    assert.equal(previewAiAllowed(user, brand, { ...env, ...changes }), false);
  assert.equal(previewAiAllowed({ ...user, email: "another@example.invalid" }, brand, env), false);
  assert.equal(previewAiAllowed(user, { name: "Valódi cég" }, env), false);
  assert.equal(previewAiAllowed({ ...user, displayName: "Valódi felhasználó" }, brand, env), false);
});
test("preview fixture has valid platform output and never simulates image, auth or database calls", async () => {
  const response = previewAiResponse({
    response_format: { json_schema: { name: "factual_post_variants" } },
    messages: [
      {
        role: "system",
        content: '\n{"products":"Kenyér, kakaós csiga","brandName":"TESZT Pékség"}',
      },
      { role: "user", content: '{"platforms":["facebook","instagram"]}' },
    ],
  });
  const json = await response.json();
  assert.equal(json.model, "preview-test-fixture");
  const result = JSON.parse(json.choices[0].message.content);
  assert.equal(result.variants[0].hashtags.length, 1);
  assert.equal(result.variants[1].hashtags.length, 5);
  assert.throws(
    () => previewAiResponse({ response_format: { json_schema: { name: "image" } } }),
    /csak a posztszöveg/,
  );
});
