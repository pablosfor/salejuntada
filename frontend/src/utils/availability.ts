export type Rule = {
  weekDays: number[];
  startTime: string;
  endTime: string;
};

export type Range = { startAt: string; endAt: string };

export function buildRangesFromRules(dateFrom: string, dateTo: string, rules: Rule[]): Range[] {
  const ranges: Range[] = [];
  const startDate = new Date(dateFrom);
  const endDate = new Date(dateTo);

  for (let d = new Date(startDate); d <= endDate; d.setUTCDate(d.getUTCDate() + 1)) {
    for (const rule of rules) {
      if (!rule.weekDays.includes(d.getUTCDay())) continue;
      const [startH, startM] = rule.startTime.split(':').map(Number);
      const [endH, endM] = rule.endTime.split(':').map(Number);
      const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), startH, startM, 0));
      const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), endH, endM, 0));
      if (end > start) {
        ranges.push({ startAt: start.toISOString(), endAt: end.toISOString() });
      }
    }
  }

  return ranges;
}
