import { Command } from 'commander';
import { stateManager } from '../lib/state.js';
import { browser } from '../lib/browser.js';
import { llmParser } from '../lib/llm-parser.js';

export function createRefineCommand(): Command {
  const refine = new Command('refine')
    .description('Re-extract verbs with custom guidance prompt')
    .argument('<name>', 'Tab name')
    .argument('<arg1>', 'Container verb name OR guidance')
    .argument('[arg2]', 'Guidance (if arg1 is verb name)')
    .option('--json', 'Output as JSON')
    .action(async (name: string, arg1: string, arg2?: string | { json?: boolean }, arg3?: { json?: boolean }) => {
      // Parse arguments - handle both: refine <name> <guidance> and refine <name> <verb> <guidance>
      let containerVerb: string | undefined;
      let guidance: string;
      let options: { json?: boolean } | undefined;

      if (typeof arg2 === 'string') {
        // Three args: refine <name> <verb> <guidance>
        containerVerb = arg1;
        guidance = arg2;
        options = arg3;
      } else {
        // Two args: refine <name> <guidance>
        guidance = arg1;
        options = arg2;
      }
      try {
        await stateManager.init();

        const tabData = stateManager.getTab(name);
        if (!tabData) {
          console.error(`Error: Tab "${name}" does not exist`);
          console.error(`Use "web-cli nav <url> ${name}" to create it`);
          process.exit(1);
        }

        // Initialize LLM parser (loads API key from env)
        await llmParser.init();

        if (!llmParser.isAvailable()) {
          console.error('Error: LLM parser not available');
          console.error('Set ANTHROPIC_API_KEY in .env to use this feature');
          process.exit(1);
        }

        if (containerVerb) {
          // Scoped refine - update only the specified container's subverbs
          console.log(`Refining container "${containerVerb}" for tab "${name}" with guidance:`);
          console.log(`"${guidance}"\n`);

          // Find the container verb in cache
          const existingVerbs = tabData.verb_cache ? Object.values(tabData.verb_cache) : [];
          const container = existingVerbs.find(v => v.name === containerVerb);

          if (!container) {
            console.error(`Error: Container verb "${containerVerb}" not found`);
            console.error(`Run "web-cli tab ${name}" to see available verbs`);
            process.exit(1);
          }

          // Fetch current page
          const result = await browser.fetch(tabData.current_url);

          // Create scoped guidance that includes container context
          const scopedGuidance = `Extract items for the "${container.description}" category.\n\n${guidance}`;

          // Parse with scoped guidance
          const subverbs = await llmParser.parse(result.text, result.url, scopedGuidance, result.html);

          // Update the container's subverbs
          container.subverbs = subverbs;

          // Update cache with modified container
          const verbCache = tabData.verb_cache || {};
          verbCache[containerVerb] = container;
          await stateManager.updateTab(name, {
            verb_cache: verbCache,
            verb_cache_expires: new Date(Date.now() + 5 * 60 * 1000).toISOString()
          });

          console.log(`Updated container "${containerVerb}" with ${subverbs.length} subverb(s)\n`);

          if (subverbs.length === 0) {
            console.log('No subverbs found with this guidance.');
            return;
          }

          // Output results
          if (options?.json) {
            console.log(JSON.stringify({
              tab: name,
              container: containerVerb,
              guidance: guidance,
              subverbs: subverbs
            }, null, 2));
          } else {
            console.log(`Subverbs in "${containerVerb}":\n`);
            subverbs.forEach(v => {
              const params = v.params && v.params.length > 0 ? ` <${v.params.join('> <')}>` : '';
              const isDeterministic = v.type === 'navigate' && v.target;
              const indicator = isDeterministic ? '✅' : '⚠️ ';
              console.log(`  ${indicator} ${v.name}${params}`);
              console.log(`    ${v.description}`);
              console.log();
            });
          }
        } else {
          // Full tab refine - replace all verbs (existing behavior)
          console.log(`Refining verbs for "${name}" with guidance:`);
          console.log(`"${guidance}"\n`);

          // Fetch current page
          const result = await browser.fetch(tabData.current_url);

          // Parse with guidance
          const verbs = await llmParser.parse(result.text, result.url, guidance, result.html);

          if (verbs.length === 0) {
            console.log('No verbs found with this guidance.');
            return;
          }

          // Cache the new verbs
          const verbCache: Record<string, any> = {};
          verbs.forEach(v => verbCache[v.name] = v);
          await stateManager.updateTab(name, {
            verb_cache: verbCache,
            verb_cache_expires: new Date(Date.now() + 5 * 60 * 1000).toISOString()
          });

          // Output results
          if (options?.json) {
            console.log(JSON.stringify({
              tab: name,
              url: tabData.current_url,
              guidance: guidance,
              verbs: verbs
            }, null, 2));
          } else {
            console.log(`Found ${verbs.length} refined verb(s):\n`);
            verbs.forEach(v => {
              const params = v.params && v.params.length > 0 ? ` <${v.params.join('> <')}>` : '';
              console.log(`  ${v.name}${params}`);
              console.log(`    ${v.description}`);
              console.log();
            });
            console.log(`✓ Verbs cached and ready to use with "web-cli tab ${name} <verb>"`);
          }
        }
      } catch (err) {
        console.error('Error:', err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });

  return refine;
}
