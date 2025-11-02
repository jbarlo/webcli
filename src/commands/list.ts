import { Command } from 'commander';
import { stateManager } from '../lib/state.js';

export function createListCommand(): Command {
  const list = new Command('list')
    .description('List all tabs')
    .action(async () => {
      try {
        await stateManager.init();

        const tabs = stateManager.getAllTabs();
        const names = Object.keys(tabs);

        if (names.length === 0) {
          console.log('No tabs found');
          console.log('Use "web-cli nav <url> <name>" to create a tab');
          return;
        }

        console.log(`Found ${names.length} tab(s):\n`);
        for (const name of names) {
          const tab = tabs[name];
          console.log(`  ${name}`);
          console.log(`    URL: ${tab.current_url}`);
          console.log(`    Updated: ${new Date(tab.last_updated).toLocaleString()}`);
          console.log();
        }
      } catch (err) {
        console.error('Error:', err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });

  return list;
}
