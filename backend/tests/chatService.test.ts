import { describe, expect, it } from 'vitest';
import { FIXED_OPENAI_MODEL } from '../src/services/ChatService.js';

describe('ChatService', () => {
  it('usa siempre el modelo fijo del organizador virtual', () => {
    expect(FIXED_OPENAI_MODEL).toBe('gpt-5.4-mini');
  });
});
