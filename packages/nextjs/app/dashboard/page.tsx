"use client";

import { AdminPanel } from "./_components/AdminPanel";
import { DepositBorrowPanel } from "./_components/DepositBorrowPanel";
import { PositionsTable } from "./_components/PositionsTable";
import { ProtocolStats } from "./_components/ProtocolStats";
import { RiskScoreWidget } from "./_components/RiskScoreWidget";
import type { NextPage } from "next";

const Dashboard: NextPage = () => {
  return (
    <div className="flex flex-col gap-6 p-6 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">🏦 LiquiFi Dashboard</h1>
          <p className="text-sm opacity-60">Lending Protocol Monitor & Control Panel</p>
        </div>
        <RiskScoreWidget />
      </div>

      {/* Protocol Stats Row */}
      <ProtocolStats />

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Positions Table - spans 2 columns */}
        <div className="lg:col-span-2">
          <PositionsTable />
        </div>

        {/* Right sidebar */}
        <div className="flex flex-col gap-6">
          <DepositBorrowPanel />
          <AdminPanel />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
