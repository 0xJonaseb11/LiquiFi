"use client";

import { type ReactNode, createContext, useCallback, useContext, useEffect, useState } from "react";

interface PolkadotAccount {
  address: string;
  name?: string;
  source: string;
}
interface PolkadotContextValue {
  accounts: PolkadotAccount[];
  selectedAccount: PolkadotAccount | null;
  selectAccount: (account: PolkadotAccount) => void;
  isConnected: boolean;
  isConnecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  error: string | null;
}
const PolkadotContext = createContext<PolkadotContextValue>({
  accounts: [],
  selectedAccount: null,
  selectAccount: () => {},
  isConnected: false,
  isConnecting: false,
  connect: async () => {},
  disconnect: () => {},
  error: null,
});
export const PolkadotProvider = ({ children }: { children: ReactNode }) => {
  const [accounts, setAccounts] = useState<PolkadotAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<PolkadotAccount | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const connect = useCallback(async () => {
    setIsConnecting(true);
    setError(null);
    try {
      const { web3Enable, web3Accounts } = await import("@polkadot/extension-dapp");
      const allInjected = await web3Enable("LiquiFi");
      if (allInjected.length === 0) {
        setError("No Polkadot wallet extension found. Install Talisman, SubWallet, or Polkadot{.js}.");
        setIsConnecting(false);
        return;
      }
      const allAccounts = await web3Accounts();
      const mapped: PolkadotAccount[] = allAccounts.map(acc => ({
        address: acc.address,
        name: acc.meta.name || undefined,
        source: acc.meta.source,
      }));
      setAccounts(mapped);
      if (mapped.length > 0 && !selectedAccount) {
        setSelectedAccount(mapped[0]);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to connect Polkadot wallet");
    } finally {
      setIsConnecting(false);
    }
  }, [selectedAccount]);
  const disconnect = useCallback(() => {
    setAccounts([]);
    setSelectedAccount(null);
  }, []);
  const selectAccount = useCallback((account: PolkadotAccount) => {
    setSelectedAccount(account);
  }, []);
  return (
    <PolkadotContext.Provider
      value={{
        accounts,
        selectedAccount,
        selectAccount,
        isConnected: selectedAccount !== null,
        isConnecting,
        connect,
        disconnect,
        error,
      }}
    >
      {children}
    </PolkadotContext.Provider>
  );
};
export const usePolkadotContext = () => useContext(PolkadotContext);
