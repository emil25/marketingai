import { before, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { AppData, WorkspaceSnapshot } from "../src/lib/data-model";
import { VideoScenesSchema, wrapVideoCaption } from "../src/lib/video";
import { ownedVideoContext } from "../src/lib/server/video-context.server";

let database: AppData;
let context: WorkspaceSnapshot;
let directory: string;
const execute = promisify(execFile);
const sourceIds = [
  "media_11111111-1111-4111-8111-111111111111",
  "media_22222222-2222-4222-8222-222222222222",
];

before(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "marketingpilot-video-qa-"));
  process.env.MARKETINGPILOT_DATA_DIR = directory;
  process.env.DATABASE_URL = "";
  process.env.DIRECT_URL = "";
  const store = await import("../src/lib/server/store.server");
  const { hashPassword } = await import("../src/lib/server/password.server");
  const { videoRenderConfiguration } = await import("../src/lib/server/video-render.server");
  database = await store.readData();
  const timestamp = store.nowIso();
  const user = {
    id: "user_video_qa",
    email: "video-qa@example.test",
    displayName: "Videó QA TESZT",
    passwordHash: hashPassword("VideoQaOnly2026!"),
    createdAt: timestamp,
  };
  const workspace = {
    id: "workspace_video_qa",
    name: "VIDEÓ QA – elkülönített teszt",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const membership = {
    id: "membership_video_qa",
    workspaceId: workspace.id,
    userId: user.id,
    role: "owner" as const,
    createdAt: timestamp,
  };
  const brand = {
    id: "brand_video_qa",
    workspaceId: workspace.id,
    name: "TESZT – Csíki Ízek",
    website: "",
    cityRegion: "Csíkszereda",
    languageMarket: "magyar",
    industry: "étterem",
    products: "",
    services: "helyi ebéd",
    offers: "",
    audience: "helyi vendégek",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const profile = {
    ...store.defaultBrandProfile(brand.id),
    businessType: "restaurant",
    colors: ["#F7664B"],
  };
  database.users.push(user);
  database.workspaces.push(workspace);
  database.memberships.push(membership);
  database.brands.push(brand);
  database.brandProfiles.push(profile);
  database.posts.push({
    id: "post_video_qa",
    workspaceId: workspace.id,
    brandId: brand.id,
    title: "TESZT – ebéd a Csíki Ízeknél",
    goal: "asztalfoglalás",
    audience: brand.audience,
    language: "magyar",
    tone: "Barátságos",
    status: "draft",
    timezone: "Europe/Bucharest",
    mediaAssetIds: [...sourceIds],
    platforms: ["instagram"],
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  database.postVariants.push({
    id: "variant_video_qa",
    postId: "post_video_qa",
    platform: "instagram",
    content:
      "Egy közös ebéd közelebb hoz. Látogass el a Csíki Ízekhez Csíkszeredában, és foglalj asztalt!",
    hashtags: [],
    cta: "Foglalj asztalt!",
    status: "draft",
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  const { binary } = await videoRenderConfiguration();
  for (const [index, id] of sourceIds.entries()) {
    const source = path.join(directory, `qa-photo-${index}.png`);
    await execute(
      binary,
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-f",
        "lavfi",
        "-i",
        `color=c=${index ? "0xF7664B" : "0x153D31"}:s=720x720`,
        "-frames:v",
        "1",
        "-threads",
        "1",
        source,
      ],
      { windowsHide: true },
    );
    const bytes = await readFile(source);
    await store.writeMediaFile(id, bytes);
    database.mediaAssets.push({
      id,
      workspaceId: workspace.id,
      brandId: brand.id,
      filename: `TESZT-szin-${index}.png`,
      mimeType: "image/png",
      size: bytes.length,
      width: 720,
      height: 720,
      path: id,
      altText: "Kizárólag videó QA-hoz készült színkép",
      source: "upload",
      createdAt: timestamp,
    });
  }
  await store.transact((db) => Object.assign(db, database));
  context = {
    user,
    workspace,
    membership,
    brands: [{ ...brand, profile }],
    activeBrand: { ...brand, profile },
  };
  await writeFile(path.resolve("video-qa-directory.local"), directory, "utf8");
});

test("video validation rejects invalid durations, empty captions and too many scenes", () => {
  const scene = { mediaAssetId: sourceIds[0], caption: "Árvíztűrő tükörfúrógép", duration: 3 };
  assert.ok(VideoScenesSchema.safeParse([scene]).success);
  assert.equal(VideoScenesSchema.safeParse([{ ...scene, duration: 0 }]).success, false);
  assert.equal(VideoScenesSchema.safeParse([{ ...scene, caption: "" }]).success, false);
  assert.equal(VideoScenesSchema.safeParse(Array(7).fill(scene)).success, false);
  assert.equal(
    VideoScenesSchema.safeParse([{ ...scene, mediaAssetId: "../../secret" }]).success,
    false,
  );
  assert.ok(
    wrapVideoCaption("Őszi étlap. % { untrusted }\nÁrvíztűrő tükörfúrógép").includes("Árvíztűrő"),
  );
});

test("video requires membership, owned post, same brand photos and supported image MIME", () => {
  assert.equal(
    ownedVideoContext(database, context, "post_video_qa", sourceIds).post.id,
    "post_video_qa",
  );
  assert.throws(() =>
    ownedVideoContext({ ...database, memberships: [] }, context, "post_video_qa", sourceIds),
  );
  assert.throws(() => ownedVideoContext(database, context, "post_missing", sourceIds));
  assert.throws(() =>
    ownedVideoContext(database, context, "post_video_qa", [sourceIds[0], sourceIds[0]]),
  );
  for (const changes of [
    { workspaceId: "other_workspace" },
    { brandId: "other_brand" },
    { mimeType: "image/svg+xml" },
    { size: 11 * 1024 * 1024 },
  ]) {
    const other = {
      ...database,
      mediaAssets: database.mediaAssets.map((item) => ({ ...item, ...changes })),
    };
    assert.throws(() => ownedVideoContext(other, context, "post_video_qa", sourceIds));
  }
  assert.throws(() =>
    ownedVideoContext(
      {
        ...database,
        brands: database.brands.map((item) => ({ ...item, workspaceId: "other_workspace" })),
      },
      context,
      "post_video_qa",
      sourceIds,
    ),
  );
});

test("real FFmpeg makes playable portrait and square MP4 with Hungarian captions", async () => {
  const { renderPhotoVideo, videoRenderConfiguration } =
    await import("../src/lib/server/video-render.server");
  const { binary } = await videoRenderConfiguration();
  for (const format of ["portrait", "square"] as const) {
    const output = await renderPhotoVideo({
      format,
      brandName: "TESZT – Árvíztűrő műhely",
      color: "#F7664B",
      scenes: sourceIds.map((id, index) => ({
        mediaAssetId: id,
        caption: index
          ? "Foglalj asztalt! Árvíztűrő tükörfúrógép. % { untrusted }"
          : "Jó ebéd, jó társaság – Csíkszeredában.",
        duration: 3,
      })),
    });
    assert.ok(output.size > 1000);
    assert.equal(output.bytes.subarray(4, 8).toString(), "ftyp");
    assert.equal(output.height, format === "portrait" ? 1280 : 720);
    const file = path.join(directory, `qa-${format}.mp4`);
    await writeFile(file, output.bytes);
    await execute(binary, ["-hide_banner", "-loglevel", "error", "-i", file, "-f", "null", "-"], {
      windowsHide: true,
    });
  }
});

test("render failure is visible and releases capacity for retry", async () => {
  const { renderPhotoVideo } = await import("../src/lib/server/video-render.server");
  await assert.rejects(
    renderPhotoVideo({
      format: "portrait",
      brandName: "QA",
      scenes: [
        {
          mediaAssetId: "media_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          caption: "Hiányzó kép",
          duration: 3,
        },
      ],
    }),
  );
  const store = await import("../src/lib/server/store.server");
  const disguised = "media_bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  await store.writeMediaFile(disguised, Buffer.from("#EXTM3U\nhttp://127.0.0.1/private\n"));
  await assert.rejects(
    renderPhotoVideo({
      format: "square",
      brandName: "QA",
      scenes: [{ mediaAssetId: disguised, caption: "Nem képfájl", duration: 3 }],
    }),
    /nem érvényes/,
  );
  const output = await renderPhotoVideo({
    format: "square",
    brandName: "QA",
    scenes: [{ mediaAssetId: sourceIds[0], caption: "Újrapróbálás", duration: 3 }],
  });
  assert.ok(output.size > 1000);
});
