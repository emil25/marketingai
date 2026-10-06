/**
 * The single server-side AI integration for MarketingPilot.
 *
 * Keep provider credentials in the server environment only.  Callers receive
 * the provider response so their existing parsing, validation and AI-job
 * lifecycle remain unchanged.
 */

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const TEXT_REQUEST_TIMEOUT_MS = 120_000;
const IMAGE_REQUEST_TIMEOUT_MS = 180_000;

// Both model names can be overridden in the server environment without
// changing application code.  The defaults support structured JSON output
// and image generation through OpenRouter.
export const OPENROUTER_TEXT_MODEL =
  process.env["OPENROUTER_TEXT_MODEL"]?.trim() || "openai/gpt-4.1-mini";
export const OPENROUTER_IMAGE_MODEL =
  process.env["OPENROUTER_IMAGE_MODEL"]?.trim() || "openai/gpt-image-2.5-sunburst";

type ChatMessage = {
  role: "system" | "user" | "assistant" | "developer";
  content: string;
};

type JsonSchema = Record<string, unknown>;

function requireOpenRouterKey() {
  const key = process.env["OPENROUTER_API_KEY"]?.trim();
  if (!key) throw new Error("Hiányzik az OPENROUTER_API_KEY konfigurációja.");
  return key;
}

export function assertOpenRouterConfigured() {
  requireOpenRouterKey();
}

async function request(url: string, body: Record<string, unknown>, timeoutMs: number) {
  const key = requireOpenRouterKey();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (cause) {
    if (cause instanceof Error && cause.name === "AbortError") {
      throw new Error("OpenRouter időtúllépés: az AI szolgáltatás nem válaszolt időben.");
    }
    const message = cause instanceof Error ? cause.message : "AI szolgáltatás nem érhető el.";
    throw new Error(`OpenRouter hálózati hiba: ${message}`);
  } finally {
    clearTimeout(timeout);
  }
}

export function openRouterChat(input: {
  messages: ChatMessage[];
  schemaName: string;
  schema: JsonSchema;
  maxTokens?: number;
  model?: string;
}) {
  return request(
    `${OPENROUTER_BASE_URL}/chat/completions`,
    {
      model: input.model ?? OPENROUTER_TEXT_MODEL,
      messages: input.messages,
      // Keep the provider's token budget below low-credit account limits while
      // leaving enough room for structured post and campaign responses.
      max_tokens: input.maxTokens ?? 16_000,
      response_format: {
        type: "json_schema",
        json_schema: { name: input.schemaName, strict: true, schema: input.schema },
      },
    },
    TEXT_REQUEST_TIMEOUT_MS,
  );
}

export function openRouterImage(input: { prompt: string; stream: boolean }) {
  return request(
    `${OPENROUTER_BASE_URL}/images`,
    {
      model: OPENROUTER_IMAGE_MODEL,
      prompt: input.prompt,
      ...(input.stream ? { stream: true } : {}),
    },
    IMAGE_REQUEST_TIMEOUT_MS,
  );
}
