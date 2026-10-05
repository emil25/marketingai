import assert from "node:assert/strict";
import { test } from "node:test";
import {
  defaultPostPlatforms,
  postCopyText,
  postTitle,
  publicationBlockReason,
  saveThenPublish,
} from "../src/lib/post-editor.ts";

test("one brief can start without a mandatory platform selection step", () => {
  assert.deepEqual(defaultPostPlatforms(), ["facebook"]);
  assert.deepEqual(defaultPostPlatforms([]), ["facebook"]);
  assert.deepEqual(defaultPostPlatforms(["instagram", "linkedin"]), ["instagram", "linkedin"]);
  assert.deepEqual(defaultPostPlatforms(undefined, [{ platform: "tiktok" }]), ["tiktok"]);
  assert.deepEqual(defaultPostPlatforms(["facebook", "facebook"]), ["facebook"]);
});

test("publication requires a real connection, permission, text and Instagram image", () => {
  const variant = { content: "Szerkesztett ajánlat", status: "prepared" as const };
  const connected = {
    status: "connected" as const,
    hasAccessToken: true,
    scopes: ["pages_manage_posts", "instagram_content_publish"],
  };
  assert.equal(publicationBlockReason("facebook", connected, variant, false), null);
  assert.match(publicationBlockReason("facebook", undefined, variant, false)!, /Csatlakoztasd/);
  assert.match(
    publicationBlockReason("facebook", { ...connected, status: "expired" }, variant, false)!,
    /Csatlakoztasd/,
  );
  assert.match(
    publicationBlockReason("facebook", { ...connected, scopes: [] }, variant, false)!,
    /engedély/,
  );
  assert.match(
    publicationBlockReason("facebook", connected, { ...variant, content: " " }, false)!,
    /posztszöveget/,
  );
  assert.match(publicationBlockReason("instagram", connected, variant, false)!, /JPEG/);
  assert.equal(publicationBlockReason("instagram", connected, variant, true), null);
  assert.match(
    publicationBlockReason("facebook", connected, { ...variant, status: "published" }, false)!,
    /már közzé/,
  );
});

test("the edited text must be saved before publication and failed saving stops publication", async () => {
  const calls: string[] = [];
  const result = await saveThenPublish(
    async () => {
      calls.push("save edited text");
    },
    async () => {
      calls.push("publish saved text");
      return "external-id";
    },
  );
  assert.deepEqual(calls, ["save edited text", "publish saved text"]);
  assert.equal(result, "external-id");
  let attempted = false;
  await assert.rejects(
    saveThenPublish(
      async () => {
        throw new Error("save failed");
      },
      async () => {
        attempted = true;
      },
    ),
    /save failed/,
  );
  assert.equal(attempted, false);
});

test("the draft gets a title from the brief without a separate title form", () => {
  assert.equal(
    postTitle("", "  Hétvégi pizzaakció 20% kedvezménnyel  "),
    "Hétvégi pizzaakció 20% kedvezménnyel",
  );
  assert.equal(postTitle("  Saját cím  ", "Másik brief"), "Saját cím");
  assert.equal(postTitle("", "a".repeat(200)).length, 80);
  assert.equal(postTitle("", ""), "Névtelen poszt");
});

test("copy uses the edited content, CTA and current hashtags", () => {
  assert.equal(
    postCopyText({
      content: "  Átírt hétvégi ajánlat. ",
      cta: " Foglalj most! ",
      hashtags: ["#pizza", " #helyi ", ""],
    }),
    "Átírt hétvégi ajánlat.\n\nFoglalj most!\n\n#pizza #helyi",
  );
  assert.equal(
    postCopyText({ content: "Foglalj most!", cta: "Foglalj most!", hashtags: [] }),
    "Foglalj most!",
  );
  assert.equal(
    postCopyText({ content: "Csak a szerkesztett szöveg.", cta: "", hashtags: [] }),
    "Csak a szerkesztett szöveg.",
  );
  assert.equal(
    postCopyText({
      content: "Ajánlat #pizza",
      cta: "",
      hashtags: ["pizza", "#pizza", "helyi"],
    }),
    "Ajánlat #pizza\n\n#helyi",
  );
});
