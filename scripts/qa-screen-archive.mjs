import { copyFile, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";

const directory = path.resolve("docs/qa/screens");
const selected = new Set(
  ["simple", "detailed"].flatMap((mode) =>
    [390, 1280].flatMap((width) =>
      ["app", "posts", "weekly"].map((page) => `chromium-private-${mode}-${width}-${page}.png`),
    ),
  ),
);
const names = (await readdir(directory)).filter((name) => name.endsWith(".png")).sort();
if ([...selected].some((name) => !names.includes(name)))
  throw new Error("Hiányzó kijelölt QA-kép; az archívum nem készült el.");
await mkdir("outputs/qa/screens", { recursive: true });
const files = [];
for (const name of names) {
  const original = path.join(directory, name);
  const sha256 = createHash("sha256")
    .update(await readFile(original))
    .digest("hex");
  const tracked = selected.has(name);
  const archive = tracked
    ? null
    : `outputs/qa/screens/${name.slice(0, -4)}-${sha256.slice(0, 12)}.png`;
  if (archive) {
    try {
      await copyFile(original, archive, constants.COPYFILE_EXCL);
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
    }
    if (
      createHash("sha256")
        .update(await readFile(archive))
        .digest("hex") !== sha256
    )
      throw new Error("QA-archívum ellenőrzőösszeg eltérés; az eredeti fájl megmaradt.");
  }
  files.push({
    file: `docs/qa/screens/${name}`,
    disposition: tracked ? "selected" : "ignored-preserved",
    sha256,
    archive,
  });
}
await writeFile(
  "docs/qa/screenshot-manifest.json",
  JSON.stringify(
    { selected: selected.size, preserved: files.length - selected.size, files },
    null,
    2,
  ) + "\n",
);
// Git's allowlist is maintained explicitly in .gitignore, not rewritten here.
await writeFile(
  "docs/qa/SCREENSHOTS.md",
  `# Kijelölt QA-képek\n\n12 kép: Egyszerű/Részletes mód, 390/1280 px, Kezdőlap/Posztjaim/Heti terv.\nKitalált Példa-fiókok és elkülönített tesztprovider. A kijelölt képeken nincs valódi ügyféladat, meghívókód vagy auth hivatkozás.\n\n${[
    ...selected,
  ]
    .sort()
    .map((name) => `- [${name}](screens/${name})`)
    .join(
      "\n",
    )}\n\nA teljes listát és SHA256 összegeket a [screenshot-manifest.json](screenshot-manifest.json) tartalmazza.\nA többi eredeti fájl megmarad, Git ignorálja; ellenőrzött másolat az outputs/qa/screens mappában.\nÚj kép alapból ignorált. Kiadás előtt csak külön átnézett, szintetikus adatos kép vehető fel a listára.\n\nÚjraarchiválás: node scripts/qa-screen-archive.mjs. Nem töröl vagy módosít képfájlt.\n`,
);
console.log(
  JSON.stringify({
    selected: selected.size,
    preserved: files.length - selected.size,
    originalsDeleted: 0,
  }),
);
