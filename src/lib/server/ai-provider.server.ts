/**
 * The single server-side AI integration for MarketingPilot.
 *
 * Keep provider credentials in the server environment only.  Callers receive
 * the provider response so their existing parsing, validation and AI-job
 * lifecycle remain unchanged.
 */

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const GEMINI_OPENAI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai";
const TEXT_REQUEST_TIMEOUT_MS = 120_000;
const IMAGE_REQUEST_TIMEOUT_MS = 180_000;

export type TextAiProvider = "openrouter" | "gemini";

// Both model names can be overridden in the server environment without
// changing application code.  The defaults support structured JSON output
// and image generation through OpenRouter.
export const OPENROUTER_TEXT_MODEL =
  process.env["OPENROUTER_TEXT_MODEL"]?.trim() || "openai/gpt-4.1-mini";
export const OPENROUTER_IMAGE_MODEL =
  process.env["OPENROUTER_IMAGE_MODEL"]?.trim() || "openai/gpt-image-2.5-sunburst";
export const GEMINI_TEXT_MODEL =
  process.env["GEMINI_TEXT_MODEL"]?.trim() || "gemini-3.1-flash-lite";

export function configuredTextAiProvider(): TextAiProvider {
  const configured = process.env["AI_TEXT_PROVIDER"]?.trim().toLowerCase();
  if (!configured || configured === "openrouter") return "openrouter";
  if (configured === "gemini") return "gemini";
  throw new Error("Az AI_TEXT_PROVIDER értéke csak openrouter vagy gemini lehet.");
}

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

function requireTextProviderKey(provider: TextAiProvider) {
  if (provider === "openrouter") return requireOpenRouterKey();
  const key = process.env["GEMINI_API_KEY"]?.trim();
  if (!key) throw new Error("Hiányzik a GEMINI_API_KEY konfigurációja.");
  return key;
}

export function assertOpenRouterConfigured() {
  requireOpenRouterKey();
}

async function request(
  url: string,
  body: Record<string, unknown>,
  timeoutMs: number,
  provider: TextAiProvider = "openrouter",
) {
  const key = requireTextProviderKey(provider);
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
  /** A shared deadline for a sequence of weekly calls; never sent to the provider. */
  deadlineAt?: number;
}) {
  const remaining =
    input.deadlineAt === undefined ? TEXT_REQUEST_TIMEOUT_MS : input.deadlineAt - Date.now();
  if (remaining < 1000)
    throw new Error("Az AI-tervezés elérte az időkorlátot. A már elmentett hetek megmaradnak.");
  const provider = configuredTextAiProvider();
  const baseUrl = provider === "gemini" ? GEMINI_OPENAI_BASE_URL : OPENROUTER_BASE_URL;
  return request(
    `${baseUrl}/chat/completions`,
    {
      model: input.model ?? (provider === "gemini" ? GEMINI_TEXT_MODEL : OPENROUTER_TEXT_MODEL),
      messages: input.messages,
      // Keep the provider's token budget below low-credit account limits while
      // leaving enough room for structured post and campaign responses.
      max_tokens: Math.max(1, Math.min(16_000, input.maxTokens ?? 16_000)),
      ...(provider === "openrouter" ? { usage: { include: true } } : {}),
      response_format: {
        type: "json_schema",
        json_schema: { name: input.schemaName, strict: true, schema: input.schema },
      },
    },
    Math.min(TEXT_REQUEST_TIMEOUT_MS, remaining),
    provider,
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
