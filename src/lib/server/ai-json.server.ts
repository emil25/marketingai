import { AiProviderUnavailableError, aiProviderMessage } from "../ai-call-policy";
import { annotateAiResponse, rejectAiResponse } from "./ai-calls.server";
import type { ZodType } from "zod";
import { openRouterChat } from "./ai-provider.server";

export function parseAiJson(raw: string): unknown {
  return JSON.parse(
    raw
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, ""),
  );
}

export function validationFailure(cause: unknown) {
  if (cause instanceof SyntaxError) return { category: "SCHEMA_INVALID_JSON", repair: "A JSON szintaxisa hibás. Add vissza újra érvényes JSON-ként." };
  const issues =
    cause && typeof cause === "object" && "issues" in cause && Array.isArray(cause.issues)
      ? (cause.issues as Array<{ code?: string; message?: string; received?: unknown; params?: unknown }>)
      : [];
  const ruleCategory = issues
    .map((issue) =>
      issue.params && typeof issue.params === "object" && "category" in issue.params
        ? String((issue.params as { category: unknown }).category)
        : "",
    )
    .find((category) => /^(?:HARD_CLAIM_[A-Z_]+|CONTENT_[A-Z_]+|SCHEMA_[A-Z_]+)$/.test(category));
  const missing = issues.some((issue) => issue.code === "invalid_type" && issue.received === "undefined");
  const category = ruleCategory ?? (missing ? "SCHEMA_MISSING_FIELD" : "SCHEMA_INVALID_VALUE");
  return {
    category,
    repair: issues.length
      ? issues
          .map((issue) => issue.message ?? "").filter(Boolean).slice(0, 12).join("; ").slice(0, 2400)
      : "Üres vagy hibás JSON-válasz. Add vissza újra a teljes, érvényes JSON-t.",
  };
}

/** Retry malformed/empty/invalid structured output once, never retry provider errors. */
export async function requestAiJson<T>(
  input: Parameters<typeof openRouterChat>[0],
  validate: ZodType<T>,
  send: typeof openRouterChat = openRouterChat,
  onAccepted?: (value: T, response: Response) => void | Promise<void>,
): Promise<T> {
  let repair = "";
  let previous = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await send({
      ...input,
      messages:
        attempt === 0
          ? input.messages
          : [
              ...input.messages,
              ...(previous ? [{ role: "assistant" as const, content: previous }] : []),
              {
                role: "user",
                content: `Az előző válasz nem felelt meg a megadott szabályoknak. Add vissza újra a teljes, érvényes JSON-t, magyarázat és kódblokk nélkül. Javítsd ezeket: ${repair || "üres vagy hibás JSON"}`,
              },
            ],
    });
    if (!response.ok) {
      throw new AiProviderUnavailableError(
        aiProviderMessage(response.status),
        response.status,
      );
    }
    try {
      const json = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const raw = json.choices?.[0]?.message?.content;
      if (!raw?.trim()) throw new SyntaxError("empty JSON");
      previous = raw.slice(0, 60000);
      const value = validate.parse(parseAiJson(raw));
      try {
        await onAccepted?.(value, response);
      } catch {
        // Optional category annotation must never turn an otherwise valid answer into a failure.
      }
      return value;
    } catch (cause) {
      const failure = validationFailure(cause);
      await rejectAiResponse(response, failure.category);
      // Validation messages are our own rules, never the rejected provider output.
      repair = failure.repair;
      if (attempt === 1)
        throw new Error(
          "Az AI egy javítás után sem adott ellenőrzésen megfelelő választ. A piszkozatot nem mentettük; próbáld újra.",
        );
    }
  }
  throw new Error("Az AI-válasz feldolgozása nem sikerült.");
}

