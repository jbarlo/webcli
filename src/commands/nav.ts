import { Command } from "commander";
import { stateManager } from "../lib/state.js";
import { browser } from "../lib/browser.js";

export function createNavCommand(): Command {
  const nav = new Command("nav")
    .description("Navigate to a URL and create/update a named tab")
    .argument("<url>", "URL to navigate to")
    .argument("<name>", "Name for this tab")
    .option("--skip-cache", "Force refresh even if tab exists")
    .action(
      async (url: string, name: string, options: { skipCache?: boolean }) => {
        try {
          await stateManager.init();

          // Check if links is installed
          const installed = await browser.checkInstalled();
          if (!installed) {
            console.error("Error: links browser is not installed");
            console.error("Please install links to use web-cli");
            process.exit(1);
          }

          // Normalize URL (add https:// if missing)
          let normalizedUrl = url;
          if (!url.startsWith("http://") && !url.startsWith("https://")) {
            normalizedUrl = `https://${url}`;
          }

          console.log(`Navigating to ${normalizedUrl}...`);

          // Fetch the page
          const result = await browser.fetch(normalizedUrl);

          // Create/update tab
          await stateManager.setTab(name, {
            current_url: normalizedUrl,
            last_updated: new Date().toISOString(),
          });

          console.log(`✓ Tab "${name}" created/updated`);
          console.log(`\nCurrent page: ${normalizedUrl}`);
          console.log(`\nPage preview (first 500 chars):\n`);
          console.log(result.text.substring(0, 500));
          console.log("\n...\n");
          console.log(`\nUse "web-cli tab ${name}" to interact with this tab`);
        } catch (err) {
          console.error(
            "Error:",
            err instanceof Error ? err.message : String(err)
          );
          process.exit(1);
        }
      }
    );

  return nav;
}
