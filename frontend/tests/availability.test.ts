import { describe, expect, it } from 'vitest';
import { buildRangesFromRules } from '../src/utils/availability';

describe('buildRangesFromRules', () => {
  it('expande reglas por día de semana', () => {
    const ranges = buildRangesFromRules('2026-04-01T00:00:00.000Z', '2026-04-08T23:59:59.000Z', [
      { weekDays: [3], startTime: '19:00', endTime: '22:30' }
    ]);
    expect(ranges.length).toBe(2);
    expect(ranges[0].startAt).toContain('T19:00:00.000Z');
  });
});
