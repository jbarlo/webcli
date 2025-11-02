---
name: web-cli
description: AI-friendly text-based web navigation tool for interactive browsing. Use when navigating websites, shopping online, filling forms, or any multi-step web interaction. Handles stateful browsing with cookies, sessions, and complex JavaScript sites.
---

# web-cli Skill

You have access to `web-cli`, an AI-friendly text-based web navigation tool built specifically for Claude Code. This skill guides you on when and how to use it effectively.

## What is web-cli?

web-cli is a CLI tool that enables stateful, interactive web browsing using the `links` text browser with an AI-friendly verb-based interface. It uses Claude (via Anthropic API) to parse complex web pages and generate navigation plans.

## When to Use web-cli

Proactively use web-cli for:
- **Multi-step interactions**: Shopping, form submissions, sequential navigation
- **JavaScript-heavy sites**: Amazon, modern SPAs, complex web apps
- **Stateful browsing**: Tasks requiring cookies, sessions, login state, shopping carts
- **Any web navigation request**: Default to web-cli unless the task is purely reading static content

Use WebFetch only for:
- Simple content retrieval from static pages
- Reading documentation or articles (no interaction needed)

## Core Commands

### `nav <url> <tab-name>`
Navigate to a URL and create/update a named tab.

```bash
node dist/index.js nav "example.com" test
node dist/index.js nav "amazon.com/s?k=keyboard" shop
```

### `tab <tab-name> [verb] [params...]`
Interact with a tab. Omit verb to see current state and available actions.

```bash
# View current state and discovered verbs
node dist/index.js tab shop

# Execute a verb
node dist/index.js tab shop select-product 1
```

**Important flags**:
- `--json`: Always use when you need to parse output programmatically
- `--use-llm`: Use proactively for known complex sites (Amazon, SPAs, JS-heavy pages)

### `view <tab-name>`
View the full page text content of a tab. Unlike `tab` which shows only a 500 character preview, this displays the complete page text.

```bash
# View full page text
node dist/index.js view shop

# Limit to first 100 lines
node dist/index.js view shop --limit 100

# Output as JSON
node dist/index.js view shop --json
```

**Use cases**:
- Viewing product listings with prices
- Reading full page content (articles, documentation)
- Searching for specific information on a page
- Extracting data from tables or lists

**Important flags**:
- `--limit <n>`: Limit output to first N lines (useful for large pages)
- `--json`: Output as JSON with metadata

### `list`
List all existing tabs (run this before starting to check for existing sessions).

```bash
node dist/index.js list
```

### `clear <tab-name>`
Remove a tab when done with a browsing session.

```bash
node dist/index.js clear shop
```

### `refine <tab-name> [container-verb] <guidance>`
Re-extract verbs with custom AI guidance to customize how the LLM interprets a page.

**Mode 1: Full tab refinement** (replaces all verbs)
```bash
node dist/index.js refine shop "Focus only on keyboards under $100, ignore accessories"
```

**Mode 2: Scoped refinement** (updates specific container's subverbs)
```bash
node dist/index.js refine shop products "Only extract mechanical keyboards with RGB lighting"
```

**Important flags**:
- `--json`: Output results as JSON

## Verb Indicators

When viewing verbs, you'll see these indicators:
- **✅** = Deterministic (has target URL, executes directly without LLM)
- **⚠️** = Non-deterministic (requires LLM execution planning)
- **📦** = Container (has subverbs for organizing similar actions)

## Subverbs & Containers

**Subverbs** are a namespacing mechanism for organizing similar actions under a parent container verb. They automatically group related items when there are many similar actions (10+ items).

**Example**: An Amazon search results page might have:
- Container: `products` 📦 (contains 20 product subverbs)
  - Subverb: `logitech-mx-keys`
  - Subverb: `microsoft-ergonomic`
  - Subverb: `apple-magic-keyboard`

**Accessing subverbs**:
```bash
# View container contents
node dist/index.js tab shop products

# Execute a specific subverb
node dist/index.js tab shop products logitech-mx-keys
```

## Refinement

Use the `refine` command to customize how the LLM extracts verbs from a page. This is useful when:
- Initial extraction missed relevant actions
- Too many irrelevant verbs need filtering
- You need domain-specific interpretation or filtering

**Full tab refinement** replaces all verbs:
```bash
node dist/index.js refine shop "Focus only on keyboards under $100, ignore accessories"
```

**Scoped refinement** updates only a specific container's subverbs:
```bash
node dist/index.js refine shop products "Only extract mechanical keyboards with RGB lighting"
```

## Standard Workflow

1. **Check existing tabs**: `node dist/index.js list`
2. **Navigate**: `node dist/index.js nav "url" descriptive-name [--use-llm]`
3. **View verbs**: `node dist/index.js tab descriptive-name [--json]`
4. **View full content** (if needed): `node dist/index.js view descriptive-name [--limit N]`
5. **Refine if needed**: `node dist/index.js refine descriptive-name [container] "guidance"`
6. **Execute verb**: `node dist/index.js tab descriptive-name verb-name [params...]`
7. **Repeat steps 3-6** as needed for multi-step interactions
8. **Clean up**: `node dist/index.js clear descriptive-name`

## Tab Management Best Practices

- **Descriptive names**: Use meaningful tab names like `shop`, `search`, `docs`, `checkout` rather than generic ones
- **Reuse for same domain**: Keep using the same tab name when continuing work on a site
- **Check before creating**: Run `list` to avoid duplicates or reuse existing sessions
- **Clean up when done**: Run `clear` commands after completing a browsing task

## Output Expectations

When using web-cli, you should:
1. **Show discovered verbs**: Display available actions after navigation
2. **Explain each step**: Narrate what you're doing ("Navigating to Amazon search results...", "Executing select-product verb...")
3. **Summarize page content**: Show key information (products found, form fields visible, page state)

## Common Patterns

### Shopping Workflow (Amazon, e-commerce)
```bash
# 1. Search
node dist/index.js nav "amazon.com/s?k=keyboard" shop --use-llm

# 2. View products and verbs
node dist/index.js tab shop --json
# Output shows: products 📦 (50 items), filters, next-page, etc.

# 3. Refine products to focus on specific criteria
node dist/index.js refine shop products "Only mechanical keyboards under $150 with wireless and RGB"

# 4. View refined products
node dist/index.js tab shop products --json

# 5. Select a specific product
node dist/index.js tab shop products logitech-mx-mechanical

# 6. View product details and actions
node dist/index.js tab shop --json

# 7. Add to cart
node dist/index.js tab shop add-to-cart

# 8. Clean up
node dist/index.js clear shop
```

### Form Filling Workflow
```bash
# 1. Navigate to form
node dist/index.js nav "example.com/contact" form

# 2. View form fields and verbs
node dist/index.js tab form --json

# 3. Fill fields (execute fill-* verbs)
node dist/index.js tab form fill-name "John Doe"
node dist/index.js tab form fill-email "john@example.com"

# 4. Submit
node dist/index.js tab form submit

# 5. Clean up
node dist/index.js clear form
```

## Best Practices & Learnings

### Use Verbs Instead of Direct URLs

**IMPORTANT**: Always prefer using discovered verbs over manually constructing URLs.

**❌ Don't do this:**
```bash
# Manually guessing URL paths
node dist/index.js nav "shop.example.com/products/dept-27/cat-449" browse
```

**✅ Do this instead:**
```bash
# 1. Navigate to home page
node dist/index.js nav "shop.example.com" browse

# 2. Refine to get relevant verbs
node dist/index.js refine browse "show me electronics section"

# 3. Use the discovered verbs
node dist/index.js tab browse view-electronics
```

**Why?** Manually constructed URLs often:
- Point to wrong category IDs
- Show incorrect or outdated content
- Break when site structure changes
- Miss authentication or session requirements

Discovered verbs are extracted from the actual page HTML and are guaranteed to work.

### Viewing Full Page Content

Use the `view` command to see complete page text (not just the 500 char preview):

```bash
# View full page
node dist/index.js view shop

# View with line limit for large pages
node dist/index.js view shop --limit 100

# Pipe to grep to find specific content
node dist/index.js view shop | grep -i "price"
```

This is essential for:
- Extracting product prices and details
- Finding specific information on pages
- Debugging what content is actually available

## Error Handling

If commands fail or verbs aren't discovered:

1. **Retry with --use-llm**: Try `--use-llm` flag if initial verb discovery fails
   ```bash
   node dist/index.js nav "complex-site.com" test --use-llm
   ```

2. **Use refine to get better verbs**: Instead of guessing URLs, refine to discover the right verbs
   ```bash
   node dist/index.js refine shop "show me the section I need"
   ```

3. **Check tab state**: If tab seems corrupted, suggest clearing and restarting
   ```bash
   node dist/index.js clear tab-name
   node dist/index.js nav "url" tab-name
   ```

4. **Ask user**: Stop and get user input rather than making assumptions about how to proceed

5. **Don't auto-fallback**: Don't silently fall back to WebFetch without explaining the issue

## Build Requirements

- Assume web-cli is already built unless there's a reason to rebuild
- Only run `pnpm build` or `just build` if:
  - User explicitly asks
  - You encounter errors suggesting outdated build
  - You made changes to source code

## Environment

- Uses Claude Agent SDK for LLM operations (no API key setup needed)
- State stored in `~/.web-cli/tabs.json`
- Cookies managed by `links` in `~/.links/cookies.txt`

## Key Features to Leverage

- **Stateful navigation**: Cookies persist across commands in the same tab
- **Verb caching**: Discovered verbs are cached for 5 minutes
- **Hybrid parsing**: HTML parser for simple sites, LLM for complex ones
- **Gzip handling**: Automatically decompresses HTML sources
