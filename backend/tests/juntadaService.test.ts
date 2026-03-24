import { describe, expect, it } from 'vitest';
import { computeCommonSlots } from '../src/services/JuntadaService.js';

describe('computeCommonSlots', () => {
  it('devuelve opciones comunes para participantes que respondieron', () => {
    const participants = [
      { id: '1', juntadaId: 'j', googleId: 'g1', name: 'A', responded: true, lastResponseAt: null },
      { id: '2', juntadaId: 'j', googleId: 'g2', name: 'B', responded: true, lastResponseAt: null }
    ];

    const ranges = {
      '1': [{ startAt: '2026-04-01T19:00:00.000Z', endAt: '2026-04-01T22:30:00.000Z' }],
      '2': [{ startAt: '2026-04-01T20:00:00.000Z', endAt: '2026-04-01T23:00:00.000Z' }]
    };

    const options = computeCommonSlots(participants, ranges, 120, '2026-04-01T00:00:00.000Z', '2026-04-02T00:00:00.000Z');

    expect(options[0]?.startAt).toBe('2026-04-01T20:00:00.000Z');
    expect(options[0]?.endAt).toBe('2026-04-01T22:00:00.000Z');
  });
});
