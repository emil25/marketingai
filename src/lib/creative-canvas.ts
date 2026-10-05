import {
  CREATIVE_FORMATS,
  creativeColor,
  type CreativeDraft,
  type CreativeSlide,
} from "./post-creative";

export function wrapCreativeText(
  text: string,
  maxWidth: number,
  measure: (text: string) => number,
) {
  const lines: string[] = [];
  for (const paragraph of text.split(/\n/)) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      // Split long unbroken words as well as ordinary prose.
      const chunks: string[] = [];
      let chunk = "";
      for (const letter of Array.from(word)) {
        if (chunk && measure(chunk + letter) > maxWidth) {
          chunks.push(chunk);
          chunk = "";
        }
        chunk += letter;
      }
      if (chunk) chunks.push(chunk);
      for (const part of chunks) {
        const candidate = line ? `${line} ${part}` : part;
        if (line && measure(candidate) > maxWidth) {
          lines.push(line);
          line = part;
        } else line = candidate;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  width: number,
  height: number,
  maxSize: number,
  minSize: number,
  serif = false,
) {
  if (!text.trim()) return;
  for (let size = maxSize; size >= minSize; size -= 2) {
    ctx.font = `${serif ? "600" : "400"} ${size}px ${serif ? 'Georgia, "Times New Roman", serif' : "Arial, sans-serif"}`;
    const lines = wrapCreativeText(text, width, (value) => ctx.measureText(value).width);
    const lineHeight = size * 1.22;
    if (lines.length * lineHeight <= height) {
      ctx.textBaseline = "top";
      lines.forEach((line, index) => ctx.fillText(line, x, y + lineHeight * index));
      return;
    }
  }
  throw new Error(
    "A szöveg nem fér el olvashatóan ezen a lapon. Rövidítsd a címet vagy a leírást.",
  );
}

async function loadCreativeImage(id: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const timer = setTimeout(
      () => reject(new Error("A kiválasztott fotó nem töltődött be időben.")),
      15_000,
    );
    image.onload = () => {
      clearTimeout(timer);
      resolve(image);
    };
    image.onerror = () => {
      clearTimeout(timer);
      reject(new Error("A kiválasztott kép nem olvasható. Válassz másik fotót."));
    };
    image.src = `/api/media/${encodeURIComponent(id)}`;
  });
}

function cover(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const ratio = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const sourceWidth = width / ratio,
    sourceHeight = height / ratio;
  ctx.drawImage(
    image,
    (image.naturalWidth - sourceWidth) / 2,
    (image.naturalHeight - sourceHeight) / 2,
    sourceWidth,
    sourceHeight,
    x,
    y,
    width,
    height,
  );
}

export async function paintCreative(
  canvas: HTMLCanvasElement,
  draft: CreativeDraft,
  slide: CreativeSlide,
  brand: { name: string; colors: string[]; logoUrl?: string },
  index: number,
) {
  const format = CREATIVE_FORMATS[draft.format];
  const photo = slide.imageId ? await loadCreativeImage(slide.imageId) : null;
  // Logos are fetched only from the same authenticated media API, never arbitrary third-party URLs.
  const logoId = brand.logoUrl?.match(/^\/api\/media\/(media_[a-f0-9-]+)$/i)?.[1];
  const logo = logoId ? await loadCreativeImage(logoId) : null;
  canvas.width = format.width;
  canvas.height = format.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Ebben a böngészőben nem érhető el a képszerkesztő.");
  const w = format.width,
    h = format.height,
    margin = 78,
    accent = creativeColor(brand.colors);
  const overlay = draft.template === "overlay";
  ctx.fillStyle = overlay ? "#17382e" : "#faf6ed";
  ctx.fillRect(0, 0, w, h);
  if (photo) {
    if (overlay) cover(ctx, photo, 0, 0, w, h);
    else if (draft.template === "editorial") cover(ctx, photo, 0, h * 0.52, w, h * 0.48);
    else cover(ctx, photo, margin, h * 0.54, w - margin * 2, h * 0.32);
  } else {
    const gradient = ctx.createLinearGradient(0, h * 0.5, w, h);
    gradient.addColorStop(0, overlay ? "#17382e" : "#e5eee7");
    gradient.addColorStop(1, accent);
    ctx.fillStyle = gradient;
    ctx.fillRect(overlay ? 0 : margin, h * 0.54, overlay ? w : w - margin * 2, h * 0.32);
  }
  if (overlay) {
    const shade = ctx.createLinearGradient(0, 0, 0, h);
    shade.addColorStop(0, "rgba(5,18,14,.2)");
    shade.addColorStop(0.4, "rgba(5,18,14,.7)");
    shade.addColorStop(1, "rgba(5,18,14,.95)");
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.fillStyle = overlay ? "#ffffff" : "#16362e";
  drawText(ctx, brand.name, margin, 62, w - margin * 2 - 100, 52, 30, 20);
  ctx.fillStyle = accent;
  ctx.fillRect(margin, 137, 64, 5);
  const titleY = overlay ? h * 0.37 : h * 0.14;
  ctx.fillStyle = overlay ? "#ffffff" : "#16362e";
  drawText(
    ctx,
    slide.headline,
    margin,
    titleY,
    w - margin * 2,
    h * (overlay ? 0.21 : 0.155),
    78,
    36,
    true,
  );
  drawText(
    ctx,
    slide.body,
    margin,
    titleY + h * (overlay ? 0.225 : 0.17),
    w - margin * 2,
    h * (overlay ? 0.14 : 0.115),
    33,
    22,
  );
  if (slide.cta) {
    const ctaY = overlay ? h * 0.79 : h * 0.445;
    ctx.fillStyle = accent;
    ctx.fillRect(margin, ctaY, w - margin * 2, 76);
    // Compute a readable foreground for any user-selected brand color.
    const rgb = [1, 3, 5].map((start) => parseInt(accent.slice(start, start + 2), 16));
    ctx.fillStyle = rgb[0] * 0.299 + rgb[1] * 0.587 + rgb[2] * 0.114 > 155 ? "#10271f" : "#ffffff";
    drawText(ctx, slide.cta, margin + 25, ctaY + 21, w - margin * 2 - 50, 42, 28, 20);
  }
  if (draft.template !== "overlay") {
    ctx.fillStyle = "rgba(250,246,237,.94)";
    ctx.fillRect(0, h - 112, w, 112);
  }
  ctx.fillStyle = overlay ? "#ffffff" : "#16362e";
  const footerX = logo ? margin + 62 : margin;
  if (logo) ctx.drawImage(logo, margin, h - 80, 44, 44);
  drawText(ctx, brand.name, footerX, h - 72, w - footerX - 180, 42, 28, 18);
  drawText(ctx, `${index + 1} / ${draft.slides.length}`, w - 140, h - 72, 90, 42, 26, 20);
}

export async function renderCreativeBlobs(
  draft: CreativeDraft,
  brand: { name: string; colors: string[]; logoUrl?: string },
) {
  const blobs: Blob[] = [];
  for (const [index, slide] of draft.slides.entries()) {
    const canvas = document.createElement("canvas");
    await paintCreative(canvas, draft, slide, brand, index);
    blobs.push(
      await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error("A JPEG export sikertelen."))),
          "image/jpeg",
          0.92,
        ),
      ),
    );
  }
  return blobs;
}

export function downloadCreativeBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob),
    anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
