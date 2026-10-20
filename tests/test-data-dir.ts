import { mkdir, mkdtemp, rm } from "node:fs/promises";
import path from "node:path";

const testDataRoot = path.resolve(process.cwd(), "outputs", "test-data");

export async function createTestDataDir(prefix: string) {
  const safePrefix = prefix.toLocaleLowerCase("en").replace(/[^a-z0-9-]/g, "-");
  await mkdir(testDataRoot, { recursive: true });
  return mkdtemp(path.join(testDataRoot, `${safePrefix}-${process.pid}-`));
}

export function isTestDataDir(directory: string) {
  const relative = path.relative(testDataRoot, path.resolve(directory));
  return relative !== "" && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

export async function removeTestDataDir(directory: string) {
  if (!isTestDataDir(directory)) throw new Error("A teszt csak saját ideiglenes adatmappát törölhet.");
  await rm(path.resolve(directory), { recursive: true, force: true });
}
