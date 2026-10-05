import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CreativeDraftSchema,
  creativeImageIds,
  jpegSize,
  selectedCreativeIds,
} from "../src/lib/post-creative";
import { wrapCreativeText } from "../src/lib/creative-canvas";
import { creativeZip } from "../src/lib/creative-zip";
import { ownedCreativeContext } from "../src/lib/server/creative-context.server";
import {
  publishInstagramImages,
  publishFacebookImages,
} from "../src/lib/server/creative-publishing.server";
import type { AppData, WorkspaceSnapshot } from "../src/lib/data-model";

const imageId = "media_11111111-1111-4111-8111-111111111111";
const draft = {
  format: "portrait",
  template: "editorial",
  slides: [{ headline: "Hétvégi ajánlat", body: "20% kedvezmény", cta: "Foglalj most", imageId }],
  caption: "Saját szerkesztett szöveg",
} as const;
function fixture() {
  const db = {
    memberships: [{ userId: "u", workspaceId: "w" }],
    posts: [{ id: "p", workspaceId: "w", brandId: "b", status: "draft", mediaAssetIds: [] }],
    brands: [{ id: "b", workspaceId: "w" }],
    brandProfiles: [{ brandId: "b" }],
    mediaAssets: [{ id: imageId, workspaceId: "w", brandId: "b", mimeType: "image/jpeg" }],
    postVariants: [],
    campaigns: [],
  } as unknown as AppData;
  const context = { user: { id: "u" }, workspace: { id: "w" } } as WorkspaceSnapshot;
  return { db, context };
}
test("creative schema validates limits, no HTML or external URL image references", () => {
  assert.ok(CreativeDraftSchema.safeParse(draft).success);
  assert.equal(CreativeDraftSchema.safeParse({ ...draft, slides: [] }).success, false);
  assert.equal(
    CreativeDraftSchema.safeParse({ ...draft, slides: Array(7).fill(draft.slides[0]) }).success,
    false,
  );
  assert.equal(
    CreativeDraftSchema.safeParse({ ...draft, caption: "x".repeat(2201) }).success,
    false,
  );
  assert.equal(
    CreativeDraftSchema.safeParse({
      ...draft,
      slides: [{ ...draft.slides[0], imageId: "https://external.invalid/a.jpg" }],
    }).success,
    false,
  );
  assert.deepEqual(
    creativeImageIds(
      CreativeDraftSchema.parse({ ...draft, slides: [draft.slides[0], draft.slides[0]] }),
    ),
    [imageId],
  );
});
test("creative ownership rejects foreign post, brand, media and lost membership", () => {
  const { db, context } = fixture();
  assert.equal(
    ownedCreativeContext(db, context, "p", CreativeDraftSchema.parse(draft)).post.id,
    "p",
  );
  assert.throws(() => ownedCreativeContext(db, context, "foreign"));
  db.mediaAssets[0].brandId = "other";
  assert.throws(() => ownedCreativeContext(db, context, "p", CreativeDraftSchema.parse(draft)));
  db.mediaAssets[0].brandId = "b";
  db.brands[0].workspaceId = "other";
  assert.throws(() => ownedCreativeContext(db, context, "p"));
  db.brands[0].workspaceId = "w";
  db.memberships = [];
  assert.throws(() => ownedCreativeContext(db, context, "p"));
});
test("published creative cannot be replaced, but remains readable", () => {
  const { db, context } = fixture();
  db.posts[0].status = "published";
  assert.throws(() => ownedCreativeContext(db, context, "p", undefined, true));
  assert.ok(ownedCreativeContext(db, context, "p"));
});
test("JPEG dimensions come from SOF; malformed and non-JPEG are rejected", () => {
  const bytes = Uint8Array.from([0xff, 0xd8, 0xff, 0xc0, 0, 8, 8, 5, 70, 4, 56, 0, 0xff, 0xd9]);
  assert.deepEqual(jpegSize(bytes), { width: 1080, height: 1350 });
  assert.equal(jpegSize(bytes.slice(0, 8)), null);
  assert.equal(jpegSize(new TextEncoder().encode("not an image")), null);
});
test("text wrapping preserves Hungarian text and long words without ellipsis", () => {
  const lines = wrapCreativeText(
    "Árvíztűrő tükörfúrógép\nABCDEFGHIJKLM",
    10,
    (text) => text.length,
  );
  assert.ok(lines.every((line) => line.length <= 10));
  assert.equal(lines.join("").replace(/\s/g, ""), "ÁrvíztűrőtükörfúrógépABCDEFGHIJKLM");
});
test("only latest owned selected creative assets are returned in their saved order", () => {
  const job = {
    workspaceId: "w",
    brandId: "b",
    status: "completed",
    input: { kind: "creative_render", postId: "p", assetIds: ["b", "a"] },
  };
  assert.deepEqual(
    selectedCreativeIds([{ ...job, workspaceId: "other" }, job], {
      id: "p",
      workspaceId: "w",
      brandId: "b",
      mediaAssetIds: ["a", "b"],
    }),
    ["b", "a"],
  );
  assert.deepEqual(
    selectedCreativeIds([job], { id: "p", workspaceId: "w", brandId: "b", mediaAssetIds: ["a"] }),
    ["a"],
  );
});
test("ZIP contains distinct ordered files, UTF-8 caption and valid CRC32", () => {
  const entries = [
    { name: "01.jpg", bytes: new TextEncoder().encode("123456789") },
    { name: "posztszoveg.txt", bytes: new TextEncoder().encode("Árvíztűrő") },
  ];
  const bytes = creativeZip(entries),
    view = new DataView(bytes.buffer);
  assert.equal(view.getUint32(0, true), 0x04034b50);
  assert.equal(view.getUint32(14, true), 0xcbf43926);
  const end = bytes.length - 22;
  assert.equal(view.getUint16(end + 10, true), 2);
  const directory = view.getUint32(end + 16, true);
  assert.equal(view.getUint32(directory, true), 0x02014b50);
  const offset = view.getUint32(directory + 42, true);
  assert.equal(offset, 0);
  assert.ok(new TextDecoder().decode(bytes).includes("Árvíztűrő"));
});
const input = {
  accountId: "account",
  accessToken: "TEST_ONLY",
  caption: "Edited caption",
  imageUrls: ["https://example.test/1.jpg", "https://example.test/2.jpg"],
};
test("Instagram creates children in order, parent carousel, then publishes only after FINISHED", async () => {
  const calls: { path: string; params: Record<string, string> }[] = [];
  const graph = async <T>(method: string, path: string, params: Record<string, string>) => {
    calls.push({ path, params });
    if (method === "GET") return { status_code: "FINISHED" } as T;
    return { id: path.endsWith("media_publish") ? "published" : `container_${calls.length}` } as T;
  };
  assert.equal(await publishInstagramImages(input, graph, async () => {}), "published");
  const parent = calls.find((call) => call.params.media_type === "CAROUSEL");
  assert.equal(parent?.params.children, "container_1,container_3");
  assert.equal(parent?.params.caption, input.caption);
  assert.equal(calls.at(-1)?.path, "account/media_publish");
});
test("Instagram failure never reaches publish or reports success", async () => {
  let published = false;
  await assert.rejects(() =>
    publishInstagramImages(
      input,
      async <T>(method: string, path: string) => {
        if (path.endsWith("media_publish")) published = true;
        return (method === "GET" ? { status_code: "ERROR" } : { id: "container" }) as T;
      },
      async () => {},
    ),
  );
  assert.equal(published, false);
});
test("Instagram single JPEG has no carousel parent and requires external published ID", async () => {
  await assert.rejects(() =>
    publishInstagramImages(
      { ...input, imageUrls: input.imageUrls.slice(0, 1) },
      async <T>(method: string, path: string, params: Record<string, string>) => {
        assert.equal(params.media_type, undefined);
        return (
          method === "GET"
            ? { status_code: "FINISHED" }
            : path.endsWith("media_publish")
              ? {}
              : { id: "container" }
        ) as T;
      },
      async () => {},
    ),
  );
});
test("Facebook uploads unpublished images then attaches every ID in order", async () => {
  const calls: Record<string, string>[] = [];
  assert.equal(
    await publishFacebookImages(
      input,
      async <T>(_method: string, path: string, params: Record<string, string>) => {
        calls.push(params);
        return { id: path.endsWith("feed") ? "published" : `photo${calls.length}` } as T;
      },
    ),
    "published",
  );
  assert.equal(calls[0].published, "false");
  assert.equal(calls[2]["attached_media[0]"], '{"media_fbid":"photo1"}');
  assert.equal(calls[2]["attached_media[1]"], '{"media_fbid":"photo2"}');
  assert.equal(calls[2].message, input.caption);
});
