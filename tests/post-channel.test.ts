import test from "node:test";
import assert from "node:assert/strict";
import type { AppData } from "../src/lib/data-model";
import { mainChannel, MainChannelSchema } from "../src/lib/main-channel";
import {
  channelSwitchSource,
  commitChannelSwitch,
  restoreChannelText,
} from "../src/lib/server/post-channel.server";
import { generateFactualPost } from "../src/lib/server/post-content.server";
import { buildBusinessContext } from "../src/lib/business-types";
import { postCopyText } from "../src/lib/post-editor";
const scope = { userId: "u", workspaceId: "w" };
function fixture() {
  return {
    memberships: [{ userId: "u", workspaceId: "w" }],
    brands: [
      {
        id: "b",
        workspaceId: "w",
        name: "TESZT Pékség",
        products: "Kenyér",
        audience: "helyiek",
        languageMarket: "magyar",
      },
    ],
    brandProfiles: [
      { id: "profile", brandId: "b", tone: "Barátságos", updatedAt: "2026-10-08T09:00:00.000Z" },
    ],
    posts: [
      {
        id: "p",
        workspaceId: "w",
        brandId: "b",
        platforms: ["facebook"],
        updatedAt: "2026-10-08T09:00:00.000Z",
      },
    ],
    postVariants: [
      {
        id: "v",
        postId: "p",
        platform: "facebook",
        content: "Szerkesztett kenyérposzt. Írj nekünk!",
        cta: "Írj nekünk!",
        hashtags: ["#kenyér"],
        status: "prepared",
        updatedAt: "2026-10-08T09:00:00.000Z",
      },
    ],
    postVersions: [],
  } as unknown as AppData;
}
const generated = {
  content: "Kenyér reggelire. 🥐\n\nMentsd el!",
  cta: "Mentsd el!",
  hashtags: ["#kenyér", "#pékség", "#reggeli", "#helyi", "#magyar"],
  ellenorizendo: [],
};
function before(db: AppData) {
  return channelSwitchSource(db, scope, "p", "v", "instagram", db.postVariants[0].updatedAt);
}

test("channel rewrite keeps the edited source, archives full text and persists the brand main channel", () => {
  const db = fixture(),
    old = postCopyText(db.postVariants[0]);
  const selected = commitChannelSwitch(db, scope, before(db), generated);
  assert.equal(db.postVariants.length, 2);
  assert.equal(postCopyText(db.postVariants[0]), old);
  assert.equal(db.postVariants.find((v) => v.id === selected.variantId)?.platform, "instagram");
  assert.equal(db.postVersions.find((v) => v.id === selected.previousVersionId)?.content, old);
  assert.equal(mainChannel(JSON.parse(JSON.stringify(db)).brandProfiles[0]), "instagram");
  assert.deepEqual(db.posts[0].platforms, ["facebook", "instagram"]);
  const restored = restoreChannelText(
    db,
    scope,
    "p",
    selected.previousVersionId,
    db.posts[0].updatedAt,
  );
  assert.equal(postCopyText(db.postVariants.find((v) => v.id === restored)!), old);
  assert.equal(mainChannel(db.brandProfiles[0]), "facebook");
  assert.equal(
    db.postVariants.find((v) => v.id === selected.variantId)?.content,
    generated.content,
  );
});
test("concurrent source, target, post and profile changes are rejected without losing edits", () => {
  for (const mutate of [
    (db: AppData) => {
      db.postVariants[0].content = "Másik ablak szerkesztése";
    },
    (db: AppData) => {
      db.postVariants.push({ ...db.postVariants[0], id: "ig", platform: "instagram" });
    },
    (db: AppData) => {
      db.posts[0].updatedAt = "2026-10-08T10:00:00.000Z";
    },
    (db: AppData) => {
      db.brandProfiles[0].updatedAt = "2026-10-08T10:00:00.000Z";
    },
    (db: AppData) => {
      db.brands[0].products = "Másik ablakban módosított kínálat";
    },
  ]) {
    const db = fixture(),
      captured = before(db);
    mutate(db);
    const unchanged = JSON.stringify(db);
    assert.throws(() => commitChannelSwitch(db, scope, captured, generated), /közben megváltoztak/);
    assert.equal(JSON.stringify(db), unchanged);
  }
});
test("existing target is archived; restore rejects stale revision and foreign IDs", () => {
  const db = fixture();
  db.postVariants.push({
    ...db.postVariants[0],
    id: "ig",
    platform: "instagram",
    content: "Korábbi Instagram",
    hashtags: ["#régi"],
  });
  const prior = postCopyText(db.postVariants[1]),
    result = commitChannelSwitch(db, scope, before(db), generated);
  assert.equal(db.postVariants.length, 2);
  assert.equal(db.postVersions.length, 2);
  assert.ok(db.postVersions.some((v) => v.content === prior));
  assert.throws(
    () => restoreChannelText(db, scope, "p", result.previousVersionId, "stale"),
    /közben megváltozott/,
  );
  assert.throws(
    () =>
      restoreChannelText(
        db,
        { ...scope, workspaceId: "foreign" },
        "p",
        result.previousVersionId,
        db.posts[0].updatedAt,
      ),
    /hozzáférés/,
  );
  assert.throws(
    () => restoreChannelText(db, scope, "p", "foreign-version", db.posts[0].updatedAt),
    /hozzáférés/,
  );
});
test("channel switching requires ownership, a fresh revision, unpublished text and a valid main channel", () => {
  const db = fixture();
  assert.equal(mainChannel(), "facebook");
  assert.equal(mainChannel({ mainChannel: "invalid" }), "facebook");
  assert.equal(MainChannelSchema.safeParse("tiktok").success, false);
  assert.throws(
    () =>
      channelSwitchSource(
        db,
        { ...scope, userId: "foreign" },
        "p",
        "v",
        "instagram",
        db.postVariants[0].updatedAt,
      ),
    /hozzáférés/,
  );
  assert.throws(
    () => channelSwitchSource(db, scope, "p", "v", "instagram", "stale"),
    /közben megváltozott/,
  );
  db.postVariants[0].status = "published";
  assert.throws(() => before(db), /közzétett/);
  db.postVariants[0].status = "prepared";
  const saved = commitChannelSwitch(db, scope, before(db), generated);
  db.posts[0].status = "scheduled";
  const unchanged = JSON.stringify(db);
  assert.throws(() => before(db), /ütemezett/);
  assert.throws(
    () => restoreChannelText(db, scope, "p", saved.previousVersionId, db.posts[0].updatedAt),
    /ütemezett/,
  );
  assert.equal(JSON.stringify(db), unchanged);
});
test("actual factual AI contract receives edited text, target platform and brand context; invalid Instagram retries", async () => {
  const db = fixture(),
    profile = db.brandProfiles[0];
  const context = buildBusinessContext(db.brands[0], profile, {
    platform: "instagram",
    goal: "Ismertség",
  });
  let requests = 0;
  const value = await generateFactualPost(
    {
      businessContext: context,
      title: "TESZT",
      platforms: ["instagram"],
      ctaStyle: "Írj nekünk!",
      brief: postCopyText(db.postVariants[0]),
      requireChannelTags: true,
    },
    async (request) => {
      const user = JSON.parse(request.messages.find((m) => m.role === "user")!.content);
      assert.ok(user.brief.includes("Szerkesztett kenyérposzt"));
      assert.deepEqual(user.platforms, ["instagram"]);
      assert.ok(request.messages[0].content.includes("TESZT Pékség"));
      requests++;
      return Response.json({
        choices: [
          {
            message: {
              content: JSON.stringify({
                variants: [
                  {
                    ...generated,
                    platform: "instagram",
                    hashtags: requests === 1 ? [] : generated.hashtags,
                  },
                ],
              }),
            },
          },
        ],
      });
    },
  );
  assert.equal(requests, 2);
  assert.equal(value.variants[0].hashtags.length, 5);
});
