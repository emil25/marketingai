import { z } from "zod";
export const UiModeSchema = z.enum(["simple", "detailed"]);
export type UiMode = z.infer<typeof UiModeSchema>;
export const UiPreferencesSchema = z
  .object({
    ui_mode: UiModeSchema.optional(),
    suggestionDismissed: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "Adj meg egy beállítást.");
export function uiPreferences(user: { uiMode?: UiMode; uiModeSuggestionDismissed?: boolean }) {
  return {
    ui_mode: user.uiMode ?? "simple",
    suggestionDismissed: user.uiModeSuggestionDismissed ?? false,
  };
}
