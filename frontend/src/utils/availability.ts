export type Range = { startAt: string; endAt: string };

export type DayInfo = {
  dateKey: string;
  dayLabel: string;
  shortLabel: string;
  weekday: number;
};

export type TimelineSlice = {
  iso: string;
  label: string;
  dayKey: string;
  weekLabel: string;
  dayNumber: string;
  fullLabel: string;
  dayType: 'weekday' | 'saturday' | 'sunday' | 'holiday' | 'touristic';
  dayName?: string;
  isDayStart: boolean;
  isLast: boolean;
};

const SLOT_MINUTES = 30;
export const slotCount = (24 * 60) / SLOT_MINUTES;

const HOLIDAY_INFO_2026: Record<string, { kind: 'holiday' | 'touristic'; label: string }> = {
  '2026-01-01': { kind: 'holiday', label: 'Año Nuevo' },
  '2026-02-16': { kind: 'holiday', label: 'Carnaval' },
  '2026-02-17': { kind: 'holiday', label: 'Carnaval' },
  '2026-03-23': { kind: 'touristic', label: 'Día turístico' },
  '2026-03-24': { kind: 'holiday', label: 'Memoria por la Verdad y la Justicia' },
  '2026-04-02': { kind: 'holiday', label: 'Malvinas' },
  '2026-04-03': { kind: 'holiday', label: 'Viernes Santo' },
  '2026-05-01': { kind: 'holiday', label: 'Día del Trabajador' },
  '2026-05-25': { kind: 'holiday', label: 'Revolución de Mayo' },
  '2026-06-15': { kind: 'holiday', label: 'Paso a la Inmortalidad de Güemes' },
  '2026-06-20': { kind: 'holiday', label: 'Paso a la Inmortalidad de Belgrano' },
  '2026-07-09': { kind: 'holiday', label: 'Independencia' },
  '2026-07-10': { kind: 'touristic', label: 'Día turístico' },
  '2026-08-17': { kind: 'holiday', label: 'Paso a la Inmortalidad de San Martín' },
  '2026-10-12': { kind: 'holiday', label: 'Diversidad Cultural' },
  '2026-11-23': { kind: 'holiday', label: 'Soberanía Nacional' },
  '2026-12-07': { kind: 'touristic', label: 'Día turístico' },
  '2026-12-08': { kind: 'holiday', label: 'Inmaculada Concepción' },
  '2026-12-25': { kind: 'holiday', label: 'Navidad' }
};

export function enumerateDays(dateFrom: string, dateTo: string): DayInfo[] {
  const days: DayInfo[] = [];
  const start = startOfDay(new Date(dateFrom));
  const end = startOfDay(new Date(dateTo));

  for (const cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    const value = new Date(cursor);
    days.push({
      dateKey: toDateKey(value),
      dayLabel: value.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'numeric' }),
      shortLabel: value.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'numeric' }),
      weekday: value.getDay()
    });
  }

  return days;
}

export function buildTimelineSlices(dateFrom: string, dateTo: string) {
  const days = enumerateDays(dateFrom, dateTo);
  const slices: TimelineSlice[] = [];

  for (const day of days) {
    const specialDay = getSpecialDay(day.dateKey, day.weekday);
    for (let slot = 0; slot < slotCount; slot += 1) {
      slices.push({
        iso: slotToIso(day.dateKey, slot),
        label: slotLabel(slot),
        dayKey: day.dateKey,
        weekLabel: shortWeekLabel(day.weekday),
        dayNumber: day.dateKey.slice(8, 10),
        fullLabel: `${shortWeekLabel(day.weekday)} ${day.dateKey.slice(8, 10)} - ${slotLabel(slot)}`,
        dayType: specialDay.kind,
        dayName: specialDay.label,
        isDayStart: slot === 0,
        isLast: false
      });
    }
  }

  const end = new Date(dateTo);
  const lastDay = days[days.length - 1];
  if (lastDay) {
    slices.push({
      iso: end.toISOString(),
      label: formatTime(end),
      dayKey: lastDay.dateKey,
      weekLabel: shortWeekLabel(lastDay.weekday),
      dayNumber: lastDay.dateKey.slice(8, 10),
      fullLabel: `${shortWeekLabel(lastDay.weekday)} ${lastDay.dateKey.slice(8, 10)} - ${formatTime(end)}`,
      dayType: getSpecialDay(lastDay.dateKey, lastDay.weekday).kind,
      dayName: getSpecialDay(lastDay.dateKey, lastDay.weekday).label,
      isDayStart: false,
      isLast: true
    });
  }

  return slices;
}

export function normalizeRanges(ranges: Range[]) {
  return [...ranges]
    .filter((range) => new Date(range.endAt).getTime() > new Date(range.startAt).getTime())
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
    .reduce<Range[]>((acc, current) => {
      const last = acc[acc.length - 1];
      if (!last) {
        acc.push({ ...current });
        return acc;
      }

      if (new Date(current.startAt).getTime() <= new Date(last.endAt).getTime()) {
        if (new Date(current.endAt).getTime() > new Date(last.endAt).getTime()) {
          last.endAt = current.endAt;
        }
        return acc;
      }

      acc.push({ ...current });
      return acc;
    }, []);
}

export function buildRangeFromPoints(firstIso: string, secondIso: string): Range {
  const [startAt, endPoint] = new Date(firstIso).getTime() <= new Date(secondIso).getTime()
    ? [firstIso, secondIso]
    : [secondIso, firstIso];
  return { startAt, endAt: addSlotMinutes(endPoint) };
}

export function mergeRangeIntoList(ranges: Range[], nextRange: Range) {
  return normalizeRanges([...ranges, nextRange]);
}

export function removeRange(ranges: Range[], target: Range) {
  return ranges.filter((range) => range.startAt !== target.startAt || range.endAt !== target.endAt);
}

export function replicateRangeAcrossWeekdays(
  ranges: Range[],
  source: Range,
  weekDays: number[],
  dateFrom: string,
  dateTo: string
) {
  const sourceStart = new Date(source.startAt);
  const sourceEnd = new Date(source.endAt);
  const durationMs = sourceEnd.getTime() - sourceStart.getTime();
  const endLimit = new Date(dateTo).getTime();
  const startMinutes = sourceStart.getHours() * 60 + sourceStart.getMinutes();
  const nextRanges = [...ranges];

  for (const day of enumerateDays(dateFrom, dateTo)) {
    if (!weekDays.includes(day.weekday)) continue;
    const start = fromDateKeyAndMinutes(day.dateKey, startMinutes);
    const end = new Date(start.getTime() + durationMs);
    if (start.getTime() < new Date(dateFrom).getTime() || end.getTime() > endLimit) continue;
    nextRanges.push({ startAt: start.toISOString(), endAt: end.toISOString() });
  }

  return normalizeRanges(nextRanges);
}

export function getDateKey(value: string) {
  return toDateKey(new Date(value));
}

export function formatRangeLabel(range: Range) {
  return `${formatTime(new Date(range.startAt))} - ${formatTime(new Date(range.endAt))}`;
}

export function formatTime(value: Date) {
  return value.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function slotLabel(slot: number) {
  const hours = Math.floor((slot * SLOT_MINUTES) / 60);
  const minutes = (slot * SLOT_MINUTES) % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function getRangeVisual(range: Range, timelineStart: string, timelineEnd: string) {
  const start = new Date(timelineStart).getTime();
  const end = new Date(timelineEnd).getTime();
  const total = Math.max(end - start, 1);
  const rangeStart = new Date(range.startAt).getTime();
  const rangeEnd = new Date(range.endAt).getTime();

  return {
    left: ((rangeStart - start) / total) * 100,
    width: ((rangeEnd - rangeStart) / total) * 100
  };
}

export function sliceIsInRanges(iso: string, ranges: Range[]) {
  const time = new Date(iso).getTime();
  return ranges.some((range) => {
    const start = new Date(range.startAt).getTime();
    const end = new Date(range.endAt).getTime();
    return time >= start && time < end;
  });
}

export function findRangeContainingIso(iso: string, ranges: Range[]) {
  const time = new Date(iso).getTime();
  return ranges.find((range) => {
    const start = new Date(range.startAt).getTime();
    const end = new Date(range.endAt).getTime();
    return time >= start && time < end;
  }) ?? null;
}

export function sliceIsInRange(iso: string, range: Range | null) {
  if (!range) return false;
  const time = new Date(iso).getTime();
  const start = new Date(range.startAt).getTime();
  const end = new Date(range.endAt).getTime();
  return time >= start && time < end;
}

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function toDateKey(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function slotToIso(dateKey: string, slot: number) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(year, month - 1, day, 0, 0, 0, 0);
  date.setMinutes(slot * SLOT_MINUTES);
  return date.toISOString();
}

function fromDateKeyAndMinutes(dateKey: string, minutes: number) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day, 0, minutes, 0, 0);
}

function addSlotMinutes(iso: string) {
  const date = new Date(iso);
  date.setMinutes(date.getMinutes() + SLOT_MINUTES);
  return date.toISOString();
}

function shortWeekLabel(weekday: number) {
  return ['DOM', 'LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB'][weekday] ?? '';
}

function getSpecialDay(dateKey: string, weekday: number) {
  const holiday = HOLIDAY_INFO_2026[dateKey];
  if (holiday) {
    return { kind: holiday.kind, label: holiday.label };
  }
  if (weekday === 0) {
    return { kind: 'sunday' as const, label: 'Domingo' };
  }
  if (weekday === 6) {
    return { kind: 'saturday' as const, label: 'Sábado' };
  }
  return { kind: 'weekday' as const, label: undefined };
}
