import { createFileRoute } from "@tanstack/react-router";
import { handleMetaOAuthCallback, MetaOAuthError } from "@/lib/channel.oauth.server";
import { getOptionalAuthContext } from "@/lib/server/auth-context.server";

function channelsRedirect(
  request: Request,
  key: "channelError" | "channelConnected" | "channelSelection",
  value: string,
) {
  const target = new URL("/app/channels", request.url);
  target.searchParams.set(key, value);
  return new Response(null, { status: 302, headers: { Location: target.toString() } });
}

function loginRedirect(request: Request) {
  return new Response(null, {
    status: 302,
    headers: { Location: new URL("/login", request.url).toString() },
  });
}

export const Route = createFileRoute("/api/channels/oauth-callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          if (!(await getOptionalAuthContext())) return loginRedirect(request);
        } catch {
          return loginRedirect(request);
        }
        try {
          const result = await handleMetaOAuthCallback(new URL(request.url));
          if (result.selectionId)
            return channelsRedirect(request, "channelSelection", result.selectionId);
          return channelsRedirect(request, "channelConnected", result.provider);
        } catch (cause) {
          const code = cause instanceof MetaOAuthError ? cause.code : "unexpected";
          return channelsRedirect(request, "channelError", code);
        }
      },
    },
  },
});
