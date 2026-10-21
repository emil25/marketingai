import { requireBrandContext } from "./auth-context.server";
import { reserveAiCall, finishAiCall, associateAiResponse } from "./ai-calls.server";
import { AiProviderUnavailableError, aiProviderMessage } from "../ai-call-policy";
import { previewAiAllowed, previewAiResponse } from "./preview-ai.server";
/**
 * The single server-side AI integration for MarketingPilot.
 *
 * Keep provider credentials in the server environment only.  Callers receive
 * the provider response so their existing parsing, validation and AI-job
 * lifecycle remain unchanged.
 */

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const GEMINI_OPENAI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai";
const GROQ_OPENAI_BASE_URL = "https://api.groq.com/openai/v1";
const TEXT_REQUEST_TIMEOUT_MS = 120_000;
const IMAGE_REQUEST_TIMEOUT_MS = 180_000;
const RETRYABLE_PROVIDER_STATUSES = new Set([500, 502, 503, 504]);
const GROQ_FALLBACK_TEXT_MODEL = "openai/gpt-oss-120b";

/** Retry one transient upstream failure without retrying quota or authorization errors. */
export async function retryTransientProviderResponse(
  send: () => Promise<Response>,
  wait: () => Promise<void> = () => new Promise((resolve) => setTimeout(resolve, 400)),
) {
  const first = await send();
  if (!RETRYABLE_PROVIDER_STATUSES.has(first.status)) return first;
  await wait();
  return send();
}

/** Keep generation available during model-specific Groq overloads without changing providers. */
export async function requestGroqWithModelFallback(
  sendPrimary: () => Promise<Response>,
  sendFallback: () => Promise<Response>,
  wait?: () => Promise<void>,
) {
  const primary = await retryTransientProviderResponse(sendPrimary, wait);
  if (primary.status !== 503) return primary;
  return sendFallback();
}

export type TextAiProvider = "openrouter" | "gemini" | "groq";

export const OPENROUTER_TEXT_MODEL =
  process.env["OPENROUTER_TEXT_MODEL"]?.trim() || "openai/gpt-4.1-mini";
export const OPENROUTER_IMAGE_MODEL =
  process.env["OPENROUTER_IMAGE_MODEL"]?.trim() || "openai/gpt-image-2.5-sunburst";
export const GEMINI_TEXT_MODEL =
  process.env["GEMINI_TEXT_MODEL"]?.trim() || "gemini-3.1-flash-lite";
export const GROQ_TEXT_MODEL = process.env["GROQ_TEXT_MODEL"]?.trim() || "openai/gpt-oss-20b";

export function configuredTextAiProvider(): TextAiProvider {
  const configured = process.env["AI_TEXT_PROVIDER"]?.trim().toLowerCase();
  if (!configured || configured === "openrouter") return "openrouter";
  if (configured === "gemini") return "gemini";
  if (configured === "groq") return "groq";
  throw new Error("Az AI_TEXT_PROVIDER értéke csak openrouter, gemini vagy groq lehet.");
}

/** Safe operator diagnostics; never returns or logs the credential value. */
export function textAiProviderStatus() {
  const configured = process.env["AI_TEXT_PROVIDER"]?.trim().toLowerCase() || "openrouter";
  const provider = ["openrouter", "gemini", "groq"].includes(configured)
    ? (configured as TextAiProvider)
    : null;
  const keyName =
    provider === "groq"
      ? "GROQ_API_KEY"
      : provider === "gemini"
        ? "GEMINI_API_KEY"
        : provider === "openrouter"
          ? "OPENROUTER_API_KEY"
          : null;
  return { provider, keyConfigured: keyName ? Boolean(process.env[keyName]?.trim()) : false };
}

type ChatMessage = {
  role: "system" | "user" | "assistant" | "developer";
  content: string;
};

type JsonSchema = Record<string, unknown>;

function requireOpenRouterKey() {
  const key = process.env["OPENROUTER_API_KEY"]?.trim();
  if (!key) throw new AiProviderUnavailableError(aiProviderMessage(503));
  return key;
}

function requireProviderKey(provider: TextAiProvider) {
  if (provider === "openrouter") return requireOpenRouterKey();
  if (provider === "groq") {
    const key = process.env["GROQ_API_KEY"]?.trim();
    if (!key) throw new AiProviderUnavailableError(aiProviderMessage(503));
    return key;
  }
  const key = process.env["GEMINI_API_KEY"]?.trim();
  if (!key) throw new AiProviderUnavailableError(aiProviderMessage(503));
  return key;
}

export function assertOpenRouterConfigured() {
  requireOpenRouterKey();
}

async function request(
  url: string,
  body: Record<string, unknown>,
  timeoutMs: number,
  endpoint: string,
  brandId?: string,
  provider: TextAiProvider = "openrouter",
) {
  const sessionContext = await requireBrandContext();
  const brand = brandId
    ? sessionContext.brands.find(
        (item) => item.id === brandId && item.workspaceId === sessionContext.workspace.id,
      )
    : sessionContext.activeBrand;
  if (!brand) throw new Error("Nincs hozzáférés ehhez a márkához.");
  const context = { ...sessionContext, activeBrand: brand };
  const previewFixture = endpoint === "factual_post_variants" && previewAiAllowed(context.user, brand);
  const key = previewFixture ? undefined : requireProviderKey(provider);
  const callId = await reserveAiCall(context, endpoint, String(body.model));
  const started = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const send = (requestBody: Record<string, unknown>) =>
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
    const response = previewFixture
      ? previewAiResponse(body)
      : provider === "groq" && body.model === GROQ_TEXT_MODEL
        ? await requestGroqWithModelFallback(
            () => send(body),
            () => send({ ...body, model: GROQ_FALLBACK_TEXT_MODEL }),
          )
        : await retryTransientProviderResponse(() => send(body));
    // Retain no provider body in logs or client-facing errors.
    const json = response.headers.get("content-type")?.includes("application/json")
      ? await response
          .clone()
          .json()
          .catch(() => null)
      : null;
    await finishAiCall(callId, {
      status: response.ok ? "success" : "error",
      provider,
      httpStatus: response.status,
      errorCode: response.ok ? undefined : `HTTP_${response.status}`,
      latencyMs: Date.now() - started,
      usage: json?.usage,
      model: typeof json?.model === "string" ? json.model.slice(0, 200) : undefined,
    });
    const safeResponse = response.ok
      ? response
      : Response.json(
          { error: { message: aiProviderMessage(response.status) } },
          { status: response.status },
        );
    associateAiResponse(safeResponse, callId);
    return safeResponse;
  } catch (cause) {
    const code =
      cause instanceof Error && cause.name === "AbortError" ? "TIMEOUT" : "NETWORK_OR_AUDIT_ERROR";
    await finishAiCall(callId, {
      status: "error",
      provider,
      latencyMs: Date.now() - started,
      errorCode: code,
    });
    throw new AiProviderUnavailableError(
      code === "TIMEOUT"
        ? "A generálás túl sokáig tartott. Az ötletedet piszkozatként elmentjük."
        : aiProviderMessage(503),
      code === "TIMEOUT" ? undefined : 503,
    );
  } finally {
    clearTimeout(timeout);
  }
}

type ChatInput = {
  /** Owned brand chosen by the server business function, never a provider parameter. */
  brandId?: string;
  messages: ChatMessage[];
  schemaName: string;
  schema: JsonSchema;
  maxTokens?: number;
  model?: string;
  /** A shared deadline for a sequence of weekly calls; never sent to the provider. */
  deadlineAt?: number;
};

/** Server-owned request contract; route validators never accept these controls. */
export function chatRequestBody(
  input: ChatInput,
  provider: TextAiProvider = configuredTextAiProvider(),
) {
  return {
    model:
      input.model ??
      (provider === "gemini"
        ? GEMINI_TEXT_MODEL
        : provider === "groq"
          ? GROQ_TEXT_MODEL
          : OPENROUTER_TEXT_MODEL),
    messages: input.messages,
    max_tokens: Math.max(1, Math.min(16_000, input.maxTokens ?? 16_000)),
    ...(provider === "openrouter" ? { usage: { include: true } } : {}),
    response_format: {
      type: "json_schema",
      json_schema: { name: input.schemaName, strict: true, schema: input.schema },
    },
  };
}

export function textCompletionUrl(provider: TextAiProvider) {
  const baseUrl =
    provider === "gemini"
      ? GEMINI_OPENAI_BASE_URL
      : provider === "groq"
        ? GROQ_OPENAI_BASE_URL
        : OPENROUTER_BASE_URL;
  return `${baseUrl}/chat/completions`;
}

export function openRouterChat(input: ChatInput) {
  const remaining =
    input.deadlineAt === undefined ? TEXT_REQUEST_TIMEOUT_MS : input.deadlineAt - Date.now();
  if (remaining < 1000)
    throw new Error("Az AI-tervezés elérte az időkorlátot. A már elmentett hetek megmaradnak.");
  const provider = configuredTextAiProvider();
  return request(
    textCompletionUrl(provider),
    chatRequestBody(input, provider),
    Math.min(TEXT_REQUEST_TIMEOUT_MS, remaining),
    input.schemaName,
    input.brandId,
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
    "image_generation",
  );
}

