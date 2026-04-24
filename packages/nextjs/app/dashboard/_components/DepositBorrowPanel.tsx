"use client";

import { useState } from "react";
import { formatEther, formatUnits, parseEther, parseUnits } from "viem";
import { useAccount } from "wagmi";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";

export const DepositBorrowPanel = () => {
  const { address } = useAccount();
  const [depositAmount, setDepositAmount] = useState("");
  const [borrowAmount, setBorrowAmount] = useState("");
  const [repayAmount, setRepayAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [activeTab, setActiveTab] = useState<"deposit" | "borrow" | "repay" | "withdraw">("deposit");

  // Read user position
  const { data: position } = useScaffoldReadContract({
    contractName: "LendingPool",
    functionName: "getPosition",
    args: [address || "0x0000000000000000000000000000000000000000"],
  });

  const { data: healthFactor } = useScaffoldReadContract({
    contractName: "LendingPool",
    functionName: "getHealthFactor",
    args: [address || "0x0000000000000000000000000000000000000000"],
  });

  const { data: maxBorrow } = useScaffoldReadContract({
    contractName: "LendingPool",
    functionName: "getMaxBorrow",
    args: [address || "0x0000000000000000000000000000000000000000"],
  });

  // Write hooks
  const { writeContractAsync: writeMockWETH, isPending: wethPending } = useScaffoldWriteContract({
    contractName: "MockWETH",
  });

  const { writeContractAsync: writeMockUSDC, isPending: usdcPending } = useScaffoldWriteContract({
    contractName: "MockUSDC",
  });

  const { writeContractAsync: writePool, isPending: poolPending } = useScaffoldWriteContract({
    contractName: "LendingPool",
  });

  const handleDeposit = async () => {
    try {
      const amount = parseEther(depositAmount);
      // First approve WETH
      await writeMockWETH({
        functionName: "approve",
        args: [
          // Need LendingPool address — will be resolved by SE-2
          "0x0000000000000000000000000000000000000000",
          amount,
        ],
      });
      // Then deposit
      await writePool({
        functionName: "deposit",
        args: [amount],
      });
      setDepositAmount("");
    } catch (e) {
      console.error("Deposit failed:", e);
    }
  };

  const handleBorrow = async () => {
    try {
      const amount = parseUnits(borrowAmount, 6);
      await writePool({
        functionName: "borrow",
        args: [amount],
      });
      setBorrowAmount("");
    } catch (e) {
      console.error("Borrow failed:", e);
    }
  };

  const handleRepay = async () => {
    try {
      const amount = parseUnits(repayAmount, 6);
      await writeMockUSDC({
        functionName: "approve",
        args: ["0x0000000000000000000000000000000000000000", amount],
      });
      await writePool({
        functionName: "repay",
        args: [amount],
      });
      setRepayAmount("");
    } catch (e) {
      console.error("Repay failed:", e);
    }
  };

  const handleWithdraw = async () => {
    try {
      const amount = parseEther(withdrawAmount);
      await writePool({
        functionName: "withdraw",
        args: [amount],
      });
      setWithdrawAmount("");
    } catch (e) {
      console.error("Withdraw failed:", e);
    }
  };

  const hfDisplay = healthFactor
    ? healthFactor === BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff")
      ? "∞"
      : parseFloat(formatEther(healthFactor)).toFixed(3)
    : "—";

  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body">
        <h2 className="card-title">💳 Your Position</h2>

        {/* Position Summary */}
        {position && (
          <div className="stats stats-vertical shadow-sm bg-base-200 text-sm">
            <div className="stat p-3">
              <div className="stat-title text-xs">Collateral</div>
              <div className="stat-value text-base">
                {parseFloat(formatEther(position.collateralAmount || 0n)).toFixed(4)} WETH
              </div>
            </div>
            <div className="stat p-3">
              <div className="stat-title text-xs">Debt</div>
              <div className="stat-value text-base">
                {parseFloat(formatEther(position.debtAmount || 0n)).toFixed(2)} (norm)
              </div>
            </div>
            <div className="stat p-3">
              <div className="stat-title text-xs">Health Factor</div>
              <div className="stat-value text-base">{hfDisplay}</div>
            </div>
          </div>
        )}

        {/* Action Tabs */}
        <div className="tabs tabs-boxed mt-2">
          {(["deposit", "borrow", "repay", "withdraw"] as const).map(tab => (
            <button
              key={tab}
              className={`tab tab-sm ${activeTab === tab ? "tab-active" : ""}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="mt-2">
          {activeTab === "deposit" && (
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="WETH amount"
                className="input input-bordered input-sm flex-1"
                value={depositAmount}
                onChange={e => setDepositAmount(e.target.value)}
              />
              <button className="btn btn-success btn-sm" onClick={handleDeposit} disabled={poolPending}>
                {poolPending ? "..." : "Deposit"}
              </button>
            </div>
          )}
          {activeTab === "borrow" && (
            <div className="flex flex-col gap-1">
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="USDC amount"
                  className="input input-bordered input-sm flex-1"
                  value={borrowAmount}
                  onChange={e => setBorrowAmount(e.target.value)}
                />
                <button className="btn btn-warning btn-sm" onClick={handleBorrow} disabled={poolPending}>
                  {poolPending ? "..." : "Borrow"}
                </button>
              </div>
              {maxBorrow && <span className="text-xs opacity-50">Max: {formatUnits(maxBorrow, 6)} USDC</span>}
            </div>
          )}
          {activeTab === "repay" && (
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="USDC amount"
                className="input input-bordered input-sm flex-1"
                value={repayAmount}
                onChange={e => setRepayAmount(e.target.value)}
              />
              <button className="btn btn-info btn-sm" onClick={handleRepay} disabled={poolPending}>
                {poolPending ? "..." : "Repay"}
              </button>
            </div>
          )}
          {activeTab === "withdraw" && (
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="WETH amount"
                className="input input-bordered input-sm flex-1"
                value={withdrawAmount}
                onChange={e => setWithdrawAmount(e.target.value)}
              />
              <button className="btn btn-accent btn-sm" onClick={handleWithdraw} disabled={poolPending}>
                {poolPending ? "..." : "Withdraw"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
