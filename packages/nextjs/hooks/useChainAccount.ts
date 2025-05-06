"use client";

import { useAccount } from "wagmi";
import { useChainContext } from "~~/contexts/ChainContext";
import { usePolkadotContext } from "~~/providers/PolkadotProvider";

/**
 * Unified account hook — returns the connected address regardless of chain type.
 */
export const useChainAccount = () => {
  const { chainType, isEvm } = useChainContext();

  // EVM side
  const {
    address: evmAddress,
    isConnected: evmConnected,
    isConnecting: evmConnecting,
    isReconnecting: evmReconnecting,
  } = useAccount();

  // Polkadot side
  let polkadotAddress: string | undefined;
  let polkadotConnected = false;
  let polkadotConnecting = false;
  try {
    const polkadot = usePolkadotContext();
    polkadotAddress = polkadot.selectedAccount?.address;
    polkadotConnected = polkadot.isConnected;
    polkadotConnecting = polkadot.isConnecting;
  } catch {
    // Not wrapped in PolkadotProvider (EVM mode)
  }

  const address = isEvm ? evmAddress : polkadotAddress;
  const isConnected = isEvm ? evmConnected : polkadotConnected;
  const isConnecting = isEvm ? evmConnecting : polkadotConnecting;
  const isReconnecting = isEvm ? evmReconnecting : false;

  const truncate = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  return {
    address,
    isConnected,
    isConnecting,
    isReconnecting,
    chainType,
    displayAddress: address ? truncate(address) : "",
  };
};
