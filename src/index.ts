#!/usr/bin/env node

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { Command } from 'commander';

// Get the directory of this file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from project root (dist/ is one level deep from root)
config({ path: resolve(__dirname, '..', '.env') });

// Dynamic imports to ensure dotenv loads first
const { createNavCommand } = await import('./commands/nav.js');
const { createTabCommand } = await import('./commands/tab.js');
const { createClearCommand } = await import('./commands/clear.js');
const { createListCommand } = await import('./commands/list.js');
const { createRefineCommand } = await import('./commands/refine.js');

const program = new Command();

program
  .name('web-cli')
  .description('CLI tool for AI-friendly web navigation using text-based browsing')
  .version('0.1.0');

// Add commands
program.addCommand(createNavCommand());
program.addCommand(createTabCommand());
program.addCommand(createClearCommand());
program.addCommand(createListCommand());
program.addCommand(createRefineCommand());

// Parse arguments
program.parse();
