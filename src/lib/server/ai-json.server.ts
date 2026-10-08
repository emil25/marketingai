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

/** Retry malformed/empty/invalid structured output once, never retry provider errors. */
export async function requestAiJson<T>(
  input: Parameters<typeof openRouterChat>[0],
  validate: ZodType<T>,
  send: typeof openRouterChat = openRouterChat,
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
      // Do not echo provider bodies: they can contain request details.
      if (response.status === 402)
        throw new Error(
          "Az AI-hozzáférés kreditkerete nem elegendő ehhez a kéréshez. A már elmentett tartalmaid megmaradnak.",
        );
      throw new Error(
        `Az AI-szolgáltatás nem tudta teljesíteni a kérést (${response.status}). Próbáld újra később.`,
      );
    }
    try {
      const json = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const raw = json.choices?.[0]?.message?.content;
      if (!raw?.trim()) throw new Error("empty");
      previous = raw.slice(0, 60000);
      return validate.parse(parseAiJson(raw));
    } catch (cause) {
      // Validation messages are our own rules, never the rejected provider output.
      repair =
        cause && typeof cause === "object" && "issues" in cause && Array.isArray(cause.issues)
          ? cause.issues
              .map((issue: { message: string }) => issue.message)
              .slice(0, 12)
              .join("; ")
          : "hibás vagy üres JSON";
      if (attempt === 1)
        throw new Error(
          `Az AI két próbálkozás után sem adott feldolgozható választ. Nem mentettünk hibás tartalmat; próbáld újra. ${repair}`,
        );
    }
  }
  throw new Error("Az AI-válasz feldolgozása nem sikerült.");
}
