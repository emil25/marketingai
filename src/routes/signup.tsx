import { redirectSignedInUser } from "@/lib/guest-route";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { SignupForm } from "@/components/signup-form";
export const Route = createFileRoute("/signup")({ beforeLoad: redirectSignedInUser, validateSearch: z.object({ businessType: z.string().optional() }), component: SignupPage });
function SignupPage() {
  const search = Route.useSearch();
  return <div className="theme-marketingpilot-v2 public-site grid min-h-screen place-items-center bg-background p-4"><SignupForm businessType={search.businessType} /></div>;
}
