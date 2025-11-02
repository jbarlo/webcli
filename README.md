# web-cli

> ⚠ This project was made just to satisfy a curiosity and is almost entirely vibecoded! You've been warned.

Bootleg browser-use! A CLI tool for AI-friendly web navigation using text-based browsing. Built by Claude Code for Claude Code.

## Prerequisites

Either [install Nix >=v2.31.0](https://nixos.org/download/), or

- Node.js 22+
- `links` text browser (install via `brew install links` or `apt install links`)

## Quick Start

```bash
# Clone and setup
git clone <repo>
cd web-cli
pnpm install

# Build
pnpm build

# Navigate to a site
node dist/index.js nav "example.com" test

# View available actions
node dist/index.js tab test

# Execute an action
node dist/index.js tab test <verb-name>
```

## Using Just

```bash
# Install dependencies and build
just setup

# Run tests
just test-example
just test-amazon

# List all tabs
just list

# Clear a tab
just clear test
```

## Commands

### `nav <url> <name>`

Navigate to a URL and create/update a named tab.

```bash
node dist/index.js nav "amazon.com/s?k=keyboard" shop
```

### `tab <name> [verb] [params...]`

Interact with a named tab. Omit verb to see current state and available actions.

```bash
# View state and actions
node dist/index.js tab shop

# Execute an action
node dist/index.js tab shop select-product 1
```

Options:

- `--use-llm` - Force LLM parsing instead of HTML
- `--json` - Output as JSON for programmatic use

### `view <name>`

View the full page text content of a tab. Unlike `tab` which shows only a 500 character preview, this displays the complete page text.

```bash
# View full page text
node dist/index.js view shop

# Limit to first 100 lines
node dist/index.js view shop --limit 100

# Output as JSON
node dist/index.js view shop --json
```

Options:

- `--limit <n>` - Limit output to first N lines
- `--json` - Output as JSON for programmatic use

Use cases:
- Viewing product listings with prices
- Reading full page content
- Searching for specific information on a page
- Extracting data from tables or lists

### `list`

List all tabs.

```bash
node dist/index.js list
```

### `clear <name>`

Remove a named tab.

```bash
node dist/index.js clear shop
```

### `refine <name> [container] <guidance>`

Re-extract verbs with custom AI guidance to customize how the LLM interprets a page.

```bash
# Refine all verbs on a page
node dist/index.js refine shop "Focus only on keyboards under $100"

# Refine a specific container's subverbs
node dist/index.js refine shop products "Only mechanical keyboards with RGB"
```

Options:

- `--json` - Output as JSON for programmatic use

## How It Works

### Two-Phase Approach

**Phase 1: Verb Discovery**

1. Navigate to page with `links -dump` (gets clean text)
2. Extract verbs using:
   - HTML parser (cheerio) for simple sites
   - LLM parser (Claude) for complex/JS-heavy sites like Amazon
3. Cache discovered verbs for 5 minutes

**Phase 2: Verb Execution**

1. User selects a verb to execute
2. Fetch HTML source (automatically decompresses gzip)
3. LLM analyzes source + verb intent → generates execution plan
4. Execute navigation via `links` browser
5. Update tab state and show new page

### Key Features

- **Gzip Decompression** - Handles compressed HTML automatically
- **Cookie Support** - Maintained by `links` in `~/.links/cookies.txt`
- **Hybrid Parsing** - HTML parser for speed, LLM for accuracy
- **State Management** - Tabs stored in `~/.web-cli/tabs.json`
- **Smart Caching** - Verb cache expires after 5 minutes

## Development

```bash
# Install dependencies
pnpm install

# Build
pnpm build

# Watch mode
pnpm dev

# Type check
just typecheck
```

## State Files

- `~/.web-cli/tabs.json` - Tab state and cached verbs
- `~/.links/cookies.txt` - Browser cookies (managed by links)

## Example: Shopping on Amazon

```bash
# Search for keyboards
node dist/index.js nav "amazon.com/s?k=keyboard" shop

# See available products
node dist/index.js tab shop
# Output shows: select-product, filter-by-price, next-page, etc.

# Select first product
node dist/index.js tab shop select-product 1

# See product actions
node dist/index.js tab shop
# Output shows: add-to-cart, view-reviews, etc.

# Add to cart
node dist/index.js tab shop add-to-cart
```

## TODO

- [x] Gzip decompression for HTML source
- [x] Two-phase verb discovery and execution
- [x] Basic navigation execution
- [x] Add `view` command to see full page text
- [ ] Fix verb cache clearing on navigation (verbs are cleared when executing a verb that navigates, requiring re-refinement)
- [ ] Handle form submissions with parameters
- [ ] Add search/filter helpers
- [ ] Better error messages
- [ ] Tests
- [ ] Package for npm
- [ ] Support for POST requests
- [ ] Better LLM prompt engineering

## Known Issues

### Verb Cache Clears on Navigation

When you execute a verb that navigates to a new page, the verb cache is cleared. This means if you:

1. Refine a page to get custom verbs
2. Execute one of those verbs (which navigates)
3. Try to execute another verb from the original refinement

You'll get an error that the verb doesn't exist because the cache was cleared in step 2.

**Workaround**: After each navigation, re-refine or check available verbs with `tab <name>`.

**Example of the issue:**
```bash
# Start at home page
node dist/index.js nav "store.example.com" browse

# Refine to get verbs
node dist/index.js refine browse "show me electronics and books"
# Output: view-electronics, view-books

# Navigate using first verb
node dist/index.js tab browse view-electronics  # ✅ Works, navigates to electronics

# Try to use second verb from same refinement
node dist/index.js tab browse view-books  # ❌ Error: verb not found (cache cleared)

# Need to go back and refine again
node dist/index.js nav "store.example.com" browse
node dist/index.js refine browse "show me books section"
node dist/index.js tab browse view-books  # ✅ Now works
```

## License

MIT
