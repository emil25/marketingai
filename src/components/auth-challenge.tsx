import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { getAuthConfiguration } from "@/lib/account.functions";
import { translate } from "@/i18n";
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
  onConfigurationError,
  hideRegistrationClosedError = false,
  hideConfigurationError = false,
}: {
  action: "signup" | "login" | "reset";
  onToken: (token: string) => void;
  onReady: (ready: boolean) => void;
  onConfiguration?: (config: Awaited<ReturnType<typeof getAuthConfiguration>>) => void;
  onConfigurationError?: () => void;
  hideRegistrationClosedError?: boolean;
  hideConfigurationError?: boolean;
}) {
  const node = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const [registrationClosed, setRegistrationClosed] = useState(false);
  const [configurationFailed, setConfigurationFailed] = useState(false);
  const callbacks = useRef({ onToken, onReady, onConfiguration, onConfigurationError });
  callbacks.current = { onToken, onReady, onConfiguration, onConfigurationError };
  useEffect(() => {
    let disposed = false;
    let widget: string | undefined;
    let configurationLoaded = false;
    callbacks.current.onReady(false);
    void getAuthConfiguration()
      .then(async (config) => {
        if (disposed) return;
        configurationLoaded = true;
        callbacks.current.onConfiguration?.(config);
        if (action === "signup" && !config.registrationEnabled) {
          setRegistrationClosed(true);
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
        if (!disposed) {
          setError("A biztonsági ellenőrzés nem érhető el. Frissítsd az oldalt.");
          if (!configurationLoaded) {
            setConfigurationFailed(true);
            callbacks.current.onConfigurationError?.();
          }
        }
      });
    return () => {
      disposed = true;
      if (widget && window.turnstile) window.turnstile.remove(widget);
    };
  }, [action]);
  return (
    <div>
      <div ref={node} />
      {error &&
        !(registrationClosed && hideRegistrationClosedError) &&
        !(configurationFailed && hideConfigurationError) && (
          <p role="alert" className="text-sm text-destructive">
            {error}{" "}
            {registrationClosed && (
              <Link to="/contact" className="font-medium underline underline-offset-2">
                {translate("auth.contactForHelp")}
              </Link>
            )}
          </p>
        )}
    </div>
  );
}
