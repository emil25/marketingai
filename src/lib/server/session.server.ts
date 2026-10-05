import { useSession } from "@tanstack/react-start/server";

export type AppSessionData = {
  userId?: string;
  workspaceId?: string;
  activeBrandId?: string;
  themePreference?: ThemePreference;
};

export type ThemePreference = "marketingpilot-v2" | "postmaster" | "marketingpilot";

export function useAppSession() {
  const configuredSecret = process.env["SESSION_SECRET"];
  const isProduction = process.env["NODE_ENV"] === "production";
  if (isProduction && (!configuredSecret || configuredSecret.length < 32)) {
    throw new Error("SESSION_SECRET must be configured with at least 32 characters in production.");
  }
  return useSession<AppSessionData>({
    name: "marketingpilot-session",
    password: configuredSecret || "marketingpilot-development-session-secret-change-me",
    cookie: {
      secure: isProduction,
      sameSite: "lax",
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 30,
    },
  });
}
