"use client";

import { useState } from "react";
import { usePolkadotContext } from "~~/providers/PolkadotProvider";

/**
 * Wallet connect button for Polkadot mode.
 * Shows account selector when connected.
 */
export const PolkadotConnectButton = () => {
  const { accounts, selectedAccount, selectAccount, isConnected, isConnecting, connect, disconnect, error } =
    usePolkadotContext();
  const [showDropdown, setShowDropdown] = useState(false);
  if (!isConnected) {
    return (
      <div className="flex flex-col items-end gap-1">
        <button
          onClick={connect}
          disabled={isConnecting}
          className="btn btn-sm btn-primary rounded-xl font-black uppercase tracking-wider text-[10px] px-4 shadow-lg shadow-pink-500/20"
        >
          {isConnecting ? (
            <span className="loading loading-spinner loading-xs" />
          ) : (
            <>
              <svg className="w-3.5 h-3.5 mr-1" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="12" r="3" />
                <circle cx="12" cy="4" r="2" />
                <circle cx="12" cy="20" r="2" />
                <circle cx="4" cy="12" r="2" />
                <circle cx="20" cy="12" r="2" />
              </svg>
              Connect Wallet
            </>
          )}
        </button>
        {error && <span className="text-[9px] text-error max-w-[200px] text-right">{error}</span>}
      </div>
    );
  }
  const truncateAddr = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="btn btn-sm btn-ghost rounded-xl font-bold text-xs flex items-center gap-2 border border-pink-500/30 bg-pink-500/5"
      >
        <div className="w-5 h-5 rounded-full bg-gradient-to-br from-pink-400 to-purple-600" />
        <span>{selectedAccount?.name || truncateAddr(selectedAccount?.address || "")}</span>
        <span className="text-[8px] opacity-40 uppercase">{selectedAccount?.source}</span>
      </button>
      {showDropdown && (
        <div className="absolute right-0 top-full mt-2 bg-base-100 border border-base-300 rounded-xl shadow-xl p-2 min-w-[240px] z-50">
          <div className="text-[9px] uppercase font-black tracking-widest opacity-30 px-2 py-1 mb-1">
            Select Account
          </div>
          {accounts.map(acc => (
            <button
              key={acc.address}
              onClick={() => {
                selectAccount(acc);
                setShowDropdown(false);
              }}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs hover:bg-base-200 transition-colors flex items-center gap-2 ${
                selectedAccount?.address === acc.address ? "bg-pink-500/10" : ""
              }`}
            >
              <div className="w-4 h-4 rounded-full bg-gradient-to-br from-pink-400 to-purple-600 shrink-0" />
              <div className="flex flex-col min-w-0">
                <span className="font-bold truncate">{acc.name || "Unnamed"}</span>
                <span className="text-[9px] opacity-40 font-mono">{truncateAddr(acc.address)}</span>
              </div>
              <span className="text-[8px] opacity-30 uppercase ml-auto shrink-0">{acc.source}</span>
            </button>
          ))}
          <div className="border-t border-base-300 mt-1 pt-1">
            <button
              onClick={() => {
                disconnect();
                setShowDropdown(false);
              }}
              className="w-full text-left px-3 py-2 rounded-lg text-xs text-error hover:bg-error/10 transition-colors font-bold"
            >
              Disconnect
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
