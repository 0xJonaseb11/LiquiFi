"use client";

import { type ReactNode, createContext, useContext, useEffect, useState } from "react";
import { usePolkadotContext } from "./PolkadotProvider";
import scaffoldConfig from "~~/scaffold.config";

interface PolkadotContractContextValue {
  api: any | null;
  contracts: Record<string, any>;
  isReady: boolean;
  error: string | null;
}

const PolkadotContractContext = createContext<PolkadotContractContextValue>({
  api: null,
  contracts: {},
  isReady: false,
  error: null,
});

export const PolkadotContractProvider = ({ children }: { children: ReactNode }) => {
  const { selectedAccount } = usePolkadotContext();
  const [api, setApi] = useState<any | null>(null);
  const [contracts, setContracts] = useState<Record<string, any>>({});
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const initApi = async () => {
      try {
        const { ApiPromise, WsProvider } = await import("@polkadot/api");
        const { ContractPromise } = await import("@polkadot/api-contract");

        const polkadotConfig = (scaffoldConfig as any).polkadotConfig;
        if (!polkadotConfig) {
          setError("Polkadot config not found in scaffold.config.ts");
          return;
        }

        const provider = new WsProvider(polkadotConfig.rpcEndpoint);
        const apiInstance = await ApiPromise.create({ provider });

        if (!mounted) return;
        setApi(apiInstance);

        // Load contract metadata and create ContractPromise instances
        const contractEntries: Record<string, any> = {};
        const addresses = polkadotConfig.contractAddresses || {};

        for (const [name, address] of Object.entries(addresses)) {
          try {
            // Contract metadata will be loaded from the polkadot contracts directory
            const metadata = await import(`~~/contracts/polkadot/${name}.json`);
            contractEntries[name] = new ContractPromise(apiInstance, metadata, address as string);
          } catch {
            console.warn(`[Polkadot] Could not load metadata for ${name}`);
          }
        }

        if (mounted) {
          setContracts(contractEntries);
          setIsReady(true);
        }
      } catch (err: any) {
        if (mounted) {
          setError(err?.message || "Failed to connect to Polkadot node");
        }
      }
    };

    initApi();

    return () => {
      mounted = false;
      if (api) {
        api.disconnect();
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <PolkadotContractContext.Provider value={{ api, contracts, isReady, error }}>
      {children}
    </PolkadotContractContext.Provider>
  );
};

export const usePolkadotContracts = () => useContext(PolkadotContractContext);
