import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { vol } from 'memfs';
import { StateManager } from '../../../src/lib/state.js';
import { createMockTab } from '../../helpers/mocks.js';

// Mock fs/promises to use memfs
vi.mock('fs/promises', async () => {
  const { vol } = await import('memfs');
  return {
    default: vol.promises,
    ...vol.promises
  };
});

// Mock os.homedir to return consistent test directory
vi.mock('os', () => ({
  default: {
    homedir: () => '/home/test'
  },
  homedir: () => '/home/test'
}));

describe('StateManager', () => {
  let stateManager: StateManager;
  const testStateDir = '/home/test/.web-cli';
  const testStateFile = `${testStateDir}/tabs.json`;

  beforeEach(async () => {
    // Reset memfs before each test
    vol.reset();

    // Create a new StateManager instance for each test
    stateManager = new StateManager();
  });

  afterEach(() => {
    vol.reset();
  });

  describe('init', () => {
    it('should create state directory if it does not exist', async () => {
      await stateManager.init();

      const stats = vol.statSync(testStateDir);
      expect(stats.isDirectory()).toBe(true);
    });

    it('should load existing state from file', async () => {
      const existingState = {
        'test-tab': createMockTab({ current_url: 'https://example.com/test' })
      };

      vol.mkdirSync(testStateDir, { recursive: true });
      vol.writeFileSync(testStateFile, JSON.stringify(existingState));

      await stateManager.init();

      const tab = stateManager.getTab('test-tab');
      expect(tab).toBeDefined();
      expect(tab?.current_url).toBe('https://example.com/test');
    });

    it('should start with empty state if file does not exist', async () => {
      await stateManager.init();

      expect(stateManager.listTabs()).toEqual([]);
    });
  });

  describe('setTab', () => {
    beforeEach(async () => {
      await stateManager.init();
    });

    it('should create a new tab', async () => {
      const tab = createMockTab({ current_url: 'https://example.com/new' });

      await stateManager.setTab('new-tab', tab);

      const retrieved = stateManager.getTab('new-tab');
      expect(retrieved).toEqual(tab);
    });

    it('should overwrite existing tab', async () => {
      const tab1 = createMockTab({ current_url: 'https://example.com/1' });
      const tab2 = createMockTab({ current_url: 'https://example.com/2' });

      await stateManager.setTab('tab', tab1);
      await stateManager.setTab('tab', tab2);

      const retrieved = stateManager.getTab('tab');
      expect(retrieved?.current_url).toBe('https://example.com/2');
    });

    it('should persist to filesystem', async () => {
      const tab = createMockTab({ current_url: 'https://example.com/persist' });

      await stateManager.setTab('persist-tab', tab);

      const fileContents = vol.readFileSync(testStateFile, 'utf-8') as string;
      const parsed = JSON.parse(fileContents);
      expect(parsed['persist-tab'].current_url).toBe('https://example.com/persist');
    });
  });

  describe('updateTab', () => {
    beforeEach(async () => {
      await stateManager.init();
    });

    it('should update existing tab with partial data', async () => {
      const tab = createMockTab({
        current_url: 'https://example.com/original'
      });

      await stateManager.setTab('update-tab', tab);
      await stateManager.updateTab('update-tab', {
        current_url: 'https://example.com/updated'
      });

      const retrieved = stateManager.getTab('update-tab');
      expect(retrieved?.current_url).toBe('https://example.com/updated');
      expect(retrieved?.last_updated).toBe(tab.last_updated);
    });

    it('should throw error if tab does not exist', async () => {
      await expect(
        stateManager.updateTab('nonexistent', { current_url: 'https://example.com' })
      ).rejects.toThrow('Tab "nonexistent" does not exist');
    });
  });

  describe('deleteTab', () => {
    beforeEach(async () => {
      await stateManager.init();
    });

    it('should delete existing tab', async () => {
      const tab = createMockTab();
      await stateManager.setTab('delete-me', tab);

      await stateManager.deleteTab('delete-me');

      expect(stateManager.getTab('delete-me')).toBeUndefined();
    });

    it('should persist deletion to filesystem', async () => {
      const tab = createMockTab();
      await stateManager.setTab('delete-me', tab);

      await stateManager.deleteTab('delete-me');

      const fileContents = vol.readFileSync(testStateFile, 'utf-8') as string;
      const parsed = JSON.parse(fileContents);
      expect(parsed['delete-me']).toBeUndefined();
    });
  });

  describe('listTabs', () => {
    beforeEach(async () => {
      await stateManager.init();
    });

    it('should return empty array when no tabs', async () => {
      expect(stateManager.listTabs()).toEqual([]);
    });

    it('should return all tab names', async () => {
      await stateManager.setTab('tab1', createMockTab());
      await stateManager.setTab('tab2', createMockTab());
      await stateManager.setTab('tab3', createMockTab());

      const names = stateManager.listTabs();
      expect(names).toHaveLength(3);
      expect(names).toContain('tab1');
      expect(names).toContain('tab2');
      expect(names).toContain('tab3');
    });
  });

  describe('getAllTabs', () => {
    beforeEach(async () => {
      await stateManager.init();
    });

    it('should return empty object when no tabs', async () => {
      expect(stateManager.getAllTabs()).toEqual({});
    });

    it('should return all tabs', async () => {
      const tab1 = createMockTab({ current_url: 'https://example.com/1' });
      const tab2 = createMockTab({ current_url: 'https://example.com/2' });

      await stateManager.setTab('tab1', tab1);
      await stateManager.setTab('tab2', tab2);

      const all = stateManager.getAllTabs();
      expect(all).toHaveProperty('tab1');
      expect(all).toHaveProperty('tab2');
      expect(all.tab1).toEqual(tab1);
      expect(all.tab2).toEqual(tab2);
    });
  });
});
