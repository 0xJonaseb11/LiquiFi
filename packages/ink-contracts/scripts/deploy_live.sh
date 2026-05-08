#!/usr/bin/env bash
set -euo pipefail

# Load environment variables
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

SURI="${DEPLOYER_SURI:?Set DEPLOYER_SURI in .env}"
NODE_URL="wss://rpc1.popnetwork.io"

echo "🚀 Starting Pop Network (Paseo) Deployment..."

# 1. Build All
echo "📦 Building all contracts..."
for c in mock_wdot mock_usdc price_oracle interest_rate_model lending_pool xcm_liquidator; do
  echo "  Building $c..."
  cargo contract build --manifest-path "contracts/$c/Cargo.toml" --release --quiet
done

deploy_contract() {
  local name=$1
  shift
  echo "🎬 Deploying $name..."
  local output=$(cargo contract instantiate --manifest-path "contracts/$name/Cargo.toml" \
    --suri "$SURI" --url "$NODE_URL" --args "$@" -y --quiet --skip-confirm)
  
  # Extract address (this regex depends on cargo-contract output format)
  local addr=$(echo "$output" | grep -oE "0x[a-fA-F0-9]{64}" | head -1 || echo "")
  if [ -z "$addr" ]; then
    # Some versions might output SS58 or different format, let's try a broader search if hex fails
    addr=$(echo "$output" | grep "Contract ID:" | awk '{print $NF}' || echo "")
  fi
  echo "$addr"
}

# 2. Deploy Dependencies
WDOT_ADDR=$(deploy_contract "mock_wdot")
echo "  MockWDOT: $WDOT_ADDR"

USDC_ADDR=$(deploy_contract "mock_usdc")
echo "  MockUSDC: $USDC_ADDR"

ORACLE_ADDR=$(deploy_contract "price_oracle")
echo "  PriceOracle: $ORACLE_ADDR"

# Seed initial prices
echo "🎯 Seeding initial prices..."
cargo contract call --contract "$ORACLE_ADDR" --message set_price --args "$WDOT_ADDR" 200000000000 --suri "$SURI" --url "$NODE_URL" -y
cargo contract call --contract "$ORACLE_ADDR" --message set_price --args "$USDC_ADDR" 100000000 --suri "$SURI" --url "$NODE_URL" -y

IRM_ADDR=$(deploy_contract "interest_rate_model" "20000000000000000" "100000000000000000" "800000000000000000" "800000000000000000" "20000000000000000")
echo "  IRM: $IRM_ADDR"

# 3. Deploy Core
POOL_ADDR=$(deploy_contract "lending_pool" "$WDOT_ADDR" "$USDC_ADDR" "$ORACLE_ADDR" "$IRM_ADDR" "750000000000000000" "500000000000000000" "50000000000000000")
echo "  LendingPool: $POOL_ADDR"

LIQUIDATOR_ADDR=$(deploy_contract "xcm_liquidator" "$POOL_ADDR")
echo "  XCM Liquidator: $LIQUIDATOR_ADDR"

echo "🎉 Deployment Complete!"
echo "WDOT: $WDOT_ADDR"
echo "USDC: $USDC_ADDR"
echo "Oracle: $ORACLE_ADDR"
echo "IRM: $IRM_ADDR"
echo "Pool: $POOL_ADDR"
echo "Liquidator: $LIQUIDATOR_ADDR"
