/// <reference types="node" />
import * as chains from "viem/chains";

export type BaseConfig = {
  targetNetworks: readonly chains.Chain[];
  pollingInterval: number;
  alchemyApiKey: string;
  rpcOverrides?: Record<number, string>;
  walletConnectProjectId: string;
  burnerWalletMode: "localNetworksOnly" | "allNetworks" | "disabled";
};
export type PolkadotNetworkConfig = {
  rpcEndpoint: string;
  networkName: string;
  tokenSymbol: string;
  tokenDecimals: number;
  contractAddresses: Record<string, string>;
};
export type ScaffoldConfig = BaseConfig & {
  polkadotConfig?: PolkadotNetworkConfig;
};
export const DEFAULT_ALCHEMY_API_KEY = "cR4WnXePioePZ5fFrnSiR";
const scaffoldConfig = {
  targetNetworks: [chains.baseSepolia, chains.hardhat],
  pollingInterval: 3000,
  alchemyApiKey: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || DEFAULT_ALCHEMY_API_KEY,
  rpcOverrides: {},
  walletConnectProjectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || "3a8170812b534d0ff9d794f19a901d64",
  burnerWalletMode: "localNetworksOnly",
  polkadotConfig: {
    rpcEndpoint: process.env.NEXT_PUBLIC_POLKADOT_RPC || "wss://rpc.shibuya.astar.network",
    networkName: "Shibuya (Astar Testnet)",
    tokenSymbol: "SBY",
    tokenDecimals: 18,
    contractAddresses: {
      LendingPool: process.env.NEXT_PUBLIC_POLKADOT_LENDING_POOL || "",
      PriceOracle: process.env.NEXT_PUBLIC_POLKADOT_PRICE_ORACLE || "",
      InterestRateModel: process.env.NEXT_PUBLIC_POLKADOT_INTEREST_RATE_MODEL || "",
      MockWDOT: process.env.NEXT_PUBLIC_POLKADOT_MOCK_WDOT || "",
      MockUSDC: process.env.NEXT_PUBLIC_POLKADOT_MOCK_USDC || "",
    },
  },
} as const satisfies ScaffoldConfig;
/**
 * Convenience mapping for newly deployed Base Sepolia contracts
 */
export const CONTRACT_ADDRESSES = {
  baseSepolia: {
    LendingPool: {
      proxy: "0x3f061392F32819C0383817E94603F2Ba0708F26F",
      implementation: "0x018c64dF2EB3d174372Db7AC001b8386e73FaAe8",
    },
    PriceOracle: {
      proxy: "0x12bf27596485137fabdfBDEc93274F47B1ae243F",
      implementation: "0xc6F7a2fD62943D89daeA86C40819c62dC7C14c7b",
    },
    InterestRateModel: {
      proxy: "0xf94C11F250De861492CBc9809A772308BEe73a5b",
      implementation: "0xca85fFa7d62371B01676880f95707E8f7de71945",
    },
    CrossChainLiquidator: {
      proxy: "0x7201a71c2FCd7CC26deEC2bC8B0Cb608541F726c",
      implementation: "0x331DC4AeC3dB525C148D4615d26d2AEacdf036b6",
    },
    MockWETH: "0xF184F47393591bf6d046bFd36bD1eDBb7457B4B9",
    MockUSDC: "0x74a8eb9f2D6d8e098a4FA030a1Eac57B0a6a4106",
  },
} as const;
export default scaffoldConfig;
