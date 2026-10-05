import test from "node:test";
import assert from "node:assert/strict";
import { formatPostScheduleInput, parsePostScheduleInput } from "../src/lib/post-schedule.ts";

test("formats Bucharest winter and summer independently of browser timezone", () => {
  assert.equal(
    formatPostScheduleInput("2026-01-15T10:30:00.000Z", "Europe/Bucharest"),
    "2026-01-15T12:30",
  );
  assert.equal(
    formatPostScheduleInput("2026-07-15T10:30:00.000Z", "Europe/Bucharest"),
    "2026-07-15T13:30",
  );
});

test("round trips UTC and a non-UTC zone", () => {
  assert.equal(parsePostScheduleInput("2026-01-15T10:30", "UTC"), "2026-01-15T10:30:00.000Z");
  const instant = parsePostScheduleInput("2026-07-15T13:30", "Europe/Bucharest");
  assert.equal(instant, "2026-07-15T10:30:00.000Z");
  assert.equal(formatPostScheduleInput(instant, "Europe/Bucharest"), "2026-07-15T13:30");
});

test("preserves seconds and supports quarter-hour timezones", () => {
  const instant = parsePostScheduleInput("2026-05-12T18:07:45", "Asia/Kathmandu");
  assert.equal(instant, "2026-05-12T12:22:45.000Z");
  assert.equal(formatPostScheduleInput(instant, "Asia/Kathmandu"), "2026-05-12T18:07");
});

test("empty, malformed and impossible values are handled safely", () => {
  assert.equal(parsePostScheduleInput("", "UTC"), null);
  assert.equal(formatPostScheduleInput("invalid", "UTC"), "");
  assert.throws(() => parsePostScheduleInput("2026-02-30T10:00", "UTC"), /érvénytelen/);
  assert.throws(() => parsePostScheduleInput("2026-01-15 10:00", "UTC"), /formátuma/);
  assert.throws(() => parsePostScheduleInput("2026-01-15T10:00", "Not/AZone"), /time zone|zóna/i);
});

test("rejects a nonexistent DST spring-forward time and chooses earliest overlap", () => {
  assert.throws(
    () => parsePostScheduleInput("2026-03-29T03:30", "Europe/Bucharest"),
    /nem létezik/,
  );
  assert.equal(
    parsePostScheduleInput("2026-10-25T02:30", "Europe/Bucharest"),
    "2026-10-24T23:30:00.000Z",
  );
});
