"use client";

import { type ChainType, useChainContext } from "~~/contexts/ChainContext";

/**
 * Pill-shaped toggle to switch between EVM and Polkadot networks.
 * Sits in the Header bar.
 */
export const NetworkToggle = () => {
  const { chainType, setChainType } = useChainContext();
  const options: { value: ChainType; label: string; color: string }[] = [
    { value: "evm", label: "EVM", color: "bg-blue-500" },
    { value: "polkadot", label: "Polkadot", color: "bg-pink-500" },
  ];
  return (
    <div className="flex items-center bg-base-200 rounded-full p-0.5 border border-base-300 shadow-sm">
      {options.map(opt => {
        const isActive = chainType === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => setChainType(opt.value)}
            className={`
              relative px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-full
              transition-all duration-300 ease-out
              ${
                isActive
                  ? `${opt.color} text-white shadow-md scale-105`
                  : "text-base-content/40 hover:text-base-content/70"
              }
            `}
          >
            <span className="flex items-center gap-1.5">
              {opt.value === "evm" ? (
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2L2 12l10 10 10-10L12 2zm0 3.5L18.5 12 12 18.5 5.5 12 12 5.5z" />
                </svg>
              ) : (
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="12" r="3" />
                  <circle cx="12" cy="4" r="2" />
                  <circle cx="12" cy="20" r="2" />
                  <circle cx="4" cy="12" r="2" />
                  <circle cx="20" cy="12" r="2" />
                </svg>
              )}
              {opt.label}
            </span>
          </button>
        );
      })}
    </div>
  );
};
