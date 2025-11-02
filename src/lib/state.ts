import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { TabsState, Tab } from '../types/index.js';

const STATE_DIR = path.join(os.homedir(), '.web-cli');
const TABS_DIR = path.join(STATE_DIR, 'tabs');

const TAB_NAME_PATTERN = /^[a-zA-Z0-9_-]{1,50}$/;

export function validateTabName(name: string): void {
  if (!TAB_NAME_PATTERN.test(name)) {
    throw new Error(
      `Invalid tab name "${name}". Tab names must be 1-50 characters and contain only letters, numbers, hyphens, and underscores.`
    );
  }
}

export class StateManager {
  private getTabPath(name: string): string {
    return path.join(TABS_DIR, `${name}.json`);
  }

  async init(): Promise<void> {
    // Ensure tabs directory exists
    await fs.mkdir(TABS_DIR, { recursive: true });
  }

  async getTab(name: string): Promise<Tab | undefined> {
    try {
      const data = await fs.readFile(this.getTabPath(name), 'utf-8');
      return JSON.parse(data);
    } catch (err) {
      // Tab file doesn't exist
      return undefined;
    }
  }

  async setTab(name: string, tab: Tab): Promise<void> {
    validateTabName(name);
    await fs.writeFile(this.getTabPath(name), JSON.stringify(tab, null, 2), 'utf-8');
  }

  async updateTab(name: string, updates: Partial<Tab>): Promise<void> {
    const existing = await this.getTab(name);
    if (!existing) {
      throw new Error(`Tab "${name}" does not exist`);
    }
    const updated = { ...existing, ...updates };
    await fs.writeFile(this.getTabPath(name), JSON.stringify(updated, null, 2), 'utf-8');
  }

  async deleteTab(name: string): Promise<void> {
    try {
      await fs.unlink(this.getTabPath(name));
    } catch (err) {
      // File might not exist, ignore
    }
  }

  async listTabs(): Promise<string[]> {
    try {
      const files = await fs.readdir(TABS_DIR);
      return files
        .filter(file => file.endsWith('.json'))
        .map(file => file.slice(0, -5)); // Remove .json extension
    } catch (err) {
      // Directory might not exist yet
      return [];
    }
  }

  async getAllTabs(): Promise<TabsState> {
    const tabNames = await this.listTabs();
    const tabs: TabsState = {};

    for (const name of tabNames) {
      const tab = await this.getTab(name);
      if (tab) {
        tabs[name] = tab;
      }
    }

    return tabs;
  }
}

export const stateManager = new StateManager();
