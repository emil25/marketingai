import type { PostPlatform, PostRecord, PostStatus, PostVariantRecord } from "./data-model";
import { formatPostScheduleInput } from "./post-schedule.ts";

export type InboxPost = Pick<
  PostRecord,
  | "id"
  | "title"
  | "goal"
  | "status"
  | "scheduledAt"
  | "timezone"
  | "updatedAt"
  | "createdAt"
  | "platforms"
> & {
  brandName?: string;
  variants: Array<Pick<PostVariantRecord, "platform" | "content" | "status" | "id">>;
};

export type PostInboxFilters = {
  query?: string;
  status?: "all" | PostStatus | "editing";
  platform?: "all" | PostPlatform;
  sort?: "updated" | "title" | "scheduled";
};

export type PostInboxSummary = {
  all: number;
  draft: number;
  scheduled: number;
  published: number;
  failed: number;
};

function timestamp(value: string | null | undefined) {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function searchText(post: InboxPost) {
  return [post.title, post.goal, post.brandName, ...post.variants.map((variant) => variant.content)]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("hu-HU");
}

export function postMatchesPlatform(post: InboxPost, platform: PostPlatform) {
  return (
    post.variants.some((variant) => variant.platform === platform) ||
    post.platforms?.includes(platform) === true
  );
}

export function selectPostVariant<T extends InboxPost>(
  post: T,
  platform?: PostPlatform | "all",
): T["variants"][number] | null {
  if (platform && platform !== "all") {
    return post.variants.find((variant) => variant.platform === platform) ?? null;
  }
  return post.variants[0] ?? null;
}

export function filterAndSortPosts<T extends InboxPost>(
  posts: readonly T[],
  filters: PostInboxFilters = {},
): T[] {
  const query = filters.query?.trim().toLocaleLowerCase("hu-HU") ?? "";
  const status = filters.status ?? "all";
  const platform = filters.platform ?? "all";
  const sort = filters.sort ?? "updated";
  const result = posts.filter((post) => {
    if (query && !searchText(post).includes(query)) return false;
    if (status === "editing" && !["idea", "draft", "review"].includes(post.status)) return false;
    if (status !== "all" && status !== "editing" && post.status !== status) return false;
    if (platform !== "all" && !postMatchesPlatform(post, platform)) return false;
    return true;
  });

  return result
    .map((post, index) => ({ post, index }))
    .sort((left, right) => {
      if (sort === "title") {
        const titleOrder = left.post.title.localeCompare(right.post.title, "hu");
        if (titleOrder) return titleOrder;
      } else if (sort === "scheduled") {
        const leftDate = timestamp(left.post.scheduledAt);
        const rightDate = timestamp(right.post.scheduledAt);
        if (leftDate !== null && rightDate === null) return -1;
        if (leftDate === null && rightDate !== null) return 1;
        if (leftDate !== null && rightDate !== null && leftDate !== rightDate)
          return leftDate - rightDate;
      } else {
        const updatedOrder =
          (timestamp(right.post.updatedAt) ?? Number.MIN_SAFE_INTEGER) -
          (timestamp(left.post.updatedAt) ?? Number.MIN_SAFE_INTEGER);
        if (updatedOrder) return updatedOrder;
      }
      const idOrder = left.post.id.localeCompare(right.post.id);
      return idOrder || left.index - right.index;
    })
    .map(({ post }) => post);
}

export function summarizePosts(posts: readonly Pick<InboxPost, "status">[]): PostInboxSummary {
  return {
    all: posts.length,
    draft: posts.filter(
      (post) => post.status === "draft" || post.status === "idea" || post.status === "review",
    ).length,
    scheduled: posts.filter((post) => post.status === "scheduled").length,
    published: posts.filter((post) => post.status === "published").length,
    failed: posts.filter((post) => post.status === "failed").length,
  };
}

export function formatPostScheduledAt(post: Pick<InboxPost, "scheduledAt" | "timezone">) {
  const localValue = formatPostScheduleInput(post.scheduledAt, post.timezone);
  if (!localValue) return "";
  const [date, time] = localValue.split("T");
  return `${date.replaceAll("-", ". ")} ${time}`;
}
