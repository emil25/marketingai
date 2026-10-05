import { spawn } from "node:child_process";
import { access, copyFile, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { mediaDirectory, mediaPathForId } from "@/lib/server/store.server";
import { VIDEO_FORMATS, wrapVideoCaption, type VideoFormat, type VideoScene } from "@/lib/video";

let rendering = false;

export async function videoRenderConfiguration() {
  const require = createRequire(path.join(process.cwd(), "package.json"));
  const binary = process.env.FFMPEG_PATH?.trim() || (require("ffmpeg-static") as string | null);
  const fonts = [
    process.env.VIDEO_FONT_PATH,
    "C:/Windows/Fonts/arial.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf",
  ].filter((item): item is string => Boolean(item));
  let font: string | undefined;
  for (const candidate of fonts) {
    try {
      await access(candidate);
      font = candidate;
      break;
    } catch {
      /* Try the next installed font. */
    }
  }
  if (!binary || !font)
    throw new Error(
      "A videófeldolgozó ezen a szerveren még nem elérhető. Node szerver, FFmpeg és betűkészlet szükséges.",
    );
  try {
    await access(binary);
  } catch {
    throw new Error("A videófeldolgozó nem található ezen a szerveren.");
  }
  return { binary, font };
}

function run(binary: string, args: string[], cwd: string, deadline: number) {
  return new Promise<void>((resolve, reject) => {
    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      reject(new Error("A videókészítés túllépte a kétperces időkorlátot."));
      return;
    }
    const child = spawn(
      binary,
      ["-hide_banner", "-loglevel", "error", "-nostdin", "-y", "-max_alloc", "67108864", ...args],
      {
        cwd,
        shell: false,
        windowsHide: true,
        stdio: "ignore",
        env: {
          PATH: process.env.PATH,
          SystemRoot: process.env.SystemRoot,
          TEMP: process.env.TEMP,
          TMP: process.env.TMP,
        },
      },
    );
    const timer = setTimeout(() => child.kill(), remaining);
    child.once("error", () => {
      clearTimeout(timer);
      reject(new Error("Nem sikerült elindítani a videófeldolgozót."));
    });
    child.once("close", (code) => {
      clearTimeout(timer);
      if (Date.now() >= deadline)
        reject(new Error("A videókészítés túllépte a kétperces időkorlátot."));
      else if (code !== 0)
        reject(
          new Error(
            "A videó nem készíthető el. Ellenőrizd, hogy a kiválasztott képek megnyithatók-e.",
          ),
        );
      else resolve();
    });
  });
}

/** One bounded render per Node process. No shell commands or remote media inputs. */
export async function renderPhotoVideo(input: {
  scenes: VideoScene[];
  format: VideoFormat;
  brandName: string;
  color?: string;
}) {
  if (rendering) throw new Error("Már készül egy videó. Próbáld újra, ha elkészült.");
  rendering = true;
  let directory: string | undefined;
  try {
    const { binary, font } = await videoRenderConfiguration();
    await mkdir(mediaDirectory, { recursive: true });
    directory = await mkdtemp(path.join(mediaDirectory, "video-job-"));
    await copyFile(font, path.join(directory, "font.ttf"));
    await writeFile(
      path.join(directory, "brand.txt"),
      wrapVideoCaption(input.brandName.slice(0, 70), 36),
      "utf8",
    );
    const { width, height } = VIDEO_FORMATS[input.format];
    const color = /^#[a-f\d]{6}$/i.test(input.color ?? "")
      ? input.color!.replace("#", "0x")
      : "0xF7664B";
    const deadline = Date.now() + 120_000;
    for (const [index, scene] of input.scenes.entries()) {
      const sourcePath = mediaPathForId(scene.mediaAssetId);
      if ((await stat(sourcePath)).size > 10 * 1024 * 1024)
        throw new Error("A kiválasztott kép túl nagy.");
      const source = await readFile(sourcePath);
      const header = source.subarray(0, 12);
      const png = header.subarray(0, 8).toString("hex") === "89504e470d0a1a0a";
      const jpeg = header.subarray(0, 3).toString("hex") === "ffd8ff";
      const webp =
        header.subarray(0, 4).toString() === "RIFF" && header.subarray(8, 12).toString() === "WEBP";
      if (!png && !jpeg && !webp)
        throw new Error("A kiválasztott fájl nem érvényes JPG, PNG vagy WebP kép.");
      await writeFile(path.join(directory, `image-${index}`), source);
      const caption = wrapVideoCaption(scene.caption, input.format === "portrait" ? 28 : 30);
      await writeFile(path.join(directory, `caption-${index}.txt`), caption, "utf8");
      const lines = caption.split("\n").length;
      const fontSize = Math.min(38, Math.floor((height * 0.27 - (lines - 1) * 8) / lines));
      const filter = [
        `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},setsar=1`,
        `drawbox=x=0:y=0:w=iw:h=115:color=black@0.45:t=fill`,
        `drawtext=fontfile=font.ttf:textfile=brand.txt:expansion=none:fontcolor=white:fontsize=28:x=36:y=30`,
        `drawbox=x=0:y=${Math.round(height * 0.65)}:w=iw:h=${Math.ceil(height * 0.35)}:color=black@0.65:t=fill`,
        `drawbox=x=36:y=${Math.round(height * 0.68)}:w=72:h=6:color=${color}:t=fill`,
        `drawtext=fontfile=font.ttf:textfile=caption-${index}.txt:expansion=none:fontcolor=white:fontsize=${fontSize}:line_spacing=8:x=36:y=${Math.round(height * 0.71)}`,
        "fade=t=in:st=0:d=0.25",
      ].join(",");
      await run(
        binary,
        [
          "-filter_threads",
          "1",
          "-protocol_whitelist",
          "file,pipe",
          "-loop",
          "1",
          "-framerate",
          "25",
          "-i",
          `image-${index}`,
          "-t",
          String(scene.duration),
          "-vf",
          filter,
          "-an",
          "-c:v",
          "libx264",
          "-preset",
          "veryfast",
          "-crf",
          "28",
          "-threads",
          "2",
          "-pix_fmt",
          "yuv420p",
          `scene-${index}.mp4`,
        ],
        directory,
        deadline,
      );
    }
    await writeFile(
      path.join(directory, "list.txt"),
      input.scenes.map((_, index) => `file 'scene-${index}.mp4'`).join("\n"),
      "utf8",
    );
    await run(
      binary,
      [
        "-f",
        "concat",
        "-safe",
        "1",
        "-i",
        "list.txt",
        "-c",
        "copy",
        "-movflags",
        "+faststart",
        "output.mp4",
      ],
      directory,
      deadline,
    );
    const file = path.join(directory, "output.mp4");
    const size = (await stat(file)).size;
    if (!size || size > 20 * 1024 * 1024)
      throw new Error("A videó mérete túl nagy. Válassz kevesebb képet vagy rövidebb jeleneteket.");
    return { bytes: await readFile(file), width, height, size };
  } finally {
    try {
      if (directory) {
        const resolved = path.resolve(directory);
        if (
          path.dirname(resolved) === path.resolve(mediaDirectory) &&
          path.basename(resolved).startsWith("video-job-")
        ) {
          await rm(resolved, { recursive: true, force: true }).catch(() => undefined);
        }
      }
    } finally {
      rendering = false;
    }
  }
}
