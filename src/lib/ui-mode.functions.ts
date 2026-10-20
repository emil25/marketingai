import { createServerFn } from "@tanstack/react-start";
import { requireAuthContext } from "./server/auth-context.server";
import { uiPreferences } from "./ui-mode";
export const getUiPreferences = createServerFn({ method: "GET" }).handler(async () => {
  const { user } = await requireAuthContext();
  return uiPreferences(user);
});
