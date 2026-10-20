import { useEffect, useRef, useState } from "react";
import { getAuthConfiguration } from "@/lib/account.functions";
type Turnstile = {
  render: (element: HTMLElement, options: Record<string, unknown>) => string;
  remove: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}
let scriptReady: Promise<void> | undefined;
function loadScript() {
  if (window.turnstile) return Promise.resolve();
  return (scriptReady ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptReady = undefined;
      reject(new Error("challenge"));
    };
    document.head.appendChild(script);
  }));
}
export function AuthChallenge({
  action,
  onToken,
  onReady,
  onConfiguration,
}: {
  action: "signup" | "login" | "reset";
  onToken: (token: string) => void;
  onReady: (ready: boolean) => void;
  onConfiguration?: (config: Awaited<ReturnType<typeof getAuthConfiguration>>) => void;
}) {
  const node = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const callbacks = useRef({ onToken, onReady, onConfiguration });
  callbacks.current = { onToken, onReady, onConfiguration };
  useEffect(() => {
    let disposed = false;
    let widget: string | undefined;
    callbacks.current.onReady(false);
    void getAuthConfiguration()
      .then(async (config) => {
        if (disposed) return;
        callbacks.current.onConfiguration?.(config);
        if (action === "signup" && !config.registrationEnabled) {
          setError(config.registrationMessage);
          return;
        }
        if (!config.turnstileSiteKey) {
          callbacks.current.onReady(true);
          return;
        }
        await loadScript();
        if (disposed || !node.current || !window.turnstile) return;
        widget = window.turnstile.render(node.current, {
          sitekey: config.turnstileSiteKey,
          action,
          language: "hu",
          size: "flexible",
          callback: (token: string) => {
            callbacks.current.onToken(token);
            callbacks.current.onReady(true);
          },
          "expired-callback": () => {
            callbacks.current.onToken("");
            callbacks.current.onReady(false);
          },
          "error-callback": () => {
            callbacks.current.onReady(false);
            setError("A biztonsági ellenőrzés nem töltődött be. Frissítsd az oldalt.");
          },
        });
      })
      .catch(() => {
        if (!disposed) setError("A biztonsági ellenőrzés nem érhető el. Frissítsd az oldalt.");
      });
    return () => {
      disposed = true;
      if (widget && window.turnstile) window.turnstile.remove(widget);
    };
  }, [action]);
  return (
    <div>
      <div ref={node} />
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
