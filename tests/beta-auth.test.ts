import assert from "node:assert/strict";
import { test } from "node:test";
import { createTestDataDir, removeTestDataDir } from "./test-data-dir";
import {
  newAuthToken,
  matchesAuthToken,
  authConfiguration,
  consumeAuthLimit,
  verifyBot,
  sendAuthEmail,
} from "../src/lib/server/auth-security.server";
import { publicUser } from "../src/lib/server/store.server";
import { reserveAiCall } from "../src/lib/server/ai-calls.server";
import type { UserRecord, WorkspaceSnapshot } from "../src/lib/data-model";
test("one-time credentials store only hashes, reject invalid/expired tokens; auth metadata is private", () => {
  const { token, stored } = newAuthToken(30);
  assert.notEqual(token, stored.hash);
  assert.equal(matchesAuthToken(stored, token), true);
  assert.equal(matchesAuthToken(stored, "wrong"), false);
  assert.equal(matchesAuthToken({ ...stored, expiresAt: "invalid" }, token), false);
  assert.equal(matchesAuthToken({ ...stored, expiresAt: new Date(0).toISOString() }, token), false);
  assert.equal(matchesAuthToken(undefined, token), false);
  const user = {
    id: "u",
    email: "a@example.invalid",
    displayName: "Test",
    createdAt: new Date().toISOString(),
    passwordHash: "secret",
    auth: { emailVerifiedAt: null, sessionVersion: 3, verification: stored },
  } satisfies UserRecord;
  assert.equal(publicUser(user).emailVerified, false);
  assert.equal("auth" in publicUser(user), false);
  assert.equal("passwordHash" in publicUser(user), false);
  assert.equal(publicUser({ ...user, auth: undefined }).emailVerified, true);
});
test("production registration requires operator, mail, bot and HTTPS configuration", () => {
  const keys = [
    "NODE_ENV",
    "OPERATOR_NAME",
    "OPERATOR_EMAIL",
    "OPERATOR_ADDRESS",
    "RESEND_API_KEY",
    "EMAIL_FROM",
    "TURNSTILE_SITE_KEY",
    "TURNSTILE_SECRET_KEY",
    "PUBLIC_APP_URL",
  ];
  const previous = keys.map((k) => process.env[k]);
  try {
    for (const key of keys) delete process.env[key];
    process.env.NODE_ENV = "production";
    assert.equal(authConfiguration().registrationEnabled, false);
    assert.match(authConfiguration().registrationMessage, /nem a te hibád/);
    for (const key of keys.slice(1)) process.env[key] = "test";
    process.env.PUBLIC_APP_URL = "https://example.invalid";
    assert.equal(authConfiguration().registrationEnabled, true);
    process.env.PUBLIC_APP_URL = "http://example.invalid";
    assert.equal(authConfiguration().registrationEnabled, false);
  } finally {
    keys.forEach((k, i) => {
      if (previous[i] === undefined) delete process.env[k];
      else process.env[k] = previous[i];
    });
  }
});
test("unverified accounts cannot reserve or spend an AI call", async () => {
  await assert.rejects(
    reserveAiCall({ user: { emailVerified: false } } as WorkspaceSnapshot, "post", "model"),
    /erősítsd meg/,
  );
});
test("persistent local rate limits serialize parallel requests without leaking email/IP", async () => {
  const directory = await createTestDataDir("beta-rate");
  const keys = ["DATABASE_URL", "DIRECT_URL", "VERCEL", "MARKETINGPILOT_DATA_DIR"];
  const previous = keys.map((k) => process.env[k]);
  try {
    for (const key of keys) delete process.env[key];
    process.env.MARKETINGPILOT_DATA_DIR = directory;
    const results = await Promise.allSettled(
      Array.from({ length: 6 }, () => consumeAuthLimit("login:private@example.invalid", 2, 15)),
    );
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 2);
    await assert.rejects(consumeAuthLimit("login:private@example.invalid", 2, 15), /Túl sok/);
  } finally {
    keys.forEach((k, i) => {
      if (previous[i] === undefined) delete process.env[k];
      else process.env[k] = previous[i];
    });
    await removeTestDataDir(directory);
  }
});

test("Turnstile verifies action and canonical hostname; provider failure stays friendly", async () => {
  const keys = ["TURNSTILE_SECRET_KEY", "TURNSTILE_SITE_KEY", "PUBLIC_APP_URL", "NODE_ENV"];
  const before = keys.map((key) => process.env[key]);
  const original = globalThis.fetch;
  try {
    process.env.TURNSTILE_SECRET_KEY = "unit-test-secret";
    process.env.TURNSTILE_SITE_KEY = "unit-test-site";
    process.env.PUBLIC_APP_URL = "https://beta.example.invalid";
    process.env.NODE_ENV = "production";
    globalThis.fetch = async () =>
      Response.json({ success: true, action: "signup", hostname: "beta.example.invalid" });
    await assert.doesNotReject(verifyBot("test-token", "signup"));
    await assert.rejects(verifyBot("test-token", "login"), /lejárt/);
    globalThis.fetch = async () =>
      Response.json({ success: true, action: "signup", hostname: "other.example.invalid" });
    await assert.rejects(verifyBot("test-token", "signup"), /lejárt/);
    globalThis.fetch = async () => {
      throw new Error("provider-internal-detail");
    };
    await assert.rejects(verifyBot("test-token", "signup"), /nem érhető el/);
  } finally {
    globalThis.fetch = original;
    keys.forEach((key, i) => {
      if (before[i] === undefined) delete process.env[key];
      else process.env[key] = before[i];
    });
  }
});

test("verification email keeps the one-time credential in a URL fragment, not query or path", async () => {
  const keys = ["RESEND_API_KEY", "EMAIL_FROM", "PUBLIC_APP_URL", "NODE_ENV"];
  const before = keys.map((key) => process.env[key]);
  const original = globalThis.fetch;
  let text = "";
  try {
    process.env.RESEND_API_KEY = "unit-test-key";
    process.env.EMAIL_FROM = "unit@example.invalid";
    process.env.PUBLIC_APP_URL = "https://beta.example.invalid";
    process.env.NODE_ENV = "production";
    globalThis.fetch = async (_input, init) => {
      text = JSON.parse(String(init?.body)).text;
      return Response.json({ id: "unit" });
    };
    const token = newAuthToken(30).token;
    await sendAuthEmail("receiver@example.invalid", "verify", token);
    const url = new URL(text.match(/https:\/\/[^\s]+/)![0]);
    assert.equal(url.pathname, "/verify-email");
    assert.equal(url.search, "");
    assert.equal(url.hash, "#" + token);
  } finally {
    globalThis.fetch = original;
    keys.forEach((key, i) => {
      if (before[i] === undefined) delete process.env[key];
      else process.env[key] = before[i];
    });
  }
});
