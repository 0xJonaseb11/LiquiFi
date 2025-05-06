"use client";

import { useChainContext } from "~~/contexts/ChainContext";
import { useScaffoldEventHistory } from "~~/hooks/scaffold-eth";

/**
 * Unified event history hook.
 * EVM: Delegates to useScaffoldEventHistory.
 * Polkadot: Placeholder (requires indexer like SubQuery/Subsquid for history).
 */
export const useChainEventHistory = (config: any) => {
  const { isEvm } = useChainContext();

  const evmEvents = useScaffoldEventHistory(isEvm ? config : { ...config, enabled: false });

  if (isEvm) {
    return evmEvents;
  }

  // Polkadot placeholder
  return {
    data: [],
    isLoading: false,
    error: null,
    refetch: () => {},
  };
};
