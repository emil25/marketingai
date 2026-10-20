import { createServerFn } from "@tanstack/react-start";
import { requireAuthContext } from "./server/auth-context.server";
import { aiValidationReasonSummary } from "./server/ai-calls.server";

/** An admin can see only the current workspace's category totals, never AI text. */
export const getAiValidationSummary = createServerFn({ method: "GET" }).handler(async () => {
  const context = await requireAuthContext();
  if (context.membership.role !== "owner" && context.membership.role !== "admin")
    throw new Error("Ehhez az összesítéshez admin jogosultság szükséges.");
  return aiValidationReasonSummary(context.workspace.id);
});
