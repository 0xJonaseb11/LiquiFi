#!/usr/bin/env bash
# Deploy all LiquiFi ink! contracts to a Substrate contracts node.
# Usage: ./deploy.sh [--network local|shibuya]

set -euo pipefail

NETWORK="${1:---network}"
NETWORK_VAL="${2:-local}"
NODE_URL="ws://127.0.0.1:9944"
SURI="//Alice"

if [ "$NETWORK_VAL" = "shibuya" ]; then
  NODE_URL="wss://rpc.shibuya.astar.network"
  SURI="${DEPLOYER_SURI:?Set DEPLOYER_SURI env var}"
fi

echo "═══════════════════════════════════════════"
echo "  🏦 LiquiFi ink! Contract Deployment"
echo "  Network: $NETWORK_VAL ($NODE_URL)"
echo "═══════════════════════════════════════════"

cd "$(dirname "$0")/.."

# Build all contracts
echo "📦 Building contracts..."
for contract in mock_wdot mock_usdc price_oracle interest_rate_model lending_pool xcm_liquidator; do
  echo "  Building $contract..."
  cargo contract build --manifest-path "contracts/$contract/Cargo.toml" --release 2>&1 | tail -1
done

echo "✅ All contracts built successfully"
echo ""
echo "To deploy manually with cargo-contract:"
echo "  cargo contract instantiate --manifest-path contracts/mock_wdot/Cargo.toml \\"
echo "    --constructor new --suri $SURI --url $NODE_URL"
echo ""
echo "Contract metadata (ABI) files are in:"
echo "  target/ink/<contract_name>/<contract_name>.json"
