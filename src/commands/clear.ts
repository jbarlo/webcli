import { Command } from 'commander';
import { stateManager } from '../lib/state.js';

export function createClearCommand(): Command {
  const clear = new Command('clear')
    .description('Remove a named tab')
    .argument('<name>', 'Tab name to remove')
    .action(async (name: string) => {
      try {
        await stateManager.init();

        const tab = await stateManager.getTab(name);
        if (!tab) {
          console.error(`Error: Tab "${name}" does not exist`);
          process.exit(1);
        }

        await stateManager.deleteTab(name);
        console.log(`✓ Tab "${name}" removed`);
      } catch (err) {
        console.error('Error:', err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });

  return clear;
}
