import { createParser } from "eventsource-parser";
import { flushSync } from "react-dom";

type ImageEventPayload =
  | { type: "image_generation.partial_image"; b64_json: string; partial_image_index: number }
  | { type: "image_generation.completed"; b64_json: string }
  | { type: "error"; error: { message: string } };

export async function streamImage(
  prompt: string,
  onFrame: (dataUrl: string, isFinal: boolean) => void,
  options?: { brandId?: string; format?: string },
): Promise<void> {
  const res = await fetch("/api/generate-image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, brandId: options?.brandId, format: options?.format }),
  });
  if (!res.ok || !res.body) {
    throw new Error(`Képgenerálás sikertelen: ${res.status} ${await res.text().catch(() => "")}`);
  }

  let sawCompleted = false;
  let sawAnyEvent = false;
  let streamError: string | undefined;

  const parser = createParser({
    onEvent(event) {
      let payload: ImageEventPayload | undefined;
      try {
        payload = JSON.parse(event.data) as ImageEventPayload;
      } catch {
        /* ignore */
      }
      if (event.event === "error" || payload?.type === "error") {
        sawAnyEvent = true;
        streamError =
          (payload as { error?: { message?: string } })?.error?.message ?? "Képgenerálás sikertelen";
        return;
      }
      if (
        event.event !== "image_generation.partial_image" &&
        event.event !== "image_generation.completed"
      )
        return;
      if (!payload) return;
      sawAnyEvent = true;
      const isFinal = event.event === "image_generation.completed";
      flushSync(() => {
        onFrame(`data:image/png;base64,${(payload as { b64_json: string }).b64_json}`, isFinal);
      });
      if (isFinal) sawCompleted = true;
    },
  });

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      parser.feed(value);
    }
  } finally {
    reader.cancel().catch(() => {});
  }

  if (streamError) throw new Error(streamError);

  if (!sawAnyEvent) {
    const replay = await fetch("/api/generate-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, stream: false, brandId: options?.brandId, format: options?.format }),
    });
    if (!replay.ok) {
      throw new Error(`Képgenerálás sikertelen: ${replay.status}`);
    }
    const json = (await replay.json()) as { data?: { b64_json?: string }[] };
    const b64 = json.data?.[0]?.b64_json;
    if (!b64) throw new Error("A modell nem adott vissza képet");
    onFrame(`data:image/png;base64,${b64}`, true);
    return;
  }
  if (!sawCompleted) throw new Error("A képgenerálás megszakadt");
}

export function brandImagePrompt(opts: {
  topic: string;
  brand: string;
  industry: string;
  businessType?: string;
  tone: string;
  colors: string[];
  format?: string;
}) {
  const { topic, brand, industry, businessType, tone, colors, format } = opts;
  return [
    `Professzionális marketing vizuál a következő témához: "${topic}".`,
    `Márka: ${brand} (${industry}${businessType ? `, vállalkozástípus: ${businessType}` : ""}). Hangnem: ${tone}.`,
    `Márkaszínek, amelyek dominálják a képet: ${colors.join(", ")}.`,
    format ? `Formátum/felhasználás: ${format}.` : "",
    "Prémium, modern, letisztult social media stílus, természetes fény, éles részletek, szöveg nélkül.",
  ]
    .filter(Boolean)
    .join(" ");
}
