import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { TabsState, Tab } from '../types/index.js';

const STATE_DIR = path.join(os.homedir(), '.web-cli');
const STATE_FILE = path.join(STATE_DIR, 'tabs.json');

export class StateManager {
  private state: TabsState = {};

  async init(): Promise<void> {
    // Ensure state directory exists
    try {
      await fs.mkdir(STATE_DIR, { recursive: true });
    } catch (err) {
      // Directory might already exist
    }

    // Load existing state
    try {
      const data = await fs.readFile(STATE_FILE, 'utf-8');
      this.state = JSON.parse(data);
    } catch (err) {
      // File doesn't exist yet, start with empty state
      this.state = {};
    }
  }

  async save(): Promise<void> {
    await fs.writeFile(STATE_FILE, JSON.stringify(this.state, null, 2), 'utf-8');
  }

  getTab(name: string): Tab | undefined {
    return this.state[name];
  }

  async setTab(name: string, tab: Tab): Promise<void> {
    this.state[name] = tab;
    await this.save();
  }

  async updateTab(name: string, updates: Partial<Tab>): Promise<void> {
    const existing = this.state[name];
    if (!existing) {
      throw new Error(`Tab "${name}" does not exist`);
    }
    this.state[name] = { ...existing, ...updates };
    await this.save();
  }

  async deleteTab(name: string): Promise<void> {
    delete this.state[name];
    await this.save();
  }

  listTabs(): string[] {
    return Object.keys(this.state);
  }

  getAllTabs(): TabsState {
    return this.state;
  }
}

export const stateManager = new StateManager();
