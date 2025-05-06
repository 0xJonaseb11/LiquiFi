import dotenv from "dotenv";
dotenv.config();

/**
 * Centralized configuration loaded from environment variables.
 * All sensitive values come from .env — never hardcode keys.
 */
export const config = {
  // RPC & Chain
  rpcUrl: process.env.RPC_URL || "http://127.0.0.1:8545",
  chainId: parseInt(process.env.CHAIN_ID || "31337"),

  // Wallet
  privateKey: process.env.PRIVATE_KEY || "",

  // Contract Addresses
  contracts: {
    lendingPool: process.env.LENDING_POOL_ADDRESS || "",
    priceOracle: process.env.PRICE_ORACLE_ADDRESS || "",
    weth: process.env.WETH_ADDRESS || "",
    usdc: process.env.USDC_ADDRESS || "",
    crossChainLiquidator: process.env.CROSS_CHAIN_LIQUIDATOR_ADDRESS || "",
  },

  // Liquidation Bot
  bot: {
    scanIntervalMs: parseInt(process.env.SCAN_INTERVAL_MS || "12000"),
    liquidationThreshold: parseFloat(process.env.LIQUIDATION_THRESHOLD || "1.0"),
    targetHealthFactor: parseFloat(process.env.TARGET_HEALTH_FACTOR || "1.1"),
    gasPriceBumpPercent: parseInt(process.env.GAS_PRICE_BUMP_PERCENT || "10"),
    maxGasPriceGwei: parseInt(process.env.MAX_GAS_PRICE_GWEI || "100"),
    txTimeoutMs: parseInt(process.env.TX_TIMEOUT_MS || "30000"),
  },

  // AI Service
  ai: {
    serviceUrl: process.env.AI_SERVICE_URL || "http://127.0.0.1:8000",
    updateIntervalMs: parseInt(process.env.AI_UPDATE_INTERVAL_MS || "60000"),
  },

  // Cross-Chain
  crossChain: {
    sourceChainId: parseInt(process.env.SOURCE_CHAIN_ID || "137"),
    bridgeTimeoutMs: parseInt(process.env.BRIDGE_TIMEOUT_MS || "300000"),
  },

  // Supabase
  supabase: {
    url: process.env.SUPABASE_URL || "",
    anonKey: process.env.SUPABASE_ANON_KEY || "",
  },
  // Polkadot / Astar config
  polkadot: {
    rpcUrl: process.env.POLKADOT_RPC_URL || "wss://rpc.shibuya.astar.network",
    seed: process.env.POLKADOT_SEED || "//Alice",
    contracts: {
      lendingPool: process.env.POLKADOT_LENDING_POOL || "",
      priceOracle: process.env.POLKADOT_PRICE_ORACLE || "",
      wdot: process.env.POLKADOT_WDOT || "",
      usdc: process.env.POLKADOT_USDC || "",
    },
  },
} as const;
