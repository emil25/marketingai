import { createFileRoute } from "@tanstack/react-router";
import { MetaOAuthError, prepareMetaOAuth } from "@/lib/channel.oauth.server";
import { getOptionalAuthContext } from "@/lib/server/auth-context.server";

const supportedProviders = new Set(["facebook", "instagram"]);

function channelsRedirect(request: Request, code?: string) {
  const target = new URL("/app/channels", request.url);
  if (code) target.searchParams.set("channelError", code);
  return new Response(null, { status: 302, headers: { Location: target.toString() } });
}

function loginRedirect(request: Request) {
  return new Response(null, {
    status: 302,
    headers: { Location: new URL("/login", request.url).toString() },
  });
}

export const Route = createFileRoute("/api/channels/oauth/$provider")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        if (!supportedProviders.has(params.provider))
          return channelsRedirect(request, "unsupported");
        try {
          if (!(await getOptionalAuthContext())) return loginRedirect(request);
        } catch {
          return loginRedirect(request);
        }
        try {
          const result = await prepareMetaOAuth(params.provider as "facebook" | "instagram");
          return new Response(null, {
            status: 302,
            headers: { Location: result.authorizationUrl },
          });
        } catch (cause) {
          const code = cause instanceof MetaOAuthError ? cause.code : "unexpected";
          return channelsRedirect(request, code);
        }
      },
    },
  },
});
