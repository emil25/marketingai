import assert from "node:assert/strict";
import { test } from "node:test";
import { z } from "zod";
import { AiProviderUnavailableError } from "../src/lib/ai-call-policy.ts";
import { offlineIdeaVariants, shouldSaveIdeaAsOfflineDraft } from "../src/lib/offline-post-draft.ts";
import { requestAiJson } from "../src/lib/server/ai-json.server.ts";

test("a provider outage is identified without exposing provider response data", async () => {
  const input = {
    messages: [{ role: "user" as const, content: "Írj posztot." }],
    schemaName: "test_post",
    schema: { type: "object", properties: {}, additionalProperties: false },
  };
  await assert.rejects(
    requestAiJson(input, z.object({}), async () =>
      Response.json({ secret: "provider-body" }, { status: 503 }),
    ),
    (cause: unknown) =>
      cause instanceof AiProviderUnavailableError &&
      cause.status === 503 &&
      !cause.message.includes("provider-body"),
  );
});

test("only a first-time idea can fall back after an AI service failure", () => {
  const outage = new AiProviderUnavailableError("unavailable", 503);
  assert.equal(shouldSaveIdeaAsOfflineDraft(outage), true);
  assert.equal(shouldSaveIdeaAsOfflineDraft(outage, "post_existing"), false);
  assert.equal(shouldSaveIdeaAsOfflineDraft(new Error("invalid generated content")), false);
});

test("offline draft keeps the exact user idea and adds no claims or hashtags", () => {
  const idea = "Mutasd be a kakaós csigát reggelire.";
  const variants = offlineIdeaVariants(idea, ["facebook", "instagram", "facebook"]);
  assert.equal(variants.length, 2);
  assert.deepEqual(
    variants.map(({ platform, content, hashtags, cta }) => ({ platform, content, hashtags, cta })),
    [
      { platform: "facebook", content: idea, hashtags: [], cta: "" },
      { platform: "instagram", content: idea, hashtags: [], cta: "" },
    ],
  );
  assert.ok(variants.every((item) => item.ellenorizendo.includes("AI_UNAVAILABLE_DRAFT")));
});

