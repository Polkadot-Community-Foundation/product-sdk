#!/bin/bash
# Generate PAPI descriptors for all chains
# This fetches the latest metadata from live chains and generates TypeScript types

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CHAINS_DIR="$SCRIPT_DIR/../chains"

echo "Generating descriptors for all chains..."

for chain_dir in "$CHAINS_DIR"/*/; do
  chain_name=$(basename "$chain_dir")
  echo "→ Generating $chain_name..."

  cd "$chain_dir"
  npx papi generate
  cd - > /dev/null
done

echo "✓ All descriptors generated successfully"
