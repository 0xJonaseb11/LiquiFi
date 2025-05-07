"use client";

import { formatEther } from "viem";
import {
  ArrowUpRightIcon,
  BanknotesIcon,
  ChartPieIcon,
  PresentationChartLineIcon,
  UsersIcon,
} from "@heroicons/react/24/outline";
import { useChainContext } from "~~/contexts/ChainContext";
import { useChainReadContract } from "~~/hooks/useChainContract";

export const ProtocolStats = () => {
  const { isEvm } = useChainContext();
  const { data: totalDeposits } = useChainReadContract({
    contractName: "LendingPool",
    functionName: "getTotalDeposits",
  });
  const { data: totalBorrows } = useChainReadContract({
    contractName: "LendingPool",
    functionName: "getTotalBorrows",
  });
  const { data: utilizationRate } = useChainReadContract({
    contractName: "LendingPool",
    functionName: "getUtilizationRate",
  });
  const { data: borrowRate } = useChainReadContract({
    contractName: "LendingPool",
    functionName: "getBorrowRate",
  });
  const { data: borrowerCount } = useChainReadContract({
    contractName: "LendingPool",
    functionName: "getBorrowerCount",
  });
  const stats = [
    {
      label: "Value Locked",
      value: totalDeposits
        ? `${Number.parseFloat(formatEther(totalDeposits)).toFixed(2)} ${isEvm ? "WETH" : "wDOT"}`
        : "0.00",
      icon: <BanknotesIcon className="w-4 h-4" />,
      color: "text-success",
    },
    {
      label: "Total Borrowed",
      value: totalBorrows ? `${Number.parseFloat(formatEther(totalBorrows)).toFixed(2)} USDC` : "0.00",
      icon: <ArrowUpRightIcon className="w-4 h-4" />,
      color: "text-warning",
    },
    {
      label: "Pool Utilization",
      value: utilizationRate ? `${(Number.parseFloat(formatEther(utilizationRate)) * 100).toFixed(1)}%` : "0.0%",
      icon: <ChartPieIcon className="w-4 h-4" />,
      color: "text-info",
    },
    {
      label: "Borrowing APR",
      value: borrowRate
        ? `${(Number.parseFloat(formatEther(borrowRate)) * 365.25 * 24 * 3600 * 100).toFixed(2)}%`
        : "0.00%",
      icon: <PresentationChartLineIcon className="w-4 h-4" />,
      color: "text-primary",
    },
    {
      label: "Active Users",
      value: borrowerCount ? borrowerCount.toString() : "0",
      icon: <UsersIcon className="w-4 h-4" />,
      color: "text-secondary",
    },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      {stats.map(stat => (
        <div
          key={stat.label}
          className="bg-base-100 border border-base-300 rounded-xl p-4 transition-all hover:border-primary/50 group"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className={`p-1.5 rounded-lg bg-base-200 group-hover:bg-primary/10 transition-colors`}>
              {stat.icon}
            </div>
            <span className="text-[10px] opacity-40 uppercase font-black tracking-widest">{stat.label}</span>
          </div>
          <p className={`text-xl font-black tracking-tight ${stat.color}`}>{stat.value}</p>
        </div>
      ))}
    </div>
  );
};
