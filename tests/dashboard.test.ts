import assert from "node:assert/strict";
import { test } from "node:test";
import {
  activeBrandRecords,
  connectedChannelCount,
  hasPlannedPostContent,
  isChannelConnected,
  weeklyPlanItems,
} from "../src/lib/dashboard";
import type { ChannelProvider, PostStatus, PostVariantRecord } from "../src/lib/data-model";

test("dashboard records belong to both the current workspace and active brand", () => {
  const records = [
    { id: "own", workspaceId: "workspace-a", brandId: "brand-a" },
    { id: "other-brand", workspaceId: "workspace-a", brandId: "brand-b" },
    { id: "other-workspace", workspaceId: "workspace-b", brandId: "brand-a" },
  ];
  assert.deepEqual(
    activeBrandRecords(records, "workspace-a", "brand-a").map((item) => item.id),
    ["own"],
  );
  assert.deepEqual(activeBrandRecords(records, "workspace-a", null), []);
  assert.deepEqual(activeBrandRecords(records, "workspace-b", "brand-b"), []);
});

const now = Date.parse("2026-10-04T12:00:00Z");
const connection = {
  provider: "facebook" as ChannelProvider,
  status: "connected" as const,
  externalAccountId: "page-a",
  hasAccessToken: true,
  tokenExpiresAt: null as string | null,
};

test("only complete, unexpired connections contribute to the unique platform count", () => {
  assert.equal(isChannelConnected(connection, now), true);
  assert.equal(isChannelConnected(undefined, now), false);
  assert.equal(isChannelConnected({ ...connection, hasAccessToken: false }, now), false);
  assert.equal(isChannelConnected({ ...connection, externalAccountId: null }, now), false);
  assert.equal(isChannelConnected({ ...connection, status: "connecting" }, now), false);
  assert.equal(isChannelConnected({ ...connection, status: "revoked" }, now), false);
  assert.equal(
    isChannelConnected({ ...connection, tokenExpiresAt: "2026-10-04T11:00:00Z" }, now),
    false,
  );
  assert.equal(isChannelConnected({ ...connection, tokenExpiresAt: "invalid" }, now), false);
  assert.equal(
    connectedChannelCount(
      [
        connection,
        { ...connection, externalAccountId: "page-b" },
        { ...connection, provider: "instagram" },
        { ...connection, provider: "linkedin", hasAccessToken: false },
      ],
      now,
    ),
    2,
  );
});

test("sidebar channel totals exclude other brands and workspaces", () => {
  const connections = [
    { ...connection, workspaceId: "workspace-a", brandId: "brand-a" },
    {
      ...connection,
      provider: "instagram" as const,
      workspaceId: "workspace-a",
      brandId: "brand-b",
    },
    {
      ...connection,
      provider: "linkedin" as const,
      workspaceId: "workspace-b",
      brandId: "brand-a",
    },
  ];
  assert.equal(
    connectedChannelCount(activeBrandRecords(connections, "workspace-a", "brand-a"), now),
    1,
  );
});

const plan = {
  workspaceId: "workspace-a",
  brandId: "brand-a",
  postId: "post-a",
  platform: "facebook" as const,
};
const post = {
  id: "post-a",
  workspaceId: "workspace-a",
  brandId: "brand-a",
  status: "draft" as PostStatus,
  variants: [
    {
      postId: "post-a",
      platform: "facebook",
      content: "Mentett, szerkeszthető posztszöveg.",
      status: "draft",
    } as Pick<PostVariantRecord, "postId" | "platform" | "content" | "status">,
  ],
};

test("weekly progress requires saved text for the planned platform", () => {
  assert.equal(hasPlannedPostContent(plan, [post]), true);
  assert.equal(hasPlannedPostContent(plan, [{ ...post, variants: [] }]), false);
  assert.equal(
    hasPlannedPostContent(plan, [{ ...post, variants: [{ ...post.variants[0], content: "   " }] }]),
    false,
  );
  assert.equal(
    hasPlannedPostContent(plan, [
      { ...post, variants: [{ ...post.variants[0], platform: "instagram" }] },
    ]),
    false,
  );
  assert.equal(
    hasPlannedPostContent(plan, [
      { ...post, variants: [{ ...post.variants[0], status: "failed" }] },
    ]),
    false,
  );
  assert.equal(hasPlannedPostContent(plan, [{ ...post, status: "failed" }]), false);
  assert.equal(hasPlannedPostContent(plan, []), false);
});

test("progress rejects post links outside the planned brand or workspace", () => {
  assert.equal(hasPlannedPostContent(plan, [{ ...post, brandId: "brand-b" }]), false);
  assert.equal(hasPlannedPostContent(plan, [{ ...post, workspaceId: "workspace-b" }]), false);
  assert.equal(
    hasPlannedPostContent(plan, [
      { ...post, variants: [{ ...post.variants[0], postId: "other-post" }] },
    ]),
    false,
  );
  assert.equal(hasPlannedPostContent({ ...plan, postId: null }, [post]), false);
});

const item = (date: string, time = "10:00") => ({
  date,
  time,
  timezone: "Europe/Bucharest",
  status: "planned" as const,
});

test("the seven-day plan respects local midnight, date validity, skipped items and chronological order", () => {
  const midnight = new Date("2026-10-03T22:30:00Z");
  const items = weeklyPlanItems(
    [
      item("2026-10-10"),
      item("2026-10-04", "18:00"),
      item("2026-10-04", "08:00"),
      item("2026-10-03"),
      item("2026-10-11"),
      item("2026-10-35"),
      item("bad-date"),
      { ...item("2026-10-05"), status: "skipped" },
    ],
    midnight,
  );
  assert.deepEqual(
    items.map((entry) => [entry.date, entry.time]),
    [
      ["2026-10-04", "08:00"],
      ["2026-10-04", "18:00"],
      ["2026-10-10", "10:00"],
    ],
  );
});

test("an invalid legacy timezone does not crash the dashboard", () => {
  assert.equal(
    weeklyPlanItems([{ ...item("2026-10-04"), timezone: "invalid/timezone" }], new Date(now))
      .length,
    1,
  );
});
