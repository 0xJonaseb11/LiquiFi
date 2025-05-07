"use client";

import Link from "next/link";
import { CrossChainStatus } from "./_components/CrossChainStatus";
import { PositionsTable } from "./_components/PositionsTable";
import { ProtocolStats } from "./_components/ProtocolStats";
import { RiskScoreWidget } from "./_components/RiskScoreWidget";
import { ChartBarIcon, WalletIcon } from "@heroicons/react/24/outline";
import { useChainContext } from "~~/contexts/ChainContext";
import scaffoldConfig from "~~/scaffold.config";

const Dashboard = () => {
  const { isEvm } = useChainContext();
  const networkName = isEvm ? "EVM / Hardhat" : (scaffoldConfig as any).polkadotConfig?.networkName || "Polkadot";
  return (
    <div className="flex flex-col gap-8 p-4 md:p-10 max-w-[1600px] mx-auto w-full min-h-screen bg-base-200/20">
      {}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-base-100 p-8 rounded-2xl border border-base-300 shadow-sm">
        <div className="flex items-center justify-between w-full lg:w-auto gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl premium-gradient text-white shadow-lg shadow-primary/20">
              <ChartBarIcon className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tighter uppercase italic leading-none mb-1">
                Protocol Overview
              </h1>
              <p className="text-[10px] uppercase tracking-[0.3em] font-black opacity-30">
                Global Liquidity & Position Safety
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-col lg:flex-row items-center gap-6">
          <Link
            href="/portfolio"
            className="btn btn-primary rounded-xl font-black uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-primary/20 w-full lg:w-auto"
          >
            <WalletIcon className="w-5 h-5" />
            Manage My Portfolio
          </Link>
          <div className="w-full lg:w-[450px]">
            <RiskScoreWidget />
          </div>
        </div>
      </div>
      {}
      <ProtocolStats />
      {}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {}
        <div className="lg:col-span-8 flex flex-col gap-8">
          <PositionsTable />
        </div>
        {}
        <div className="lg:col-span-4 flex flex-col gap-8">
          <CrossChainStatus />
        </div>
      </div>
      {}
      <div className="mt-4 flex items-center justify-center gap-6 opacity-20 text-[10px] font-black uppercase tracking-[0.5em]">
        <span>Network: {networkName}</span>
        <span>•</span>
        <span>Version: 1.0.0-PROTOTYPE</span>
      </div>
    </div>
  );
};
export default Dashboard;
