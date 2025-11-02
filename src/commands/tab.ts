import { Command } from 'commander';
import { stateManager } from '../lib/state.js';
import { browser } from '../lib/browser.js';
import { htmlParser } from '../lib/parser.js';
import { llmParser } from '../lib/llm-parser.js';
import { Verb, ExecutionPlan } from '../types/index.js';

export function createTabCommand(): Command {
  const tab = new Command('tab')
    .description('Interact with a named tab')
    .argument('<name>', 'Tab name')
    .argument('[verb]', 'Action to perform (optional - omit to see current state)')
    .argument('[params...]', 'Parameters for the verb')
    .option('--use-llm', 'Force LLM parsing instead of HTML parsing')
    .option('--json', 'Output as JSON')
    .action(async (name: string, verb?: string, params?: string[], options?: { useLlm?: boolean; json?: boolean }) => {
      try {
        await stateManager.init();

        // Initialize LLM parser (loads API key from env)
        await llmParser.init();

        const tabData = stateManager.getTab(name);
        if (!tabData) {
          console.error(`Error: Tab "${name}" does not exist`);
          console.error(`Use "web-cli nav <url> ${name}" to create it`);
          process.exit(1);
        }

        // If no verb provided, show current state and available verbs
        if (!verb) {
          // Check if we have cached verbs that are still valid
          const now = new Date();
          const cacheExpires = tabData.verb_cache_expires ? new Date(tabData.verb_cache_expires) : null;
          const cacheValid = cacheExpires && now < cacheExpires;

          let verbs: Verb[] = [];
          let result; // Will be populated if we need to fetch

          if (cacheValid && tabData.verb_cache && !options?.useLlm) {
            // Use cached verbs (skip fetch)
            verbs = Object.values(tabData.verb_cache);
          } else {
            // Need to fetch page for parsing
            result = await browser.fetch(tabData.current_url);

            // Parse page to extract verbs
            if (options?.useLlm && llmParser.isAvailable()) {
              console.log('Parsing with LLM...');
              verbs = await llmParser.parse(result.text, result.url, undefined, result.html);
            } else {
              // Use HTML parser
              const parsed = htmlParser.parse(result.html, result.text, result.url);
              verbs = parsed.verbs;

              // Note: Use --use-llm flag to force LLM parsing if HTML parser finds insufficient verbs
            }

            // Cache the verbs (expire in 5 minutes)
            const verbCache: Record<string, Verb> = {};
            verbs.forEach(v => verbCache[v.name] = v);
            await stateManager.updateTab(name, {
              verb_cache: verbCache,
              verb_cache_expires: new Date(Date.now() + 5 * 60 * 1000).toISOString()
            });
          }

          // Output results
          if (options?.json) {
            console.log(JSON.stringify({
              tab: name,
              url: tabData.current_url,
              last_updated: tabData.last_updated,
              verbs: verbs
            }, null, 2));
          } else {
            console.log(`Tab: ${name}`);
            console.log(`URL: ${tabData.current_url}`);
            console.log(`Last updated: ${tabData.last_updated}`);

            // Show page preview if we fetched it
            if (result) {
              console.log('\nPage preview (first 500 chars):\n');
              console.log(result.text.substring(0, 500));
              console.log('\n...\n');
            } else if (cacheValid) {
              console.log('\n[Using cached verbs - run again to refresh]\n');
            }

            if (verbs.length === 0) {
              console.log('No verbs found on this page.');
            } else {
              console.log(`\nAvailable verbs (${verbs.length}):\n`);
              verbs.forEach(v => {
                const params = v.params && v.params.length > 0 ? ` <${v.params.join('> <')}>` : '';

                // Check if this is a container
                if (v.subverbs && v.subverbs.length > 0) {
                  console.log(`  📦 ${v.name} (${v.subverbs.length} items)`);
                  console.log(`    ${v.description}`);
                  console.log(`    Use: web-cli tab ${name} ${v.name} <item>`);
                  console.log();
                } else {
                  // Regular verb - add determinism indicator
                  const isDeterministic = v.type === 'navigate' && v.target;
                  const indicator = isDeterministic ? '✅' : '⚠️ ';
                  console.log(`  ${indicator} ${v.name}${params}`);
                  console.log(`    ${v.description}`);
                  console.log();
                }
              });
              console.log('Legend: ✅ = deterministic, ⚠️  = non-deterministic, 📦 = container');
            }
          }
          return;
        }

        // Execute verb - handle both flat verbs and container.subverb syntax
        let cachedVerb = tabData.verb_cache?.[verb];
        let actualVerb = verb;

        // Check if this is a container being called
        if (cachedVerb?.subverbs && cachedVerb.subverbs.length > 0) {
          if (!params || params.length === 0) {
            // Container called without subverb - show subverbs
            console.log(`Container "${verb}" has ${cachedVerb.subverbs.length} subverb(s):\n`);
            cachedVerb.subverbs.forEach(sv => {
              const svParams = sv.params && sv.params.length > 0 ? ` <${sv.params.join('> <')}>` : '';
              const isDeterministic = sv.type === 'navigate' && sv.target;
              const indicator = isDeterministic ? '✅' : '⚠️ ';
              console.log(`  ${indicator} ${sv.name}${svParams}`);
              console.log(`    ${sv.description}`);
              console.log();
            });
            console.log(`\nUsage: web-cli tab ${name} ${verb} <subverb-name>`);
            return;
          } else {
            // Container called with params - parse as subverb
            const subverbName = params[0];
            const subverb = cachedVerb.subverbs.find(sv => sv.name === subverbName);

            if (subverb) {
              cachedVerb = subverb;
              actualVerb = `${verb}.${subverbName}`;
              params = params.slice(1); // Remove subverb name from params
            } else {
              console.error(`Error: Subverb "${subverbName}" not found in container "${verb}"`);
              console.error(`Run "web-cli tab ${name} ${verb}" to see available subverbs`);
              process.exit(1);
            }
          }
        }

        if (!cachedVerb) {
          console.error(`Error: Verb "${verb}" not found`);
          console.error(`Run "web-cli tab ${name}" to see available verbs`);
          process.exit(1);
        }

        console.log(`Executing: ${cachedVerb.description}\n`);

        let executionPlan: ExecutionPlan | null | undefined;

        // Check if verb has deterministic target (URL for navigation)
        if (cachedVerb.type === 'navigate' && cachedVerb.target) {
          // Deterministic execution - use cached URL directly
          console.log('[Deterministic - using cached URL]\n');
          executionPlan = {
            method: 'navigate',
            target_url: cachedVerb.target,
            description: `Navigate to ${cachedVerb.target}`
          };
        } else {
          // Non-deterministic - need LLM execution planning
          console.log('[Non-deterministic - using LLM for execution planning]\n');

          // Check for cached execution plan
          const planCacheKey = `${verb}@${tabData.current_url}`;
          executionPlan = tabData.execution_plan_cache?.[planCacheKey];

          if (executionPlan) {
            console.log('[Using cached execution plan]');
          } else {
            // Need to fetch page for execution planning
            const result = await browser.fetch(tabData.current_url);

            // Generate execution plan
            executionPlan = await llmParser.planExecution(cachedVerb, result.html, tabData.current_url);

            if (!executionPlan) {
              console.error('Could not generate execution plan for this verb');
              console.error('Try running with ANTHROPIC_API_KEY set for smarter execution');
              process.exit(1);
            }

            // Cache the execution plan
            const planCache = tabData.execution_plan_cache || {};
            planCache[planCacheKey] = executionPlan;
            await stateManager.updateTab(name, {
              execution_plan_cache: planCache
            });
          }

          console.log(`Plan: ${executionPlan.description}\n`);
        }

        // Execute based on method
        if (executionPlan.method === 'navigate' && executionPlan.target_url) {
          // Normalize URL (handle relative URLs)
          let targetUrl = executionPlan.target_url;
          if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
            // Relative URL - resolve against current URL
            try {
              const currentUrlObj = new URL(tabData.current_url);
              targetUrl = new URL(targetUrl, currentUrlObj.origin).href;
            } catch (err) {
              console.error('Error resolving relative URL:', err);
              process.exit(1);
            }
          }

          console.log(`Navigating to: ${targetUrl}`);

          // Fetch the new page
          const newResult = await browser.fetch(targetUrl);

          // Update tab state
          await stateManager.updateTab(name, {
            current_url: targetUrl,
            last_updated: new Date().toISOString(),
            verb_cache: undefined, // Clear verb cache, page changed
            verb_cache_expires: undefined,
            execution_plan_cache: undefined // Clear execution plan cache, page changed
          });

          console.log('\n✓ Navigation complete\n');
          console.log('Page preview (first 500 chars):\n');
          console.log(newResult.text.substring(0, 500));
          console.log('\n...\n');
          console.log(`Run "web-cli tab ${name}" to see available verbs on this page`);
        } else {
          console.error(`Execution method "${executionPlan.method}" not yet implemented`);
          console.error('Only navigation is currently supported');
          process.exit(1);
        }
      } catch (err) {
        console.error('Error:', err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });

  return tab;
}
