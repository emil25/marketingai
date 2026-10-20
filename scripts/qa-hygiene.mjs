// Reports filenames/categories only. Never prints matching secrets or personal data.
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
async function files(directory) {
  return (
    await Promise.all(
      (await readdir(directory, { withFileTypes: true })).map(async (entry) => {
        const file = path.join(directory, entry.name);
        return entry.isDirectory() ? files(file) : [file];
      }),
    )
  ).flat();
}
const all = await files("docs/qa");
const findings = [];
const text = all.filter((f) => /\.(md|json|txt|html)$/i.test(f));
for (const file of text) {
  const content = await readFile(file, "utf8");
  const rules = [
    ["potential-email", /[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi],
    [
      "secret-value",
      /(?:access_token|client_secret|authorization|cookie|sessionToken)[\s"':=]+[\w./+=-]{16,}/gi,
    ],
    ["provider-key", /\b(?:sk-or-v1-|sk-proj-|re_)[A-Za-z0-9_-]{20,}/g],
    ["jwt", /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{15,}/g],
    [
      "token-url",
      /(?:[?&](?:token|code|state)=|\/(?:verify-email|reset-password)#)[a-z0-9_-]{24,}/gi,
    ],
  ];
  for (const [type, regex] of rules) {
    const matches = [...content.matchAll(regex)].filter(
      (m) => type !== "potential-email" || !/@example\.(invalid|com)$/i.test(m[0]),
    );
    if (matches.length) findings.push({ file, type, count: matches.length });
  }
}
const report = {
  textFiles: text.length,
  imageFiles: all.filter((f) => /\.png$/i.test(f)).length,
  findings,
  note: "Pattern scan only; screenshots require separate OCR and visual review. No files changed or deleted.",
};
await mkdir("outputs", { recursive: true });
await writeFile("outputs/qa-text-privacy.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
