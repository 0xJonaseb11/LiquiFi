"use client";

import { type ReactNode, createContext, useCallback, useContext, useState } from "react";

export type ChainType = "evm" | "polkadot";
interface ChainContextValue {
  chainType: ChainType;
  setChainType: (type: ChainType) => void;
  isPolkadot: boolean;
  isEvm: boolean;
  toggleChain: () => void;
}
const ChainContext = createContext<ChainContextValue>({
  chainType: "evm",
  setChainType: () => {},
  isPolkadot: false,
  isEvm: true,
  toggleChain: () => {},
});
export const ChainProvider = ({ children }: { children: ReactNode }) => {
  const [chainType, setChainType] = useState<ChainType>("evm");
  const toggleChain = useCallback(() => {
    setChainType(prev => (prev === "evm" ? "polkadot" : "evm"));
  }, []);
  return (
    <ChainContext.Provider
      value={{
        chainType,
        setChainType,
        isPolkadot: chainType === "polkadot",
        isEvm: chainType === "evm",
        toggleChain,
      }}
    >
      {children}
    </ChainContext.Provider>
  );
};
export const useChainContext = () => useContext(ChainContext);
