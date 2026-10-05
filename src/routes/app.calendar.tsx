import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/app-chrome";
import { PlatformMark } from "@/components/social-preview";
import { getPlanner, updatePlanItem, type PlannerItemSnapshot } from "@/lib/campaign.functions";
import {
  addCalendarDays as addDays,
  calendarDateKey as dateKeyFromDate,
  calendarHoursForDay,
  calendarItemHour,
  groupCalendarItems,
  parseCalendarDateKey as parseDateKey,
  startOfCalendarWeek as startOfWeek,
  unscheduledCalendarItems,
} from "@/lib/content-calendar";
import type { PlanItemStatus, PostPlatform, PostStatus } from "@/lib/data-model";
import {
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Edit3,
  GripVertical,
  Plus,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/calendar")({
  loader: () => getPlanner({ data: {} }),
  component: CalendarView,
});

const CHANNELS: Array<{ id: PostPlatform; label: string }> = [
  { id: "facebook", label: "Facebook" },
  { id: "instagram", label: "Instagram" },
  { id: "tiktok", label: "TikTok" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "youtube", label: "YouTube" },
  { id: "google-business", label: "Google Business" },
];
const STATUS_LABELS: Record<PlanItemStatus, string> = {
  idea: "Ötlet",
  planned: "Tervezett",
  draft: "Piszkozat",
  ready: "Jóváhagyás",
  scheduled: "Időzített",
  published: "Publikált",
  skipped: "Kihagyva",
};
const PLATFORM_LABELS: Record<string, string> = Object.fromEntries(
  CHANNELS.map((channel) => [channel.id, channel.label]),
);
const WEEKDAYS = ["H", "K", "Sze", "Cs", "P", "Szo", "V"];
const VIEW_LABELS = { month: "Hónap", week: "Hét", day: "Nap" } as const;
type CalendarViewMode = keyof typeof VIEW_LABELS;

function statusLabel(status: PlanItemStatus, postStatus: PostStatus | null) {
  if (postStatus === "failed") return "Hiba";
  if (postStatus === "published") return "Publikált";
  return STATUS_LABELS[status];
}

function isPublished(item: PlannerItemSnapshot) {
  return item.status === "published" || item.postStatus === "published";
}

function monthLabel(date: Date) {
  return date.toLocaleDateString("hu-HU", { year: "numeric", month: "long" });
}

function rangeLabel(mode: CalendarViewMode, date: Date) {
  if (mode === "month") return monthLabel(date);
  if (mode === "day")
    return date.toLocaleDateString("hu-HU", { year: "numeric", month: "long", day: "numeric" });
  const first = startOfWeek(date);
  const last = addDays(first, 6);
  return `${first.toLocaleDateString("hu-HU", { month: "short", day: "numeric" })} – ${last.toLocaleDateString("hu-HU", { month: "short", day: "numeric", year: "numeric" })}`;
}

function CalendarItem({
  item,
  compact = false,
  onDragStart,
  onDragEnd,
  onSelect,
  pending,
}: {
  item: PlannerItemSnapshot;
  compact?: boolean;
  onDragStart: (event: React.DragEvent, item: PlannerItemSnapshot) => void;
  onDragEnd: () => void;
  onSelect: () => void;
  pending: boolean;
}) {
  return (
    <div
      draggable={!pending && !isPublished(item)}
      onDragStart={(event) => onDragStart(event, item)}
      onDragEnd={onDragEnd}
      data-plan-item={item.id}
      className={`calendar-event group flex items-start gap-2 rounded-lg border border-border bg-card ${compact ? "p-2" : "p-3"} ${pending ? "opacity-60" : isPublished(item) ? "" : "cursor-grab active:cursor-grabbing"}`}
      title={isPublished(item) ? "Közzétett tartalom" : "Húzd át egy másik napra vagy idősávra"}
    >
      <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground opacity-50 group-hover:opacity-100" />
      <div className="min-w-0 flex-1">
        <a
          href="#calendar-selected-day"
          onClick={onSelect}
          className="block text-sm font-semibold leading-snug hover:text-primary"
          aria-label={`Tétel részletei: ${item.topic}`}
        >
          {item.time ? `${item.time} · ` : ""}
          {item.topic}
        </a>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <PlatformMark platform={item.platform} />
          <span className="text-xs text-muted-foreground">
            {PLATFORM_LABELS[item.platform] ?? item.platform}
          </span>
          <Badge className="tt-badge" variant="outline">
            {statusLabel(item.status, item.postStatus)}
          </Badge>
        </div>
        {item.campaignName && (
          <div className="mt-1 text-xs text-muted-foreground">{item.campaignName}</div>
        )}
        {item.postId && (
          <Link
            to="/app/posts/$id"
            params={{ id: item.postId }}
            className="tt-link mt-2 inline-block text-xs"
          >
            Poszt megnyitása →
          </Link>
        )}
      </div>
    </div>
  );
}

function DropZone({
  label,
  active,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  label: string;
  active: boolean;
  onDragOver: (event: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (event: React.DragEvent) => void;
}) {
  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`rounded-lg border border-dashed px-2 py-3 text-center text-[11px] transition ${active ? "border-primary bg-brand-soft/60 text-primary" : "border-border text-muted-foreground"}`}
    >
      {label}
    </div>
  );
}

function CalendarView() {
  const items = Route.useLoaderData();
  const router = useRouter();
  const update = useServerFn(updatePlanItem);
  const initialDate = useMemo(() => new Date(), []);
  const [mode, setMode] = useState<CalendarViewMode>("month");
  const [cursor, setCursor] = useState(
    () => new Date(initialDate.getFullYear(), initialDate.getMonth(), 1),
  );
  const [selectedDate, setSelectedDate] = useState<string | null>(dateKeyFromDate(initialDate));
  const [editing, setEditing] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [saveError, setSaveError] = useState("");
  const saving = useRef(false);
  const dayScroll = useRef<HTMLDivElement>(null);

  const itemsByDate = useMemo(() => groupCalendarItems(items), [items]);
  const invalidDateItems = useMemo(() => unscheduledCalendarItems(items), [items]);
  const selectedItems = selectedDate ? (itemsByDate.get(selectedDate) ?? []) : [];
  const monthDays = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const leading = (new Date(year, month, 1).getDay() + 6) % 7;
    const total = new Date(year, month + 1, 0).getDate();
    const trailing = (7 - ((leading + total) % 7)) % 7;
    return Array.from({ length: leading + total + trailing }, (_, index) =>
      index < leading || index >= leading + total
        ? null
        : dateKeyFromDate(new Date(year, month, index - leading + 1, 12)),
    );
  }, [cursor]);
  const weekDays = useMemo(() => {
    const base = parseDateKey(selectedDate) ?? cursor;
    const first = startOfWeek(base);
    return Array.from({ length: 7 }, (_, index) => dateKeyFromDate(addDays(first, index)));
  }, [cursor, selectedDate]);
  const dayDate = parseDateKey(selectedDate) ?? cursor;
  const dayKey = dateKeyFromDate(dayDate);
  const todayKey = dateKeyFromDate(new Date());
  const displayedDates = mode === "month" ? monthDays : mode === "week" ? weekDays : [dayKey];
  const visibleCount = displayedDates.reduce(
    (count, date) => count + (date ? (itemsByDate.get(date)?.length ?? 0) : 0),
    0,
  );
  const untimedItems = selectedItems.filter((item) => calendarItemHour(item.time) === null);
  const firstDayHour =
    selectedItems.map((item) => calendarItemHour(item.time)).find((hour) => hour !== null) ?? 8;

  useEffect(() => {
    if (mode !== "day" || !dayScroll.current) return;
    const slot = dayScroll.current.querySelector<HTMLElement>(`[data-hour="${firstDayHour}"]`);
    if (slot) dayScroll.current.scrollTop = slot.offsetTop - dayScroll.current.offsetTop;
  }, [mode, selectedDate, firstDayHour]);

  async function persist(
    item: PlannerItemSnapshot,
    fields: { date: string; time: string | null; platform?: PostPlatform; topic?: string },
    message: string,
  ) {
    if (saving.current) return;
    if (isPublished(item)) {
      toast.error("A közzétett tartalom időpontja nem módosítható.");
      return;
    }
    saving.current = true;
    setPending(true);
    setSaveError("");
    try {
      const result = await update({ data: { planItemId: item.id, fields } });
      if (!result) throw new Error("A naptárbejegyzés nem található. Frissítsd az oldalt.");
      await router.invalidate();
      selectDate(result.date);
      setEditing(null);
      toast.success(message);
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Nem sikerült menteni a naptárbejegyzést.";
      setSaveError(message);
      toast.error(message);
    } finally {
      saving.current = false;
      setPending(false);
    }
  }

  async function save(event: React.FormEvent<HTMLFormElement>, item: PlannerItemSnapshot) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const date = String(form.get("date"));
    const topic = String(form.get("topic")).trim();
    if (!parseDateKey(date) || !topic) {
      setSaveError("Adj meg érvényes dátumot és témát.");
      return;
    }
    await persist(
      item,
      {
        date,
        time: String(form.get("time") || "") || null,
        platform: String(form.get("platform")) as PostPlatform,
        topic,
      },
      "Naptárbejegyzés frissítve.",
    );
  }

  function moveRange(delta: number) {
    if (mode === "month") {
      setCursor((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
      setSelectedDate(null);
      return;
    }
    const next = addDays(dayDate, mode === "week" ? delta * 7 : delta);
    setSelectedDate(dateKeyFromDate(next));
    setCursor(new Date(next.getFullYear(), next.getMonth(), 1));
  }

  function onDragStart(event: React.DragEvent, item: PlannerItemSnapshot) {
    if (pending || isPublished(item)) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", item.id);
    setDragging(item.id);
  }

  async function dropItem(event: React.DragEvent, date: string, time?: string | null) {
    event.preventDefault();
    const itemId = event.dataTransfer.getData("text/plain") || dragging;
    setDropTarget(null);
    setDragging(null);
    if (!itemId || pending) return;
    const item = items.find((candidate) => candidate.id === itemId);
    if (!item || !parseDateKey(date)) {
      toast.error("Érvénytelen naptári célpont.");
      return;
    }
    if (item.date === date && (time === undefined || item.time === (time ?? null))) return;
    await persist(
      item,
      { date, time: time === undefined ? item.time : time },
      "A tartalom új időpontja mentve.",
    );
  }

  function selectDate(date: string) {
    const parsed = parseDateKey(date);
    if (!parsed) return;
    setSelectedDate(date);
    setCursor(new Date(parsed.getFullYear(), parsed.getMonth(), 1));
  }
  function showItem(item: PlannerItemSnapshot) {
    selectDate(item.date);
    setEditing(null);
    setSaveError("");
  }

  const dropHandlers = (key: string, date: string, time?: string | null) => ({
    onDragOver: (event: React.DragEvent) => {
      if (!dragging || pending) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      setDropTarget(key);
    },
    onDragLeave: () => setDropTarget((current) => (current === key ? null : current)),
    onDrop: (event: React.DragEvent) => void dropItem(event, date, time),
  });

  return (
    <div className="content-calendar space-y-5">
      <PageHeader
        title="Tartalomnaptár"
        sub="Nézd át a tartalmaidat, és módosítsd az időpontjukat egy helyen."
        action={
          <Button asChild className="tt-primary">
            <Link to="/app/posts/$id" params={{ id: "new" }}>
              <Plus className="mr-1 h-4 w-4" />
              Új poszt
            </Link>
          </Button>
        }
      />
      <Card className="tt-card overflow-hidden p-0">
        <div className="calendar-toolbar flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-4 md:px-6">
          <div className="calendar-range flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="rounded-lg shrink-0"
              aria-label="Előző időszak"
              onClick={() => moveRange(-1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h2
              className="min-w-0 flex-1 text-center font-display text-lg font-extrabold capitalize"
              aria-live="polite"
            >
              {rangeLabel(mode, mode === "month" ? cursor : dayDate)}
            </h2>
            <Button
              variant="outline"
              size="icon"
              className="rounded-lg shrink-0"
              aria-label="Következő időszak"
              onClick={() => moveRange(1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-lg"
              onClick={() => selectDate(todayKey)}
            >
              Ma
            </Button>
            <div
              className="flex rounded-lg border border-border bg-secondary/30 p-1"
              role="group"
              aria-label="Naptár nézet"
            >
              {(Object.keys(VIEW_LABELS) as CalendarViewMode[]).map((view) => (
                <Button
                  key={view}
                  type="button"
                  size="sm"
                  variant={mode === view ? "default" : "ghost"}
                  className="rounded-md px-3 text-sm"
                  aria-pressed={mode === view}
                  onClick={() => setMode(view)}
                >
                  {VIEW_LABELS[view]}
                </Button>
              ))}
            </div>
            <Link to="/app/planner" className="tt-link text-sm">
              30 napos terv <ChevronRight className="ml-0.5 inline h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3 text-sm md:px-6">
          <span>
            {visibleCount} tartalom ebben az időszakban · {items.length} összesen
          </span>
          <span className="text-muted-foreground">
            Az időpont mentése nem indít automatikus közzétételt.
          </span>
        </div>
        {mode === "month" && (
          <>
            <div className="grid grid-cols-7 border-b border-border bg-secondary/30">
              {WEEKDAYS.map((day) => (
                <div
                  key={day}
                  className="px-1 py-3 text-center text-xs font-bold text-muted-foreground"
                >
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {monthDays.map((day, index) => {
                const dayItems = day ? (itemsByDate.get(day) ?? []) : [];
                const active = day === selectedDate;
                const key = `month-${day ?? index}`;
                return (
                  <div
                    key={key}
                    data-calendar-date={day ?? undefined}
                    {...(day ? dropHandlers(key, day) : {})}
                    className={`calendar-month-cell min-w-0 border-b border-r border-border p-2 transition ${day ? "bg-card" : "bg-secondary/20"} ${active ? "bg-brand-soft/55 ring-2 ring-inset ring-primary/35" : ""} ${dropTarget === key ? "ring-2 ring-inset ring-primary" : ""}`}
                  >
                    {day && (
                      <>
                        <button
                          type="button"
                          aria-label={`Nap kiválasztása: ${day}`}
                          aria-pressed={active}
                          onClick={() => {
                            selectDate(day);
                            setEditing(null);
                            setSaveError("");
                          }}
                          className={`calendar-date-button inline-grid h-8 w-8 place-items-center rounded-full text-sm font-semibold ${active ? "bg-primary text-primary-foreground" : day === todayKey ? "ring-1 ring-primary text-primary" : "text-foreground hover:bg-brand-soft"}`}
                        >
                          {Number(day.slice(-2))}
                        </button>
                        <div className="mt-1 space-y-1">
                          {dayItems.slice(0, 3).map((item) => (
                            <a
                              key={item.id}
                              href="#calendar-selected-day"
                              data-plan-item={item.id}
                              title={`${item.time ?? "Időpont nélkül"} · ${item.topic} · ${PLATFORM_LABELS[item.platform]}`}
                              aria-label={`Tétel részletei: ${item.topic}`}
                              onClick={() => showItem(item)}
                              draggable={!pending && !isPublished(item)}
                              onDragStart={(event) => onDragStart(event, item)}
                              onDragEnd={() => {
                                setDragging(null);
                                setDropTarget(null);
                              }}
                              className={`calendar-month-event block truncate rounded-md px-1.5 py-1 text-xs font-semibold ${isPublished(item) ? "bg-emerald-50 text-emerald-700" : item.status === "skipped" ? "bg-secondary text-muted-foreground" : "bg-brand-soft text-primary"}`}
                            >
                              <span className="calendar-event-label">
                                {item.time ? `${item.time} ` : ""}
                                {item.topic}
                              </span>
                              <span className="calendar-event-dot hidden">•</span>
                            </a>
                          ))}
                        </div>
                        {dayItems.length > 3 && (
                          <a
                            href="#calendar-selected-day"
                            onClick={() => selectDate(day)}
                            className="block text-xs font-semibold text-primary"
                          >
                            +{dayItems.length - 3}
                          </a>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
        {mode === "week" && (
          <div className="calendar-week-grid">
            {weekDays.map((day) => {
              const parsed = parseDateKey(day)!;
              const dayItems = itemsByDate.get(day) ?? [];
              const key = `week-${day}`;
              return (
                <div
                  key={day}
                  data-calendar-date={day}
                  className="calendar-week-column min-w-0 bg-card p-3"
                >
                  <button
                    type="button"
                    aria-label={`Nap kiválasztása: ${day}`}
                    aria-pressed={selectedDate === day}
                    className={`mb-3 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-brand-soft/30 ${selectedDate === day ? "bg-brand-soft/50" : ""}`}
                    onClick={() => {
                      selectDate(day);
                      setEditing(null);
                    }}
                  >
                    <span
                      className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-base font-semibold ${day === todayKey ? "bg-primary text-primary-foreground" : ""}`}
                    >
                      {parsed.getDate()}
                    </span>
                    <strong className="text-xs text-muted-foreground">
                      {parsed.toLocaleDateString("hu-HU", { weekday: "short" })}
                    </strong>
                    <span className="ml-auto text-xs text-muted-foreground">{dayItems.length}</span>
                  </button>
                  <div className="space-y-2">
                    {dayItems.map((item) => (
                      <CalendarItem
                        key={item.id}
                        item={item}
                        compact
                        onSelect={() => showItem(item)}
                        onDragStart={onDragStart}
                        onDragEnd={() => {
                          setDragging(null);
                          setDropTarget(null);
                        }}
                        pending={pending}
                      />
                    ))}
                  </div>
                  <div className="mt-3">
                    <DropZone
                      label={
                        dragging
                          ? "Áthelyezés ide"
                          : dayItems.length
                            ? "Új időpont"
                            : "Nincs tervezett tartalom"
                      }
                      active={dropTarget === key}
                      {...dropHandlers(key, day)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {mode === "day" && (
          <div className="p-4 md:p-6">
            <div className="mb-4">
              <h3 className="font-display text-lg font-extrabold">
                {dayDate.toLocaleDateString("hu-HU", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Húzd másik idősávra, vagy a részleteknél válaszd a Szerkesztést.
              </p>
            </div>
            {untimedItems.length > 0 && (
              <div className="mb-4 space-y-2">
                <h4 className="text-sm font-semibold">Időpont nélkül</h4>
                {untimedItems.map((item) => (
                  <CalendarItem
                    key={item.id}
                    item={item}
                    compact
                    onSelect={() => showItem(item)}
                    onDragStart={onDragStart}
                    onDragEnd={() => {
                      setDragging(null);
                      setDropTarget(null);
                    }}
                    pending={pending}
                  />
                ))}
              </div>
            )}
            <div
              className="calendar-day-hours relative space-y-2"
              ref={dayScroll}
              role="region"
              aria-label="Napi idősávok"
              tabIndex={0}
            >
              {calendarHoursForDay(selectedItems, dayKey).map((hour) => {
                const time = `${String(hour).padStart(2, "0")}:00`;
                const slotItems = selectedItems.filter(
                  (item) => calendarItemHour(item.time) === hour,
                );
                const key = `day-${dayKey}-${time}`;
                return (
                  <div
                    key={key}
                    data-hour={hour}
                    className="grid grid-cols-[44px_1fr] items-start gap-3"
                  >
                    <span className="pt-2 text-sm font-semibold text-muted-foreground">{time}</span>
                    <div className="min-h-14 min-w-0 space-y-2" data-calendar-time={time}>
                      {slotItems.map((item) => (
                        <CalendarItem
                          key={item.id}
                          item={item}
                          compact
                          onSelect={() => showItem(item)}
                          onDragStart={onDragStart}
                          onDragEnd={() => {
                            setDragging(null);
                            setDropTarget(null);
                          }}
                          pending={pending}
                        />
                      ))}
                      <DropZone
                        label={slotItems.length ? "Másik tartalom ide" : "Idősáv"}
                        active={dropTarget === key}
                        {...dropHandlers(key, dayKey, time)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Card>
      {saveError && (
        <div
          role="alert"
          className="rounded-xl border border-destructive/25 bg-destructive/5 p-4 text-sm text-destructive"
        >
          {saveError}
        </div>
      )}
      <section
        id="calendar-selected-day"
        className="calendar-details grid gap-5 lg:grid-cols-[1.15fr_.85fr]"
      >
        <Card className="tt-card p-5">
          <div className="tt-cardhead">
            <div>
              <h2>Kiválasztott nap</h2>
              <p>
                {selectedDate && parseDateKey(selectedDate)
                  ? parseDateKey(selectedDate)!.toLocaleDateString("hu-HU", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })
                  : "Válassz egy napot a naptárban"}
              </p>
            </div>
            <Calendar className="h-5 w-5 text-primary" />
          </div>
          {selectedItems.length ? (
            <div className="mt-4 space-y-3">
              {selectedItems.map((item) => (
                <DayItem
                  key={item.id}
                  item={item}
                  editing={editing === item.id}
                  pending={pending}
                  onEdit={() => {
                    setEditing(item.id);
                    setSaveError("");
                  }}
                  onCancel={() => {
                    if (!pending) {
                      setEditing(null);
                      setSaveError("");
                    }
                  }}
                  onSave={(event) => void save(event, item)}
                />
              ))}
            </div>
          ) : (
            <div className="calendar-empty tt-empty mt-4">
              <Calendar className="h-6 w-6 text-primary" />
              <strong className="mt-2 text-sm">Erre a napra még nincs tartalmad.</strong>
              <span className="mt-1 text-sm text-muted-foreground">
                Időzíts egy kész posztot, vagy készíts kampánytervet.
              </span>
              <div className="mt-3 flex flex-wrap justify-center gap-3">
                <Link to="/app/posts" className="tt-link">
                  Poszt kiválasztása →
                </Link>
                <Link to="/app/campaigns" className="tt-link">
                  Kampány indítása →
                </Link>
              </div>
            </div>
          )}
        </Card>
        <Card className="tt-card p-5">
          <div className="tt-cardhead">
            <div>
              <h2>Gyors áttekintés</h2>
              <p>A mentett tartalmaid állapota.</p>
            </div>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
            {(["planned", "draft", "scheduled", "published"] as PlanItemStatus[]).map((status) => (
              <div
                key={status}
                className="flex items-center justify-between rounded-xl border border-border px-3 py-3"
              >
                <span className="text-sm">{STATUS_LABELS[status]}</span>
                <Badge className="tt-badge" variant="outline">
                  {
                    items.filter((item) =>
                      item.postStatus
                        ? item.postStatus === status && item.status !== "skipped"
                        : item.status === status,
                    ).length
                  }
                </Badge>
              </div>
            ))}
          </div>
          {!items.length && (
            <p className="mt-4 text-sm text-muted-foreground">
              Az időzített posztok és a kampányból készült tervtételek automatikusan itt is
              megjelennek.
            </p>
          )}
        </Card>
      </section>
      {invalidDateItems.length > 0 && (
        <Card className="tt-card p-5">
          <h2 className="text-lg font-semibold">Dátumot igénylő tartalmak</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Ezek a tételek érvényes dátum nélkül nem helyezhetők el a naptárban.
          </p>
          <div className="mt-4 space-y-3">
            {invalidDateItems.map((item) => (
              <DayItem
                key={item.id}
                item={item}
                editing={editing === item.id}
                pending={pending}
                onEdit={() => {
                  setEditing(item.id);
                  setSaveError("");
                }}
                onCancel={() => setEditing(null)}
                onSave={(event) => void save(event, item)}
              />
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function DayItem({
  item,
  editing,
  pending,
  onEdit,
  onCancel,
  onSave,
}: {
  item: PlannerItemSnapshot;
  editing: boolean;
  pending: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  if (editing)
    return (
      <form
        onSubmit={onSave}
        className="calendar-edit rounded-xl border border-primary/30 bg-brand-soft/25 p-4"
        aria-label={`Tartalom szerkesztése: ${item.topic}`}
      >
        <fieldset disabled={pending} className="min-w-0">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              Dátum
              <Input
                type="date"
                name="date"
                defaultValue={parseDateKey(item.date) ? item.date : ""}
                required
                className="mt-1"
              />
            </label>
            <label className="text-sm">
              Idő
              <Input
                type="time"
                name="time"
                defaultValue={item.time ?? ""}
                required={item.status === "scheduled"}
                className="mt-1"
              />
            </label>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Időzóna: {item.timezone}. A kapcsolt poszt csatornáinak időpontja együtt frissül.
          </p>
          <label className="mt-3 block text-sm">
            Csatorna
            <select
              name="platform"
              defaultValue={item.platform}
              className="mt-1 h-10 w-full rounded-xl border bg-card px-3 text-sm"
            >
              {CHANNELS.map((channel) => (
                <option key={channel.id} value={channel.id}>
                  {channel.label}
                </option>
              ))}
            </select>
          </label>
          <label className="mt-3 block text-sm">
            Téma
            <Input
              name="topic"
              defaultValue={item.topic}
              required
              maxLength={1000}
              className="mt-1"
            />
          </label>
          <div className="mt-3 flex gap-2">
            <Button type="submit" size="sm" className="tt-primary">
              <Check className="mr-1 h-3.5 w-3.5" />
              {pending ? "Mentés…" : "Mentés"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="rounded-lg"
              onClick={onCancel}
            >
              Mégse
            </Button>
          </div>
        </fieldset>
      </form>
    );
  return (
    <div
      data-calendar-detail={item.id}
      className="flex flex-wrap items-start gap-3 rounded-xl border border-border p-4"
    >
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-soft text-primary">
        <PlatformMark platform={item.platform} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <strong className="break-words text-sm">{item.topic}</strong>
          <Badge className="tt-badge" variant="outline">
            {statusLabel(item.status, item.postStatus)}
          </Badge>
        </div>
        <div className="mt-1 text-sm text-muted-foreground">
          {item.time ?? "Nincs időpont"} · {PLATFORM_LABELS[item.platform] ?? item.platform}
          {item.campaignName ? ` · ${item.campaignName}` : ""}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          {item.timezone} · {item.brandName}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {!isPublished(item) && (
          <Button
            size="sm"
            variant="ghost"
            className="rounded-lg"
            disabled={pending}
            onClick={onEdit}
            aria-label={`Szerkesztés: ${item.topic}`}
          >
            <Edit3 className="mr-1 h-3.5 w-3.5" />
            Szerkesztés
          </Button>
        )}
        {item.postId && (
          <Button asChild size="sm" variant="outline" className="rounded-lg">
            <Link to="/app/posts/$id" params={{ id: item.postId }}>
              Poszt megnyitása <ChevronRight className="ml-0.5 inline h-3.5 w-3.5" />
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
