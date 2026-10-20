import type { AppData, PostVariantRecord } from "../data-model";
import { contentPlaceholders } from "../content-quality";
import { postCopyText } from "../post-editor";
import { MainChannelSchema, type MainChannel } from "../main-channel";
import { newId, nowIso } from "./store.server";

type Scope = { userId: string; workspaceId: string };
function owned(db: AppData, scope: Scope, postId: string) {
  const post = db.posts.find((p) => p.id === postId && p.workspaceId === scope.workspaceId);
  const brand = db.brands.find(
    (b) => b.id === post?.brandId && b.workspaceId === scope.workspaceId,
  );
  if (
    !post ||
    !db.memberships.some((m) => m.userId === scope.userId && m.workspaceId === scope.workspaceId) ||
    !brand
  )
    throw new Error("Nincs hozzáférés ehhez a poszthoz.");
  const profile = db.brandProfiles.find((p) => p.brandId === post.brandId);
  if (!profile) throw new Error("A vállalkozás beállításai nem találhatók.");
  return { post, profile, brand };
}
function revision(variant?: PostVariantRecord) {
  return JSON.stringify(variant ?? null);
}
export function channelSwitchSource(
  db: AppData,
  scope: Scope,
  postId: string,
  variantId: string,
  channel: MainChannel,
  expectedUpdatedAt: string,
) {
  MainChannelSchema.parse(channel);
  const { post, profile, brand } = owned(db, scope, postId);
  const source = db.postVariants.find((v) => v.id === variantId && v.postId === post.id);
  if (!source?.content.trim()) throw new Error("Előbb készíts posztszöveget.");
  if (source.updatedAt !== expectedUpdatedAt)
    throw new Error("A poszt közben megváltozott. Nyisd meg újra, majd próbáld ismét.");
  if (source.status === "published")
    throw new Error("A közzétett posztról előbb készíts másolatot.");
  if (post.status === "scheduled")
    throw new Error(
      "Az ütemezett posztról előbb készíts másolatot a csatornaváltáshoz. Az időzítésedet nem módosítottuk.",
    );
  if (source.platform === channel) throw new Error("Ez a csatorna már ki van választva.");
  const target = db.postVariants.find(
    (v) => v.postId === post.id && v.platform === channel && v.id !== source.id,
  );
  if (target?.status === "published")
    throw new Error("Ez a csatornaváltozat már közzé van téve. Előbb készíts másolatot.");
  return {
    postId,
    brandId: post.brandId,
    channel,
    source: structuredClone(source),
    sourceRevision: revision(source),
    targetRevision: revision(target),
    postRevision: JSON.stringify(post),
    profileRevision: JSON.stringify(profile),
    brandRevision: JSON.stringify(brand),
  };
}
export type ChannelSwitchSource = ReturnType<typeof channelSwitchSource>;
export function commitChannelSwitch(
  db: AppData,
  scope: Scope,
  before: ChannelSwitchSource,
  generated: { content: string; cta: string; hashtags: string[]; ellenorizendo: string[] },
) {
  const { post, profile, brand } = owned(db, scope, before.postId);
  const source = db.postVariants.find((v) => v.id === before.source.id && v.postId === post.id);
  const target = db.postVariants.find(
    (v) => v.postId === post.id && v.platform === before.channel && v.id !== before.source.id,
  );
  if (
    post.brandId !== before.brandId ||
    JSON.stringify(post) !== before.postRevision ||
    JSON.stringify(profile) !== before.profileRevision ||
    JSON.stringify(brand) !== before.brandRevision ||
    revision(source) !== before.sourceRevision ||
    revision(target) !== before.targetRevision
  )
    throw new Error(
      "A poszt vagy a vállalkozás adatai közben megváltoztak. Nem írtuk felül a módosítást; nyisd meg újra.",
    );
  const timestamp = nowIso();
  const previous = {
    id: newId("version"),
    postId: post.id,
    variantId: source!.id,
    content: postCopyText(source!),
    createdAt: timestamp,
    createdBy: scope.userId,
  };
  db.postVersions.push(previous);
  // Keep both platform versions. Archive a previous target, including its CTA and hashtags.
  if (target)
    db.postVersions.push({
      id: newId("version"),
      postId: post.id,
      variantId: target.id,
      content: postCopyText(target),
      createdAt: timestamp,
      createdBy: scope.userId,
    });
  const selected = target ?? {
    id: newId("variant"),
    postId: post.id,
    platform: before.channel,
    createdAt: timestamp,
  };
  Object.assign(selected, {
    content: generated.content,
    cta: generated.cta,
    hashtags: generated.hashtags,
    verificationWarnings: generated.ellenorizendo,
    status: contentPlaceholders(generated.content, generated.cta, ...generated.hashtags).length
      ? "draft"
      : "prepared",
    updatedAt: timestamp,
  });
  if (!target) db.postVariants.push(selected as PostVariantRecord);
  post.platforms = [...new Set([...(post.platforms ?? []), before.channel])];
  post.updatedAt = timestamp;
  profile.mainChannel = before.channel;
  profile.updatedAt = timestamp;
  return { variantId: selected.id, previousVersionId: previous.id };
}
export function restoreChannelText(
  db: AppData,
  scope: Scope,
  postId: string,
  versionId: string,
  expectedPostUpdatedAt: string,
) {
  const { post, profile } = owned(db, scope, postId);
  if (post.updatedAt !== expectedPostUpdatedAt)
    throw new Error("A poszt közben megváltozott. Nyisd meg újra a visszaállítás előtt.");
  if (post.status === "scheduled")
    throw new Error(
      "Az ütemezett posztról előbb készíts másolatot. Az időzítésedet nem módosítottuk.",
    );
  const version = db.postVersions.find((v) => v.id === versionId && v.postId === post.id);
  const variant = db.postVariants.find((v) => v.id === version?.variantId && v.postId === post.id);
  if (!version || !variant) throw new Error("Nincs hozzáférés ehhez a korábbi szöveghez.");
  if (variant.status === "published") throw new Error("A közzétett poszt nem írható felül.");
  const timestamp = nowIso();
  db.postVersions.push({
    id: newId("version"),
    postId,
    variantId: variant.id,
    content: postCopyText(variant),
    createdAt: timestamp,
    createdBy: scope.userId,
  });
  Object.assign(variant, {
    content: version.content,
    cta: "",
    hashtags: [],
    status: contentPlaceholders(version.content).length ? "draft" : "prepared",
    updatedAt: timestamp,
  });
  post.updatedAt = timestamp;
  if (MainChannelSchema.safeParse(variant.platform).success) {
    profile.mainChannel = variant.platform as MainChannel;
    profile.updatedAt = timestamp;
  }
  return variant.id;
}
