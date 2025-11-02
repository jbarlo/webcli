import { vi } from 'vitest';
import type { Tab, Verb } from '../../src/types/index.js';

export function createMockTab(overrides?: Partial<Tab>): Tab {
  return {
    current_url: 'https://example.com',
    last_updated: new Date().toISOString(),
    ...overrides
  };
}

export function createMockVerb(overrides?: Partial<Verb>): Verb {
  return {
    name: 'test-verb',
    description: 'Test verb description',
    type: 'navigate',
    ...overrides
  };
}

export function createMockContainerVerb(name: string, subverbs: Verb[]): Verb {
  return {
    name,
    description: `Container with ${subverbs.length} items`,
    type: 'navigate',
    subverbs
  };
}

export function mockConsole() {
  return {
    log: vi.spyOn(console, 'log').mockImplementation(() => {}),
    error: vi.spyOn(console, 'error').mockImplementation(() => {})
  };
}
