import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { demoFixture } from "./demo-fixture";
import { isProductionEnvironment } from "../src/lib/server/production-config.server";

// Deliberately no env-file loading or database adapter import: cannot write a real database.
if (isProductionEnvironment() || process.env.VERCEL)
  throw new Error("Demóadat éles vagy Vercel környezetben nem készíthető.");
const directory = path.resolve("outputs/demo-data");
await mkdir(directory, { recursive: true, mode: 0o700 });
const target = path.join(directory, "marketingpilot.json");
try {
  await readFile(target);
  console.log("A külön demótároló már létezik. Nem írtunk felül semmit.");
} catch (cause) {
  if ((cause as NodeJS.ErrnoException).code !== "ENOENT") throw cause;
  const fixture = demoFixture(true);
  // Exclusive create refuses races and never replaces existing records.
  await writeFile(
    path.join(directory, "private-access.json"),
    JSON.stringify(fixture.credentials),
    { flag: "wx", mode: 0o600 },
  );
  await writeFile(target, JSON.stringify(fixture.db, null, 2), { flag: "wx", mode: 0o600 });
  console.log(
    "Példa Pékség elkészült az outputs/demo-data külön fejlesztői tárolóban. A rendes adatbázist nem érintettük. Előnézet: npm run dev:demo",
  );
}
