import { redirect } from "@tanstack/react-router";
import { getCurrentUser } from "@/lib/auth.functions";

/** Returning users go straight to their existing workspace. */
export async function redirectSignedInUser() {
  if (await getCurrentUser()) throw redirect({ to: "/app" });
}
