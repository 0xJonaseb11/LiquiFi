"use client";

import Link from "next/link";
import type { NextPage } from "next";
import {
  ArrowRightIcon,
  ArrowsRightLeftIcon,
  ChartBarSquareIcon,
  CpuChipIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";

const Home: NextPage = () => {
  return (
    <div className="flex flex-col min-h-screen bg-base-100">
      {}
      <div className="relative flex-grow flex items-center justify-center py-24 px-4 overflow-hidden border-b border-base-300">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.05),transparent_50%)]" />
        <div className="max-w-4xl text-center z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-black uppercase tracking-widest mb-8">
            <CpuChipIcon className="w-3.5 h-3.5" />
            Autonomous AI Liquidation Protocol
          </div>
          <h1 className="text-7xl md:text-9xl font-black tracking-tighter mb-8 leading-[0.8] uppercase italic">
            Liqui<span className="text-primary not-italic">Fi</span>
          </h1>
          <p className="text-lg md:text-xl opacity-60 mb-12 max-w-2xl mx-auto leading-relaxed font-medium">
            Unlock the power of cross-chain liquidity. Supply assets on Polkadot or EVM and borrow USDC with real-time
            protection from our advanced AI risk engine.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/dashboard"
              className="btn btn-primary btn-lg px-12 rounded-xl group font-bold shadow-xl shadow-primary/20"
            >
              Enter App
              <ArrowRightIcon className="w-5 h-5 ml-2 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link href="/debug" className="btn btn-outline btn-lg px-12 rounded-xl font-bold">
              Protocol Contracts
            </Link>
          </div>
        </div>
      </div>
      {}
      <div className="container mx-auto px-4 py-24">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          <div className="flex flex-col p-2">
            <div className="w-12 h-12 rounded-xl premium-gradient flex items-center justify-center text-white mb-8 shadow-lg shadow-primary/20">
              <ChartBarSquareIcon className="w-6 h-6" />
            </div>
            <h3 className="text-2xl font-black tracking-tight mb-4 uppercase">Lending Pool</h3>
            <p className="opacity-50 leading-relaxed font-medium">
              Deposit WETH collateral and borrow USDC with institutional efficiency. Utilization-based interest rates
              ensure optimal capital flow.
            </p>
          </div>
          <div className="flex flex-col p-2">
            <div className="w-12 h-12 rounded-xl premium-gradient flex items-center justify-center text-white mb-8 shadow-lg shadow-primary/20">
              <CpuChipIcon className="w-6 h-6" />
            </div>
            <h3 className="text-2xl font-black tracking-tight mb-4 uppercase">AI Risk Engine</h3>
            <p className="opacity-50 leading-relaxed font-medium">
              Our autonomous LLM monitors global sentiment and volatility to dynamically adjust protocol safety margins
              in real-time.
            </p>
          </div>
          <div className="flex flex-col p-2">
            <div className="w-12 h-12 rounded-xl premium-gradient flex items-center justify-center text-white mb-8 shadow-lg shadow-primary/20">
              <ArrowsRightLeftIcon className="w-6 h-6" />
            </div>
            <h3 className="text-2xl font-black tracking-tight mb-4 uppercase">Cross-Chain Ops</h3>
            <p className="opacity-50 leading-relaxed font-medium">
              State-machine based liquidation nodes orchestrate capital across chains via LayerZero, ensuring instant
              debt resolution.
            </p>
          </div>
        </div>
      </div>
      {}
      <div className="bg-base-200 py-16 border-t border-base-300">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-12">
            <div className="flex items-center gap-6">
              <div className="w-14 h-14 rounded-full bg-base-100 flex items-center justify-center border border-base-300 shadow-sm">
                <ShieldCheckIcon className="w-8 h-8 text-primary" />
              </div>
              <div>
                <h4 className="font-black text-lg uppercase tracking-tight">Hardened Core</h4>
                <p className="text-xs opacity-40 uppercase tracking-widest font-bold">Industry-Standard Security</p>
              </div>
            </div>
            <div className="flex gap-12 opacity-20 grayscale font-black text-2xl italic uppercase tracking-tighter">
              <span>WETH</span>
              <span>WDOT</span>
              <span>USDC</span>
              <span>Chainlink</span>
              <span>LZ</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default Home;
