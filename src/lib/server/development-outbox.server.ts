import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { developmentEmailAllowed } from "./beta-access.server";

/** Private local test artifact, never an HTTP endpoint or console log. Contains temporary tokens. */
export async function writeDevelopmentEmail(message: {
  to: string;
  subject: string;
  text: string;
}) {
  if (!developmentEmailAllowed()) throw new Error("Az e-mail-küldés nincs bekapcsolva.");
  const directory = process.env.MARKETINGPILOT_DATA_DIR
    ? path.join(process.env.MARKETINGPILOT_DATA_DIR, "development-outbox")
    : path.resolve("outputs/development-outbox");
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await appendFile(
    path.join(directory, "messages.jsonl"),
    `${JSON.stringify({ ...message, createdAt: new Date().toISOString(), developmentOnly: true })}\n`,
    { mode: 0o600 },
  );
}
