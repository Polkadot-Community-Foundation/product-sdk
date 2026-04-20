#!/bin/bash
# Build all chain descriptors
# Compiles TypeScript descriptors to JavaScript

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CHAINS_DIR="$SCRIPT_DIR/../chains"

echo "Building descriptors for all chains..."

for chain_dir in "$CHAINS_DIR"/*/; do
  chain_name=$(basename "$chain_dir")
  echo "→ Building $chain_name..."

  cd "$chain_dir"
  npx tsc --build
  cd - > /dev/null
done

echo "✓ All descriptors built successfully"
