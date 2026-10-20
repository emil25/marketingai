import { test } from "node:test";
import assert from "node:assert/strict";
import { isCsrfRequestAllowed } from "@tanstack/start-client-core";

test("unsafe API requests require same origin; foreign and missing origins fail closed", async () => {
  const check = (headers: Record<string, string>) =>
    isCsrfRequestAllowed({}, {
      request: new Request("https://beta.example.invalid/api/media/media_test", {
        method: "DELETE",
        headers,
      }),
    } as Parameters<typeof isCsrfRequestAllowed>[1]);
  assert.equal(await check({ origin: "https://beta.example.invalid" }), true);
  assert.equal(await check({ origin: "https://attack.example.invalid" }), false);
  assert.equal(
    await check({ "sec-fetch-site": "same-site", origin: "https://beta.example.invalid" }),
    false,
  );
  assert.equal(await check({}), false);
});
