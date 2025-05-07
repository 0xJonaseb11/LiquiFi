import React from "react";
import Link from "next/link";
import { useFetchNativeCurrencyPrice } from "@scaffold-ui/hooks";
import { hardhat } from "viem/chains";
import { CurrencyDollarIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { SwitchTheme } from "~~/components/SwitchTheme";
import { Faucet } from "~~/components/scaffold-eth";
import { useTargetNetwork } from "~~/hooks/scaffold-eth/useTargetNetwork";

/**
 * Site footer
 */
export const Footer = () => {
  const { targetNetwork } = useTargetNetwork();
  const isLocalNetwork = targetNetwork.id === hardhat.id;
  const { price: nativeCurrencyPrice } = useFetchNativeCurrencyPrice();
  return (
    <div className="min-h-0 py-5 px-1 mb-11 lg:mb-0 border-t border-base-300">
      <div>
        <div className="fixed flex justify-between items-center w-full z-10 p-4 bottom-0 left-0 pointer-events-none">
          <div className="flex flex-col md:flex-row gap-2 pointer-events-auto">
            {nativeCurrencyPrice > 0 && (
              <div>
                <div className="btn btn-secondary btn-sm font-normal gap-1 cursor-auto border border-base-300">
                  <CurrencyDollarIcon className="h-4 w-4" />
                  <span>{nativeCurrencyPrice.toFixed(2)}</span>
                </div>
              </div>
            )}
            {isLocalNetwork && (
              <>
                <Faucet />
                <Link
                  href="/blockexplorer"
                  passHref
                  className="btn btn-secondary btn-sm font-normal gap-1 border border-base-300"
                >
                  <MagnifyingGlassIcon className="h-4 w-4" />
                  <span>Block Explorer</span>
                </Link>
              </>
            )}
          </div>
          <SwitchTheme className={`pointer-events-auto ${isLocalNetwork ? "self-end md:self-auto" : ""}`} />
        </div>
      </div>
      <div className="w-full">
        <ul className="menu menu-horizontal w-full">
          <div className="flex justify-center items-center gap-6 text-[10px] uppercase font-black tracking-widest w-full">
            <Link href="/docs" className="hover:text-primary transition-colors">
              Documentation
            </Link>
            <Link href="/governance" className="hover:text-primary transition-colors">
              Governance
            </Link>
            <Link href="/security" className="hover:text-primary transition-colors">
              Security
            </Link>
            <a
              href="https://github.com/0xJonaseb11/LiquiFi"
              target="_blank"
              rel="noreferrer"
              className="hover:text-primary transition-colors"
            >
              GitHub
            </a>
            <span className="opacity-20 mx-2">|</span>
            <div className="flex items-center gap-2">
              <span className="opacity-40">Secured by</span>
              <span className="text-primary">LiquiFi AI Core</span>
            </div>
          </div>
        </ul>
      </div>
    </div>
  );
};
