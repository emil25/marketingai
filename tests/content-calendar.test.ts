import test from "node:test";
import assert from "node:assert/strict";
import {
  addCalendarDays,
  calendarDateKey,
  calendarHoursForDay,
  calendarItemHour,
  groupCalendarItems,
  parseCalendarDateKey,
  sortCalendarItems,
  startOfCalendarWeek,
  unscheduledCalendarItems,
} from "../src/lib/content-calendar.ts";

test("strictly parses calendar keys in local time", () => {
  assert.equal(parseCalendarDateKey("2026-02-28")?.getDate(), 28);
  assert.equal(parseCalendarDateKey("2026-02-29"), null);
  assert.equal(parseCalendarDateKey("2026-2-28"), null);
  assert.equal(parseCalendarDateKey("2026-02-30"), null);
});

test("calendar dates stay valid at extreme timezone offsets", () => {
  const previous = process.env.TZ;
  try {
    for (const timezone of ["Pacific/Kiritimati", "Etc/GMT+12"]) {
      process.env.TZ = timezone;
      const date = parseCalendarDateKey("2026-01-01");
      assert.ok(date);
      assert.equal(calendarDateKey(date), "2026-01-01");
    }
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
});

test("only valid HH:mm values produce a calendar hour", () => {
  assert.equal(calendarItemHour("08:30"), 8);
  assert.equal(calendarItemHour("08:30:00"), null);
  assert.equal(calendarItemHour("25:00"), null);
  assert.equal(calendarItemHour(null), null);
});

test("keeps date keys stable across date arithmetic", () => {
  const date = parseCalendarDateKey("2026-01-01")!;
  assert.equal(calendarDateKey(addCalendarDays(date, 31)), "2026-02-01");
  assert.equal(
    calendarDateKey(startOfCalendarWeek(parseCalendarDateKey("2026-01-07")!)),
    "2026-01-05",
  );
});

test("sorts dates, times, and missing values without mutating input", () => {
  const items = [
    { id: "late", date: "2026-09-02", time: "18:00" },
    { id: "early", date: "2026-09-01", time: "08:30" },
    { id: "untimed", date: "2026-09-01", time: null },
    { id: "invalid", date: "bad", time: "09:00" },
  ];
  assert.deepEqual(
    sortCalendarItems(items).map((item) => item.id),
    ["early", "untimed", "late", "invalid"],
  );
  assert.equal(items[0].id, "late");
});

test("groups valid dates and sorts each group", () => {
  const groups = groupCalendarItems([
    { id: "b", date: "2026-09-01", time: "18:00" },
    { id: "a", date: "2026-09-01", time: "09:00" },
    { id: "x", date: "2026-99-01", time: "09:00" },
  ]);
  assert.deepEqual([...groups.keys()], ["2026-09-01"]);
  assert.deepEqual(
    groups.get("2026-09-01")?.map((item) => item.id),
    ["a", "b"],
  );
});

test("renders every day hour and includes item hours outside the old six slots", () => {
  const hours = calendarHoursForDay(
    [
      { id: "midnight", date: "2026-09-01", time: "00:15" },
      { id: "late", date: "2026-09-01", time: "23:45" },
      { id: "bad", date: "2026-09-01", time: "25:00" },
    ],
    "2026-09-01",
  );
  assert.equal(hours.length, 24);
  assert.equal(hours[0], 0);
  assert.equal(hours[23], 23);
});

test("keeps undated items available for an explicit unscheduled group", () => {
  assert.deepEqual(
    unscheduledCalendarItems([
      { id: "a", date: null, time: "09:00" },
      { id: "b", date: "2026-09-01", time: "09:00" },
    ]).map((item) => item.id),
    ["a"],
  );
});
