import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { vol } from 'memfs';
import { StateManager } from '../../src/lib/state.js';
import type { Verb } from '../../src/types/index.js';

// Mock fs/promises
vi.mock('fs/promises', async () => {
  const { vol } = await import('memfs');
  return {
    default: vol.promises,
    ...vol.promises
  };
});

// Mock os.homedir
vi.mock('os', () => ({
  default: {
    homedir: () => '/home/test'
  },
  homedir: () => '/home/test'
}));

describe('Container Verbs Integration', () => {
  let stateManager: StateManager;

  beforeEach(async () => {
    vol.reset();
    stateManager = new StateManager();
    await stateManager.init();
  });

  afterEach(() => {
    vol.reset();
  });

  it('should create and store container verbs with subverbs', async () => {
    const subverbs: Verb[] = [
      {
        name: 'keyboard-1',
        description: 'Logitech Mechanical Keyboard',
        type: 'navigate',
        target: 'https://example.com/product/1'
      },
      {
        name: 'keyboard-2',
        description: 'Microsoft Ergonomic Keyboard',
        type: 'navigate',
        target: 'https://example.com/product/2'
      }
    ];

    const containerVerb: Verb = {
      name: 'products',
      description: 'View keyboard products',
      type: 'navigate',
      subverbs
    };

    await stateManager.setTab('test-tab', {
      current_url: 'https://example.com/products',
      last_updated: new Date().toISOString(),
      verb_cache_expires: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      verb_cache: {
        'products': containerVerb,
        'next-page': {
          name: 'next-page',
          description: 'Go to next page',
          type: 'navigate',
          target: 'https://example.com/products?page=2'
        }
      }
    });

    const tab = stateManager.getTab('test-tab');
    expect(tab).toBeDefined();
    expect(tab!.verb_cache).toBeDefined();
    expect(tab!.verb_cache!['products']).toBeDefined();
    expect(tab!.verb_cache!['products'].subverbs).toHaveLength(2);
  });

  it('should retrieve subverbs from container', async () => {
    const containerVerb: Verb = {
      name: 'products',
      description: 'View products',
      type: 'navigate',
      subverbs: [
        {
          name: 'logitech',
          description: 'Logitech Keyboard',
          type: 'navigate',
          target: 'https://example.com/product/logitech'
        },
        {
          name: 'microsoft',
          description: 'Microsoft Keyboard',
          type: 'navigate',
          target: 'https://example.com/product/microsoft'
        }
      ]
    };

    await stateManager.setTab('test-tab', {
      current_url: 'https://example.com',
      last_updated: new Date().toISOString(),
      verb_cache: {
        'products': containerVerb
      }
    });

    const tab = stateManager.getTab('test-tab');
    const products = tab!.verb_cache!['products'];

    expect(products.subverbs).toBeDefined();
    expect(products.subverbs).toHaveLength(2);

    const logitechVerb = products.subverbs!.find(v => v.name === 'logitech');
    expect(logitechVerb).toBeDefined();
    expect(logitechVerb!.target).toBe('https://example.com/product/logitech');
    expect(logitechVerb!.type).toBe('navigate');
  });

  it('should support nested container structures', async () => {
    const containerVerb: Verb = {
      name: 'electronics',
      description: 'Electronics category',
      type: 'navigate',
      subverbs: [
        {
          name: 'keyboards',
          description: 'Keyboards',
          type: 'navigate',
          subverbs: [
            {
              name: 'mechanical',
              description: 'Mechanical keyboards',
              type: 'navigate',
              target: 'https://example.com/keyboards/mechanical'
            },
            {
              name: 'wireless',
              description: 'Wireless keyboards',
              type: 'navigate',
              target: 'https://example.com/keyboards/wireless'
            }
          ]
        }
      ]
    };

    await stateManager.setTab('test-tab', {
      current_url: 'https://example.com',
      last_updated: new Date().toISOString(),
      verb_cache: {
        'electronics': containerVerb
      }
    });

    const tab = stateManager.getTab('test-tab');
    const electronics = tab!.verb_cache!['electronics'];

    expect(electronics.subverbs).toHaveLength(1);

    const keyboards = electronics.subverbs![0];
    expect(keyboards.name).toBe('keyboards');
    expect(keyboards.subverbs).toHaveLength(2);

    const mechanical = keyboards.subverbs!.find(v => v.name === 'mechanical');
    expect(mechanical).toBeDefined();
    expect(mechanical!.target).toBe('https://example.com/keyboards/mechanical');
  });

  it('should handle mix of container and regular verbs', async () => {
    await stateManager.setTab('test-tab', {
      current_url: 'https://example.com',
      last_updated: new Date().toISOString(),
      verb_cache: {
        'home': {
          name: 'home',
          description: 'Go to homepage',
          type: 'navigate',
          target: 'https://example.com'
        },
        'products': {
          name: 'products',
          description: 'Product selection',
          type: 'navigate',
          subverbs: [
            {
              name: 'item-1',
              description: 'Product 1',
              type: 'navigate',
              target: 'https://example.com/product/1'
            }
          ]
        },
        'search': {
          name: 'search',
          description: 'Search products',
          type: 'form',
          params: ['query'],
          target: '/search'
        }
      }
    });

    const tab = stateManager.getTab('test-tab');
    const verbs = Object.values(tab!.verb_cache!);

    expect(verbs).toHaveLength(3);

    const homeVerb = verbs.find(v => v.name === 'home');
    expect(homeVerb!.subverbs).toBeUndefined();

    const productsVerb = verbs.find(v => v.name === 'products');
    expect(productsVerb!.subverbs).toHaveLength(1);

    const searchVerb = verbs.find(v => v.name === 'search');
    expect(searchVerb!.type).toBe('form');
    expect(searchVerb!.subverbs).toBeUndefined();
  });

  it('should persist container verbs across save/load cycles', async () => {
    const containerVerb: Verb = {
      name: 'menu',
      description: 'Navigation menu',
      type: 'navigate',
      subverbs: [
        {
          name: 'about',
          description: 'About page',
          type: 'navigate',
          target: '/about'
        },
        {
          name: 'contact',
          description: 'Contact page',
          type: 'navigate',
          target: '/contact'
        }
      ]
    };

    await stateManager.setTab('persist-test', {
      current_url: 'https://example.com',
      last_updated: new Date().toISOString(),
      verb_cache: {
        'menu': containerVerb
      }
    });

    // Create new state manager to simulate reload
    const stateManager2 = new StateManager();
    await stateManager2.init();

    const tab = stateManager2.getTab('persist-test');
    expect(tab).toBeDefined();
    expect(tab!.verb_cache!['menu'].subverbs).toHaveLength(2);
    expect(tab!.verb_cache!['menu'].subverbs![0].name).toBe('about');
  });
});
