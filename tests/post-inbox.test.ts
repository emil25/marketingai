import test from "node:test";
import assert from "node:assert/strict";
import {
  filterAndSortPosts,
  formatPostScheduledAt,
  postMatchesPlatform,
  selectPostVariant,
  summarizePosts,
  type InboxPost,
} from "../src/lib/post-inbox.ts";

const post = (overrides: Partial<InboxPost> = {}): InboxPost => ({
  id: "post-1",
  title: "Heti ajánlat",
  goal: "Helyi elérés",
  brandName: "Zene Kávézó",
  status: "draft",
  scheduledAt: null,
  timezone: "Europe/Bucharest",
  updatedAt: "2026-10-04T10:00:00.000Z",
  createdAt: "2026-10-04T09:00:00.000Z",
  platforms: [],
  variants: [
    {
      id: "variant-1",
      platform: "facebook",
      content: "Kóstold meg a heti ajánlatot!",
      status: "draft",
    },
  ],
  ...overrides,
});

test("filters trimmed search across brand, goal and variant text", () => {
  assert.equal(filterAndSortPosts([post()], { query: "  kávézó  " }).length, 1);
  assert.equal(filterAndSortPosts([post()], { query: "instagram" }).length, 0);
  assert.equal(filterAndSortPosts([post()], { query: "heti ajánlat" }).length, 1);
});

test("platform filter includes declared platforms for empty drafts and selects matching variant", () => {
  const draft = post({ variants: [], platforms: ["instagram"] });
  assert.equal(postMatchesPlatform(draft, "instagram"), true);
  assert.equal(filterAndSortPosts([draft], { platform: "instagram" }).length, 1);
  const multi = post({
    variants: [
      { id: "fb", platform: "facebook", content: "FB", status: "draft" },
      { id: "ig", platform: "instagram", content: "IG", status: "draft" },
    ],
  });
  assert.equal(selectPostVariant(multi, "instagram")?.content, "IG");
  assert.equal(selectPostVariant(multi, "tiktok"), null);
  const rich = {
    ...multi,
    variants: [{ ...multi.variants[1], cta: "Foglalj most", hashtags: ["#teszt"] }],
  };
  assert.deepEqual(selectPostVariant(rich, "instagram"), rich.variants[0]);
});

test("scheduled sorting puts valid upcoming timestamps first and never mutates input", () => {
  const unscheduled = post({ id: "unscheduled", scheduledAt: "invalid" });
  const later = post({ id: "later", scheduledAt: "2026-10-06T10:00:00.000Z" });
  const sooner = post({ id: "sooner", scheduledAt: "2026-10-05T10:00:00.000Z" });
  const source = [unscheduled, later, sooner] as const;
  const result = filterAndSortPosts(source, { sort: "scheduled" });
  assert.deepEqual(
    result.map((item) => item.id),
    ["sooner", "later", "unscheduled"],
  );
  assert.deepEqual(
    source.map((item) => item.id),
    ["unscheduled", "later", "sooner"],
  );
});

test("summary groups idea and review into drafts", () => {
  assert.deepEqual(
    summarizePosts([
      { status: "idea" },
      { status: "review" },
      { status: "scheduled" },
      { status: "published" },
      { status: "failed" },
    ]),
    {
      all: 5,
      draft: 2,
      scheduled: 1,
      published: 1,
      failed: 1,
    },
  );
});

test("scheduled display uses the saved timezone and hides invalid dates", () => {
  assert.equal(
    formatPostScheduledAt(post({ scheduledAt: "2026-10-04T08:00:00.000Z" })),
    "2026. 10. 04 11:00",
  );
  assert.equal(formatPostScheduledAt(post({ scheduledAt: "invalid" })), "");
  assert.equal(
    formatPostScheduledAt(post({ scheduledAt: "2026-10-04T08:00:00.000Z", timezone: "Not/AZone" })),
    "",
  );
});

test("editing filter groups editable statuses but excludes scheduled and published", () => {
  const posts = [
    post({ id: "idea", status: "idea" }),
    post({ id: "draft", status: "draft" }),
    post({ id: "review", status: "review" }),
    post({ id: "scheduled", status: "scheduled" }),
    post({ id: "published", status: "published" }),
  ];
  assert.deepEqual(
    filterAndSortPosts(posts, { status: "editing" })
      .map((item) => item.id)
      .sort(),
    ["draft", "idea", "review"],
  );
  assert.deepEqual(
    filterAndSortPosts(posts, { status: "draft" }).map((item) => item.id),
    ["draft"],
  );
});

test("invalid updated timestamps have deterministic id fallback without mutating input", () => {
  const posts = [post({ id: "b", updatedAt: "invalid" }), post({ id: "a", updatedAt: "invalid" })];
  const result = filterAndSortPosts(posts, { sort: "updated" });
  assert.deepEqual(
    result.map((item) => item.id),
    ["a", "b"],
  );
  assert.deepEqual(
    posts.map((item) => item.id),
    ["b", "a"],
  );
});
