"use client";

import { formatEther, formatUnits } from "viem";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";

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
      label: "Total Deposits",
      value: totalDeposits ? `${parseFloat(formatEther(totalDeposits)).toFixed(2)} WETH` : "—",
      icon: "💰",
      color: "text-success",
    },
    {
      label: "Total Borrows",
      value: totalBorrows ? `${parseFloat(formatEther(totalBorrows)).toFixed(2)} USDC (norm)` : "—",
      icon: "📤",
      color: "text-warning",
    },
    {
      label: "Utilization",
      value: utilizationRate ? `${(parseFloat(formatEther(utilizationRate)) * 100).toFixed(1)}%` : "—",
      icon: "📊",
      color: "text-info",
    },
    {
      label: "Borrow Rate",
      value: borrowRate ? `${(parseFloat(formatEther(borrowRate)) * 365.25 * 24 * 3600 * 100).toFixed(2)}% APR` : "—",
      icon: "📈",
      color: "text-primary",
    },
    {
      label: "Active Borrowers",
      value: borrowerCount ? borrowerCount.toString() : "0",
      icon: "👥",
      color: "text-secondary",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {stats.map(stat => (
        <div key={stat.label} className="card bg-base-100 shadow-md">
          <div className="card-body p-4">
            <div className="flex items-center gap-2">
              <span className="text-xl">{stat.icon}</span>
              <span className="text-xs opacity-60 uppercase">{stat.label}</span>
            </div>
            <p className={`text-lg font-bold ${stat.color}`}>{stat.value}</p>
          </div>
        </div>
      ))}
    </div>
  );
};
