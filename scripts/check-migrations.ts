import { readdir } from "node:fs/promises";
import path from "node:path";

/** Returns a diagnostic for malformed, duplicate, or missing migration numbers. */
export function migrationSequenceIssues(fileNames: string[]) {
  const issues: string[] = [];
  const versions: number[] = [];

  for (const fileName of fileNames) {
    const match = /^(\d{3})_[a-z0-9][a-z0-9_-]*\.sql$/u.exec(fileName);
    if (!match) {
      issues.push(`Nem megfelelő migrációfájlnév: ${fileName}`);
      continue;
    }
    versions.push(Number(match[1]));
  }

  const seen = new Set<number>();
  for (const version of versions) {
    if (seen.has(version))
      issues.push(`Duplikált migrációs sorszám: ${String(version).padStart(3, "0")}`);
    seen.add(version);
  }

  const sorted = [...seen].sort((a, b) => a - b);
  const highest = sorted.at(-1) ?? 0;
  for (let version = 1; version <= highest; version++) {
    if (!seen.has(version)) issues.push(`Hiányzó migráció: ${String(version).padStart(3, "0")}`);
  }
  if (sorted.length && sorted[0] !== 1)
    issues.push("A migrációs sorozatnak 001-gyel kell kezdődnie.");

  return issues;
}

export async function checkMigrationDirectory(directory = path.resolve("db/migrations")) {
  const entries = await readdir(directory, { withFileTypes: true });
  return migrationSequenceIssues(
    entries.filter((entry) => entry.isFile()).map((entry) => entry.name),
  );
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve("scripts/check-migrations.ts")
) {
  const issues = await checkMigrationDirectory();
  if (issues.length) {
    console.error("Migrációellenőrzés sikertelen:");
    for (const issue of issues) console.error(`- ${issue}`);
    process.exitCode = 1;
  } else {
    console.log("Migrációellenőrzés sikeres: a sorszámok hézagmentesek és egyediek.");
  }
}
