/** Pure calendar helpers shared by calendar views and tests. */

export type CalendarLikeItem = {
  id: string;
  date: string | null | undefined;
  time?: string | null;
};

const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME = /^(\d{2}):(\d{2})$/;

/** Parse a calendar key in local time without relying on Date's ISO parsing. */
export function parseCalendarDateKey(value: string | null | undefined): Date | null {
  if (!value) return null;
  const match = DATE_KEY.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? date
    : null;
}

export function calendarDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function addCalendarDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function startOfCalendarWeek(date: Date): Date {
  return addCalendarDays(
    new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12),
    -((date.getDay() + 6) % 7),
  );
}

export function calendarItemHour(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = TIME.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour < 24 && minute < 60 ? hour : null;
}

function timeMinutes(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = TIME.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour < 24 && minute < 60 ? hour * 60 + minute : null;
}

export function sortCalendarItems<T extends CalendarLikeItem>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => {
    const dateA = parseCalendarDateKey(a.date)?.getTime() ?? Number.POSITIVE_INFINITY;
    const dateB = parseCalendarDateKey(b.date)?.getTime() ?? Number.POSITIVE_INFINITY;
    if (dateA !== dateB) return dateA - dateB;
    const timeA = timeMinutes(a.time);
    const timeB = timeMinutes(b.time);
    if (timeA === null && timeB !== null) return 1;
    if (timeA !== null && timeB === null) return -1;
    if (timeA !== null && timeB !== null && timeA !== timeB) return timeA - timeB;
    return a.id.localeCompare(b.id);
  });
}

export function groupCalendarItems<T extends CalendarLikeItem>(
  items: readonly T[],
): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of sortCalendarItems(items)) {
    if (!parseCalendarDateKey(item.date)) continue;
    const date = item.date as string;
    groups.set(date, [...(groups.get(date) ?? []), item]);
  }
  return groups;
}

/** Hours to render in a day view, including every valid item hour. */
export function calendarHoursForDay<T extends CalendarLikeItem>(
  items: readonly T[],
  dateKey: string,
): number[] {
  const hours = new Set<number>();
  for (const item of items) {
    if (item.date !== dateKey) continue;
    const hour = calendarItemHour(item.time);
    if (hour !== null) hours.add(hour);
  }
  for (let hour = 0; hour < 24; hour += 1) hours.add(hour);
  return [...hours].sort((a, b) => a - b);
}

export function unscheduledCalendarItems<T extends CalendarLikeItem>(items: readonly T[]): T[] {
  return sortCalendarItems(items.filter((item) => !parseCalendarDateKey(item.date)));
}
