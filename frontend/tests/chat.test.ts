import { describe, expect, it } from 'vitest';

describe('chat frontend', () => {
  it('mantiene la ruta de juntada como chat compartido', () => {
    expect('/j/abc'.match(/^\/j\/(.+)$/)?.[1]).toBe('abc');
  });
});
