import assert from "node:assert/strict";
import { test } from "node:test";
import { replaceAtomicFile } from "../src/lib/server/atomic-file.server";

test("temporary Windows file locks retry the same atomic replacement", async () => {
  const delays: number[] = [];
  let moves = 0;
  await replaceAtomicFile(
    "new.tmp",
    "existing.json",
    async (source, target) => {
      assert.equal(source, "new.tmp");
      assert.equal(target, "existing.json");
      if (++moves < 3) throw Object.assign(new Error("private path"), { code: "EPERM" });
    },
    async (ms) => {
      delays.push(ms);
    },
  );
  assert.equal(moves, 3);
  assert.deepEqual(delays, [20, 40]);
});

test("persistent locks stop after a bound and never leak filesystem paths", async () => {
  let moves = 0;
  await assert.rejects(
    replaceAtomicFile(
      "new.tmp",
      "existing.json",
      async () => {
        moves++;
        throw Object.assign(new Error("private path"), { code: "EACCES" });
      },
      async () => {},
    ),
    (error) =>
      error instanceof Error &&
      /korábbi adataid megmaradtak/.test(error.message) &&
      !error.message.includes("private path"),
  );
  assert.equal(moves, 8);
});
