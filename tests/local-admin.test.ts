import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isLocalAdminRequest,
  localAdminSnapshot,
  type LocalAdminConfiguration,
} from "../src/lib/server/local-admin.server";
import type { AppData } from "../src/lib/data-model";

const config: LocalAdminConfiguration = {
  nodeEnv: "development",
  enabled: "true",
  userId: "local_owner",
  workspaceId: "local_workspace",
};
const request = (
  url = "http://localhost:8080/_serverFn/local-admin",
  method = "POST",
  headers: Record<string, string> = { origin: "http://localhost:8080" },
) => new Request(url, { method, headers });

test("local admin allows explicitly enabled loopback same-origin development requests", () => {
  assert.equal(isLocalAdminRequest(request(), config), true);
  assert.equal(
    isLocalAdminRequest(
      request("http://127.0.0.1:8080/action", "POST", { origin: "http://127.0.0.1:8080" }),
      config,
    ),
    true,
  );
  assert.equal(
    isLocalAdminRequest(
      request("http://[::1]:8080/action", "POST", { origin: "http://[::1]:8080" }),
      config,
    ),
    true,
  );
  assert.equal(isLocalAdminRequest(request(undefined, "GET", {}), config), true);
});

test("production, unspecified modes, disabled flags and incomplete configuration always reject", () => {
  for (const changes of [
    { nodeEnv: "production" },
    { nodeEnv: "test" },
    { nodeEnv: undefined },
    { enabled: "false" },
    { enabled: undefined },
    { userId: "" },
    { workspaceId: "" },
  ]) {
    assert.equal(isLocalAdminRequest(request(), { ...config, ...changes }), false);
  }
});

test("public hosts, remote origins, missing POST origin, forged proxy headers and cross-site requests reject", () => {
  for (const url of [
    "http://marketingpilot.example/action",
    "http://localhost.attacker.example/action",
    "http://192.168.1.10/action",
  ]) {
    assert.equal(isLocalAdminRequest(request(url), config), false);
  }
  assert.throws(() => request("http://localhost:8080@attacker.example/action"));
  for (const headers of [
    {},
    { origin: "null" },
    { origin: "https://attacker.example" },
    { origin: "http://localhost:8081" },
    { origin: "http://localhost:8080", "sec-fetch-site": "cross-site" },
  ]) {
    assert.equal(isLocalAdminRequest(request(undefined, "POST", headers), config), false);
  }
  for (const name of ["forwarded", "x-forwarded-host", "x-forwarded-for", "x-forwarded-proto"]) {
    assert.equal(
      isLocalAdminRequest(
        request(undefined, "POST", { origin: "http://localhost:8080", [name]: "127.0.0.1" }),
        config,
      ),
      false,
    );
  }
});

function fixture(role: "owner" | "admin" | "member" = "owner"): AppData {
  const date = "2026-10-01T00:00:00.000Z";
  return {
    users: [
      {
        id: "local_owner",
        email: "local@example.test",
        displayName: "Local",
        passwordHash: "not-used",
        createdAt: date,
      },
    ],
    workspaces: [{ id: "local_workspace", name: "Local", createdAt: date, updatedAt: date }],
    memberships: [
      {
        id: "local_membership",
        userId: "local_owner",
        workspaceId: "local_workspace",
        role,
        createdAt: date,
      },
    ],
    brands: [],
    brandProfiles: [],
    posts: [],
    postVariants: [],
    postVersions: [],
    aiJobs: [],
    campaigns: [],
    planItems: [],
    mediaAssets: [],
    analyticsSnapshots: [],
    channelConnections: [],
    channelOAuthStates: [],
    channelOAuthSelections: [],
    publishAttempts: [],
  };
}

test("only the configured existing owner/admin membership is used, no elevation or other workspace fallback", () => {
  const db = fixture();
  const before = JSON.stringify(db);
  assert.equal(localAdminSnapshot(db, config)?.workspace.id, "local_workspace");
  assert.equal(localAdminSnapshot(fixture("admin"), config)?.membership.role, "admin");
  assert.equal(localAdminSnapshot(fixture("member"), config), null);
  assert.equal(localAdminSnapshot(db, { ...config, workspaceId: "other_workspace" }), null);
  assert.equal(localAdminSnapshot(db, { ...config, userId: "other_user" }), null);
  assert.equal(localAdminSnapshot({ ...db, memberships: [] }, config), null);
  assert.equal(JSON.stringify(db), before);
});
