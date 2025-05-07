"use client";

import { AdminPanel } from "../dashboard/_components/AdminPanel";
import { ProtocolStats } from "../dashboard/_components/ProtocolStats";
import { RiskScoreWidget } from "../dashboard/_components/RiskScoreWidget";
import { ShieldExclamationIcon } from "@heroicons/react/24/outline";
import { AdminGuard } from "~~/components/AdminGuard";

const AdminPage = () => {
  return (
    <AdminGuard>
      <div className="flex flex-col gap-8 p-4 md:p-10 max-w-[1600px] mx-auto w-full min-h-screen bg-base-200/20">
        {}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-base-100 p-8 rounded-2xl border border-base-300 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-error text-error-content shadow-lg shadow-error/20">
              <ShieldExclamationIcon className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tighter uppercase italic leading-none mb-1">
                Protocol Admin
              </h1>
              <p className="text-[10px] uppercase tracking-[0.3em] font-black opacity-30">
                System Oversight & Parameter Controls
              </p>
            </div>
          </div>
          <div className="w-full lg:w-[450px]">
            <RiskScoreWidget />
          </div>
        </div>
        {}
        <ProtocolStats />
        {}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {}
          <div className="lg:col-span-12 flex flex-col gap-8">
            <AdminPanel />
          </div>
        </div>
      </div>
    </AdminGuard>
  );
};
export default AdminPage;
