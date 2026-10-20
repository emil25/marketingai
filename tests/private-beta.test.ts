import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createTestDataDir, removeTestDataDir } from "./test-data-dir";
import { authConfiguration } from "../src/lib/server/auth-security.server";
import {
  requireBetaInvitation,
  developmentEmailAllowed,
} from "../src/lib/server/beta-access.server";
import { assertProductionConfiguration } from "../src/lib/server/production-config.server";
import { writeDevelopmentEmail } from "../src/lib/server/development-outbox.server";
import { publicUser } from "../src/lib/server/store.server";

test("private beta invitation enables registration without email; missing or invalid invitation fails closed", () => {
  const env = {
    NODE_ENV: "production",
    BETA_MODE: "private",
    BETA_INVITE_CODE: "synthetic-invitation",
  };
  assert.equal(authConfiguration(env).registrationEnabled, true);
  assert.equal(authConfiguration(env).passwordResetAvailable, false);
  assert.equal(requireBetaInvitation("synthetic-invitation", env), true);
  assert.throws(() => requireBetaInvitation("wrong", env), /meghívókód/);
  assert.throws(() => requireBetaInvitation("", env), /meghívókód/);
  assert.equal(authConfiguration({ ...env, BETA_INVITE_CODE: "" }).registrationEnabled, false);
  assert.throws(
    () => requireBetaInvitation("wrong", { ...env, BETA_INVITE_CODE: "" }),
    /Zárt béta/,
  );
  assert.equal(
    authConfiguration({ NODE_ENV: "production", BETA_MODE: "off" }).registrationEnabled,
    false,
  );
  assert.equal(
    authConfiguration({ NODE_ENV: "development", BETA_MODE: "typo" }).registrationEnabled,
    false,
  );
  assert.equal(requireBetaInvitation("", { BETA_MODE: "off" }), false);
});
test("private beta never relaxes database, session, HTTPS and test-mode production guards", () => {
  const safe = {
    NODE_ENV: "production",
    BETA_MODE: "private",
    BETA_INVITE_CODE: "synthetic",
    SESSION_SECRET: "s".repeat(40),
    PUBLIC_APP_URL: "https://example.invalid",
    DATABASE_URL: "present",
  };
  assert.doesNotThrow(() => assertProductionConfiguration(safe));
  assert.doesNotThrow(() => assertProductionConfiguration({ ...safe, BETA_INVITE_CODE: "" }));
  for (const changes of [
    { DATABASE_URL: "" },
    { SESSION_SECRET: "short" },
    { PUBLIC_APP_URL: "http://localhost" },
    { MARKETINGPILOT_JSON_FIXTURE: "true" },
    { ENABLE_LOCAL_ADMIN_LOGIN: "true" },
    { MARKETINGPILOT_PREVIEW_TEST_AI: "true" },
  ])
    assert.throws(() => assertProductionConfiguration({ ...safe, ...changes }));
  assert.equal(developmentEmailAllowed({ VERCEL_ENV: "production" }), false);
  assert.equal(developmentEmailAllowed({ NODE_ENV: "development", VERCEL: "1" }), false);
});
test("beta admission is private metadata, not a falsely verified email", () => {
  const keys = ["BETA_MODE", "BETA_INVITE_CODE"];
  const previous = keys.map((k) => process.env[k]);
  try {
    process.env.BETA_MODE = "private";
    process.env.BETA_INVITE_CODE = "synthetic";
    const user = {
      id: "test",
      email: "test@example.invalid",
      displayName: "Test",
      passwordHash: "private",
      createdAt: new Date().toISOString(),
      auth: { emailVerifiedAt: null, sessionVersion: 0, betaInvitedAt: new Date().toISOString() },
    };
    const safe = publicUser(user);
    assert.equal(safe.emailVerified, false);
    assert.equal(safe.canUseAi, true);
    assert.equal("auth" in safe, false);
    assert.equal("passwordHash" in safe, false);
    process.env.BETA_MODE = "off";
    assert.equal(publicUser(user).canUseAi, false);
  } finally {
    keys.forEach((k, i) =>
      previous[i] === undefined ? delete process.env[k] : (process.env[k] = previous[i]),
    );
  }
});
test("development email outbox works without a service and is forbidden on Vercel/production", async () => {
  const directory = await createTestDataDir("private-outbox");
  const keys = ["NODE_ENV", "VERCEL", "VERCEL_ENV", "MARKETINGPILOT_DATA_DIR"];
  const previous = keys.map((k) => process.env[k]);
  try {
    for (const key of keys) delete process.env[key];
    process.env.NODE_ENV = "development";
    process.env.MARKETINGPILOT_DATA_DIR = directory;
    await writeDevelopmentEmail({
      to: "test@example.invalid",
      subject: "Unit test",
      text: "Synthetic content",
    });
    const messages = (
      await readFile(path.join(directory, "development-outbox/messages.jsonl"), "utf8")
    )
      .trim()
      .split("\n")
      .map((line: string) => JSON.parse(line));
    assert.equal(messages.length, 1);
    assert.equal(messages[0].developmentOnly, true);
    process.env.VERCEL_ENV = "production";
    await assert.rejects(
      writeDevelopmentEmail({ to: "test@example.invalid", subject: "test", text: "test" }),
    );
    assert.equal(
      (await readFile(path.join(directory, "development-outbox/messages.jsonl"), "utf8"))
        .trim()
        .split("\n").length,
      1,
    );
  } finally {
    keys.forEach((k, i) =>
      previous[i] === undefined ? delete process.env[k] : (process.env[k] = previous[i]),
    );
    await removeTestDataDir(directory);
  }
});
