import { Verb, ExecutionPlan } from "../types/index.js";
import * as cheerio from 'cheerio';

// Lazy load AI SDK dependencies
let generateObject: any;
let createAnthropic: any;
let z: any;

async function loadAIDeps() {
  if (!generateObject) {
    try {
      const aiModule = await import("ai");
      const anthropicModule = await import("@ai-sdk/anthropic");
      const zodModule = await import("zod");

      generateObject = aiModule.generateObject;
      createAnthropic = anthropicModule.createAnthropic;
      z = zodModule.z;
    } catch (err) {
      // Dependencies not installed
      return false;
    }
  }
  return true;
}

export class LLMParser {
  private model: any = null;
  private initialized = false;

  async init() {
    if (this.initialized) return;

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return;

    const loaded = await loadAIDeps();
    if (!loaded) return;

    try {
      const anthropic = createAnthropic({ apiKey });
      this.model = anthropic("claude-4-sonnet-20250514");
      this.initialized = true;
    } catch (err) {
      console.warn("Failed to initialize LLM parser:", err);
    }
  }

  isAvailable(): boolean {
    return this.model !== null;
  }

  /**
   * Extract all links from HTML
   */
  private extractLinks(html: string): string {
    const $ = cheerio.load(html);
    const links: string[] = [];

    $('a[href]').each((_, el) => {
      const $link = $(el);
      const href = $link.attr('href') || '';
      const text = $link.text().trim().replace(/\s+/g, ' ');

      // Only include links with meaningful text
      if (href && text && text.length > 1 && text.length < 200) {
        links.push(`${text} → ${href}`);
      }
    });

    // Remove duplicates and return
    return Array.from(new Set(links)).slice(0, 100).join('\n'); // Limit to first 100 links
  }

  /**
   * Use LLM to extract verbs from page text
   * Falls back to basic parsing if LLM is not available
   * @param guidance Optional custom guidance for verb extraction
   */
  async parse(text: string, url: string, guidance?: string, html?: string): Promise<Verb[]> {
    await this.init();

    if (!this.isAvailable()) {
      return [];
    }

    try {
      const VerbSchema: any = z.object({
        name: z
          .string()
          .describe('Short kebab-case verb name (e.g., "add-to-cart")'),
        description: z
          .string()
          .describe("Human-readable description with parameter info"),
        type: z.enum(["navigate", "form", "action"]).describe("Type of action"),
        params: z
          .array(z.string())
          .optional()
          .describe("Parameter names if needed"),
        target: z
          .string()
          .optional()
          .describe("For navigate type: the full target URL. For others: CSS selector or identifier."),
        subverbs: z
          .array(z.lazy(() => VerbSchema))
          .optional()
          .describe("Optional: group similar verbs under this parent (use when 10+ similar items exist)"),
      });

      const ParsedPageSchema = z.object({
        verbs: z
          .array(VerbSchema)
          .describe("List of available actions on this page"),
      });

      // Extract links if HTML is provided
      const linksList = html ? this.extractLinks(html) : '';

      // Build prompt based on whether guidance is provided
      let prompt: string;
      if (guidance) {
        prompt = `You are analyzing a web page to extract available actions for a CLI tool.

URL: ${url}

Page content:
${text.substring(0, 4000)}

${linksList ? `Available links on page:\n${linksList}\n` : ''}

SPECIFIC GUIDANCE:
${guidance}

For each action:
- Create semantic, user-friendly verb names (kebab-case)
- For navigation actions, match the action to a link from the "Available links" list and use its URL as the target
- Set type="navigate" and include the full target URL
- If there are many similar items (10+), group them under a parent verb using subverbs for namespacing

Limit to the 10 most relevant top-level actions (containers can have more subverbs).`;
      } else {
        prompt = `You are analyzing a web page to extract the MOST IMPORTANT actions for a CLI automation tool.

URL: ${url}

Page content:
${text.substring(0, 4000)}

${linksList ? `Available links on page:\n${linksList}\n` : ''}

Focus on the critical 20% of actions that deliver 80% of value. PRIORITIZE:
1. Primary content actions (view product, select item, play video)
2. Transaction actions (add-to-cart, checkout, purchase)
3. Core navigation (next-page, previous, view-details)

IGNORE:
- Site-wide navigation (home, about, contact)
- Account/login links (unless login is the primary purpose)
- Footer/header boilerplate
- Social media links

For e-commerce sites: Focus on product selection, filtering, cart actions.
For content sites: Focus on reading, watching, downloading content.
For search results: Focus on selecting results, pagination, filtering.

For each action:
- Create semantic, user-friendly verb names (kebab-case)
- For navigation actions, match the action to a link from the "Available links" list and use its URL as the target
- Set type="navigate" and include the full target URL
- If there are many similar items (10+), group them under a parent verb using subverbs for namespacing

Limit to the 10 most impactful top-level actions (containers can have more subverbs).`;
      }

      const result = await generateObject({
        model: this.model,
        schema: ParsedPageSchema,
        prompt,
      });

      return result.object.verbs;
    } catch (err) {
      console.warn("LLM parsing failed:", err);
      return [];
    }
  }

  /**
   * @deprecated Use parse(text, url, guidance) instead
   * Parse page with custom guidance prompt
   * Allows for refined verb extraction with specific instructions
   */
  async parseWithGuidance(
    text: string,
    url: string,
    guidance: string
  ): Promise<Verb[]> {
    return this.parse(text, url, guidance);
  }

  /**
   * Convert HTML to markdown-like format, preserving links
   * This creates a much more compact and readable representation
   */
  private htmlToMarkdown(html: string): string {
    const $ = cheerio.load(html);

    // Remove script, style, and other non-content tags
    $('script, style, noscript, svg, iframe').remove();

    let markdown = '';

    // Extract all links with their text
    const links: string[] = [];
    $('a[href]').each((_, el) => {
      const $link = $(el);
      const href = $link.attr('href') || '';
      const text = $link.text().trim().replace(/\s+/g, ' '); // Normalize whitespace

      // Only include links with meaningful text
      if (href && text && text.length > 1 && text.length < 200) {
        links.push(`[${text}](${href})`);
      }
    });

    // Remove duplicate links (same text+href)
    const uniqueLinks = Array.from(new Set(links));

    // Join all links with newlines
    markdown = uniqueLinks.join('\n');

    return markdown.trim();
  }

  /**
   * Generate an execution plan for a verb
   * Analyzes HTML source to determine how to execute the action
   */
  async planExecution(
    verb: Verb,
    html: string,
    currentUrl: string
  ): Promise<ExecutionPlan | null> {
    await this.init();

    if (!this.isAvailable()) {
      // Fallback: simple navigation if target URL exists
      if (verb.target && verb.type === "navigate") {
        return {
          method: "navigate",
          target_url: verb.target,
          description: `Navigate to ${verb.target}`,
        };
      }
      return null;
    }

    try {
      const ExecutionPlanSchema = z.object({
        method: z
          .enum(["navigate", "form", "action"])
          .describe("Execution method"),
        target_url: z
          .string()
          .optional()
          .describe("URL to navigate to (for navigate method)"),
        command: z
          .string()
          .optional()
          .describe("Shell command to execute (if needed)"),
        description: z
          .string()
          .describe("Human-readable description of what will happen"),
      });

      // Convert HTML to markdown for cleaner, more compact representation
      const markdown = this.htmlToMarkdown(html);

      // For long pages, try to find the most relevant section based on verb name/description
      let contentToSend = markdown;
      if (markdown.length > 20000) {
        // Search for verb-related keywords
        const searchTerms = [
          verb.name.toLowerCase(),
          ...verb.description.toLowerCase().split(' ').filter(w => w.length > 4)
        ];

        let bestIndex = 0;
        let bestScore = 0;

        for (const term of searchTerms) {
          const index = markdown.toLowerCase().indexOf(term);
          if (index !== -1) {
            // Count how many terms appear near this index
            const start = Math.max(0, index - 5000);
            const end = Math.min(markdown.length, index + 5000);
            const window = markdown.substring(start, end).toLowerCase();
            const score = searchTerms.filter(t => window.includes(t)).length;

            if (score > bestScore) {
              bestScore = score;
              bestIndex = index;
            }
          }
        }

        // Extract window around the best match
        if (bestScore > 0) {
          const start = Math.max(0, bestIndex - 5000);
          const end = Math.min(markdown.length, bestIndex + 15000); // 20k window total
          contentToSend = markdown.substring(start, end);
        } else {
          // Fallback: take first 20k
          contentToSend = markdown.substring(0, 20000);
        }
      }

      const prompt = `You are creating an execution plan for a web automation verb.

Current URL: ${currentUrl}

Verb to execute:
- Name: ${verb.name}
- Description: ${verb.description}
- Type: ${verb.type}
${verb.target ? `- Target: ${verb.target}` : ""}

Page content (markdown format with preserved links):
${contentToSend}

Generate an execution plan. For now, only support "navigate" method using the links browser.
If this is a navigation action, extract the target URL.
If you cannot determine how to execute this action, explain why in the description.`;

      const result = await generateObject({
        model: this.model,
        schema: ExecutionPlanSchema,
        prompt,
      });

      return result.object as ExecutionPlan;
    } catch (err) {
      console.warn("Execution planning failed:", err);
      return null;
    }
  }
}

export const llmParser = new LLMParser();
