# List available commands
default:
    @just --list

# Install dependencies
install:
    pnpm install

# Build the project
build:
    pnpm run build

# Build and watch for changes
dev:
    pnpm run dev

# Run the CLI (after building)
run *ARGS:
    node dist/index.js {{ARGS}}

# Quick test - navigate to example.com
test-example:
    pnpm run build
    node dist/index.js nav example.com test
    node dist/index.js tab test

# Quick test - navigate to Amazon
test-amazon:
    pnpm run build
    node dist/index.js nav "amazon.com/s?k=keyboard" shop
    node dist/index.js tab shop

# List all tabs
list:
    node dist/index.js list

# Clear a tab
clear NAME:
    node dist/index.js clear {{NAME}}

# Clean build artifacts
clean:
    rm -rf dist/
    rm -rf node_modules/

# Clean state (remove all tabs)
clean-state:
    rm -rf ~/.web-cli/

# Full clean (build + state)
clean-all: clean clean-state

# Type check without building
typecheck:
    pnpm exec tsc --noEmit

# Format code (if we add prettier later)
fmt:
    @echo "No formatter configured yet"

# Install and build
setup: install build
