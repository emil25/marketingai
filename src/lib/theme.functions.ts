import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuthContext } from "@/lib/server/auth-context.server";
import { useAppSession, type ThemePreference } from "@/lib/server/session.server";

const ThemeSchema = z.enum(["marketingpilot-v2", "postmaster", "marketingpilot"]);

export const getThemePreference = createServerFn({ method: "GET" }).handler(async () => {
  await requireAuthContext();
  const session = await useAppSession();
  return session.data.themePreference ?? "marketingpilot-v2" satisfies ThemePreference;
});

export const setThemePreference = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ theme: ThemeSchema }).parse(data))
  .handler(async ({ data }) => {
    const context = await requireAuthContext();
    const session = await useAppSession();
    await session.update({
      ...session.data,
      userId: context.user.id,
      workspaceId: context.workspace.id,
      themePreference: data.theme,
    });
    return { theme: data.theme };
  });
