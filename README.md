# web-cli

> ⚠ This project was made just to satisfy a curiosity and is almost entirely vibecoded! You've been warned.

Bootleg browser-use! A CLI tool for AI-friendly web navigation using text-based browsing. Built by Claude Code for Claude Code.

## Prerequisites

Either [install Nix >=v2.31.0](https://nixos.org/download/), or

- Node.js 22+
- `links` text browser (install via `brew install links` or `apt install links`)
- Anthropic API key for LLM-enhanced parsing

## Quick Start

```bash
# Clone and setup
git clone <repo>
cd web-cli
pnpm install

# Set up environment (optional but recommended)
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY

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

## Environment Variables

- `ANTHROPIC_API_KEY` - (Recommended) Enable LLM-enhanced parsing and execution
  - Get your key from: https://console.anthropic.com/

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
- [ ] Handle form submissions with parameters
- [ ] Add search/filter helpers
- [ ] Better error messages
- [ ] Tests
- [ ] Package for npm
- [ ] Support for POST requests
- [ ] Better LLM prompt engineering

## License

MIT
