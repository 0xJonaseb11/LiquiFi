"use client";

import { DepositBorrowPanel } from "../dashboard/_components/DepositBorrowPanel";
import { UserTransactionHistory } from "../dashboard/_components/UserTransactionHistory";
import { WalletIcon } from "@heroicons/react/24/outline";
import { AuthGuard } from "~~/components/AuthGuard";

const PortfolioPage = () => {
  return (
    <AuthGuard>
      <div className="flex flex-col gap-8 p-4 md:p-10 max-w-[1600px] mx-auto w-full min-h-screen bg-base-200/20">
        {/* Upper Portfolio Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-base-100 p-8 rounded-2xl border border-base-300 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl premium-gradient text-white shadow-lg shadow-primary/20">
              <WalletIcon className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tighter uppercase italic leading-none mb-1">
                User Portfolio
              </h1>
              <p className="text-[10px] uppercase tracking-[0.3em] font-black opacity-30">
                Manage your positions & activity
              </p>
            </div>
          </div>
        </div>

        {/* Primary Analytics & Interaction Layer */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Transaction History */}
          <div className="lg:col-span-7 flex flex-col gap-8">
            <UserTransactionHistory />
          </div>

          {/* Terminal Controls */}
          <div className="lg:col-span-5 flex flex-col gap-8">
            <DepositBorrowPanel />
          </div>
        </div>

        {/* Protocol Footer Status */}
        <div className="mt-4 flex items-center justify-center gap-6 opacity-20 text-[10px] font-black uppercase tracking-[0.5em]">
          <span>Network: Hardhat</span>
          <span>•</span>
          <span>Version: 1.0.0-PROTOTYPE</span>
        </div>
      </div>
    </AuthGuard>
  );
};

export default PortfolioPage;
