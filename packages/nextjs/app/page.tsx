"use client";

import Link from "next/link";
import type { NextPage } from "next";
import { useAccount } from "wagmi";
import { Address } from "@scaffold-ui/components";
import { useTargetNetwork } from "~~/hooks/scaffold-eth";
import { hardhat } from "viem/chains";

const Home: NextPage = () => {
  const { address: connectedAddress } = useAccount();
  const { targetNetwork } = useTargetNetwork();

  return (
    <div className="flex flex-col items-center grow">
      {/* Hero Section */}
      <div className="hero min-h-[60vh] bg-gradient-to-br from-primary/10 via-base-100 to-secondary/10">
        <div className="hero-content text-center">
          <div className="max-w-2xl">
            <h1 className="text-6xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              LiquiFi
            </h1>
            <p className="py-2 text-xl opacity-70">
              DeFi Lending Protocol with AI-Powered Liquidation Engine
            </p>
            <p className="text-sm opacity-50 mb-6">
              Cross-chain liquidation • AI risk scoring • Real-time monitoring
            </p>

            {connectedAddress ? (
              <div className="flex flex-col items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="badge badge-success badge-sm">Connected</span>
                  <Address
                    address={connectedAddress}
                    chain={targetNetwork}
                    blockExplorerAddressLink={
                      targetNetwork.id === hardhat.id
                        ? `/blockexplorer/address/${connectedAddress}`
                        : undefined
                    }
                  />
                </div>
                <div className="flex gap-3">
                  <Link href="/dashboard" className="btn btn-primary btn-lg">
                    🏦 Open Dashboard
                  </Link>
                  <Link href="/debug" className="btn btn-outline btn-lg">
                    🔧 Debug Contracts
                  </Link>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <p className="text-warning">Connect your wallet to get started</p>
                <Link href="/dashboard" className="btn btn-primary btn-lg">
                  🏦 View Dashboard
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Feature Cards */}
      <div className="w-full bg-base-200 px-8 py-16">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-10">Protocol Architecture</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow">
              <div className="card-body">
                <h3 className="card-title text-primary">🏦 Lending Pool</h3>
                <p className="text-sm opacity-70">
                  Deposit WETH collateral, borrow USDC with 75% LTV.
                  Utilization-based interest rates with jump rate model.
                </p>
              </div>
            </div>
            <div className="card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow">
              <div className="card-body">
                <h3 className="card-title text-secondary">⚡ Liquidation Engine</h3>
                <p className="text-sm opacity-70">
                  Automated bot monitors health factors. Executes optimal
                  partial liquidations with gas management.
                </p>
              </div>
            </div>
            <div className="card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow">
              <div className="card-body">
                <h3 className="card-title text-accent">🌉 Cross-Chain</h3>
                <p className="text-sm opacity-70">
                  LayerZero-powered cross-chain fund sourcing for liquidations.
                  State machine with retry & dead-letter queues.
                </p>
              </div>
            </div>
            <div className="card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow">
              <div className="card-body">
                <h3 className="card-title text-info">🤖 AI Risk Scoring</h3>
                <p className="text-sm opacity-70">
                  GPT-powered market risk assessment. Dynamically adjusts
                  liquidation thresholds based on sentiment analysis.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div className="w-full px-8 py-12">
        <div className="max-w-4xl mx-auto flex justify-center gap-6 flex-wrap">
          <Link href="/dashboard" className="btn btn-primary gap-2">
            📊 Dashboard
          </Link>
          <Link href="/debug" className="btn btn-secondary gap-2">
            🔧 Debug Contracts
          </Link>
          <Link href="/blockexplorer" className="btn btn-accent gap-2">
            🔍 Block Explorer
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Home;
