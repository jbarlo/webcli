import { Command } from 'commander';
import { stateManager } from '../lib/state.js';
import { browser } from '../lib/browser.js';

export function createViewCommand(): Command {
  const view = new Command('view')
    .description('View the full page text content of a tab')
    .argument('<name>', 'Name of the tab to view')
    .option('--limit <lines>', 'Limit output to first N lines', parseInt)
    .option('--json', 'Output as JSON')
    .action(async (name: string, options: { limit?: number; json?: boolean }) => {
      try {
        await stateManager.init();

        const tabData = await stateManager.getTab(name);
        if (!tabData) {
          console.error(`Error: Tab "${name}" does not exist`);
          console.error(`Use "web-cli nav <url> ${name}" to create it`);
          process.exit(1);
        }

        // Fetch the current page
        const result = await browser.fetch(tabData.current_url);

        // Output results
        if (options.json) {
          const output = {
            tab: name,
            url: tabData.current_url,
            last_updated: tabData.last_updated,
            text: options.limit
              ? result.text.split('\n').slice(0, options.limit).join('\n')
              : result.text,
            line_count: result.text.split('\n').length
          };
          console.log(JSON.stringify(output, null, 2));
        } else {
          console.log(`Tab: ${name}`);
          console.log(`URL: ${tabData.current_url}`);
          console.log(`Last updated: ${tabData.last_updated}`);
          console.log();
          console.log('─'.repeat(80));
          console.log();

          if (options.limit) {
            const lines = result.text.split('\n');
            console.log(lines.slice(0, options.limit).join('\n'));
            if (lines.length > options.limit) {
              console.log();
              console.log(`... (${lines.length - options.limit} more lines)`);
            }
          } else {
            console.log(result.text);
          }
        }
      } catch (err) {
        console.error('Error:', err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });

  return view;
}
