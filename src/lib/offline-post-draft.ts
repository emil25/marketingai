import { AiProviderUnavailableError } from "./ai-call-policy";

/** Stored in the existing warning field so no database migration is needed. */
export const AI_UNAVAILABLE_DRAFT_MARKER = "AI_UNAVAILABLE_DRAFT";

export function shouldSaveIdeaAsOfflineDraft(cause: unknown, existingPostId?: string) {
  // A failed retry must leave the existing saved text untouched.
  return !existingPostId && cause instanceof AiProviderUnavailableError;
}

/** The user’s exact idea is the only copy allowed in this no-AI draft. */
export function offlineIdeaVariants(idea: string, platforms: readonly string[]) {
  const content = idea.trim();
  return [...new Set(platforms)].map((platform) => ({
    platform,
    content,
    hashtags: [] as string[],
    cta: "",
    ellenorizendo: [AI_UNAVAILABLE_DRAFT_MARKER],
  }));
}

