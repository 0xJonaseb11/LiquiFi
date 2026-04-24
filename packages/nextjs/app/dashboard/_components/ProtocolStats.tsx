"use client";

import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";
import { formatEther } from "viem";
import { 
  BanknotesIcon, 
  ArrowUpRightIcon, 
  ChartPieIcon, 
  PresentationChartLineIcon, 
  UsersIcon 
} from "@heroicons/react/24/outline";

export const ProtocolStats = () => {
  const { data: totalDeposits } = useScaffoldReadContract({
    contractName: "LendingPool",
    functionName: "getTotalDeposits",
  });

  const { data: totalBorrows } = useScaffoldReadContract({
    contractName: "LendingPool",
    functionName: "getTotalBorrows",
  });

  const { data: utilizationRate } = useScaffoldReadContract({
    contractName: "LendingPool",
    functionName: "getUtilizationRate",
  });

  const { data: borrowRate } = useScaffoldReadContract({
    contractName: "LendingPool",
    functionName: "getBorrowRate",
  });

  const { data: borrowerCount } = useScaffoldReadContract({
    contractName: "LendingPool",
    functionName: "getBorrowerCount",
  });

  const stats = [
    {
      label: "Total TVL",
      value: totalDeposits ? `${parseFloat(formatEther(totalDeposits)).toFixed(2)} WETH` : "—",
      icon: <BanknotesIcon className="w-4 h-4" />,
      color: "text-success",
    },
    {
      label: "Total Debt",
      value: totalBorrows ? `${parseFloat(formatEther(totalBorrows)).toFixed(2)} USDC` : "—",
      icon: <ArrowUpRightIcon className="w-4 h-4" />,
      color: "text-warning",
    },
    {
      label: "Utilization",
      value: utilizationRate ? `${(parseFloat(formatEther(utilizationRate)) * 100).toFixed(1)}%` : "—",
      icon: <ChartPieIcon className="w-4 h-4" />,
      color: "text-info",
    },
    {
      label: "Current APR",
      value: borrowRate
        ? `${(parseFloat(formatEther(borrowRate)) * 365.25 * 24 * 3600 * 100).toFixed(2)}%`
        : "—",
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
      {stats.map((stat) => (
        <div key={stat.label} className="bg-base-100 border border-base-300 rounded-xl p-4 transition-all hover:border-primary/50 group">
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
