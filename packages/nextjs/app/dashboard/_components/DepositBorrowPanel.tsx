"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { parseEther, parseUnits, formatEther, formatUnits } from "viem";
import { 
  CreditCardIcon, 
  ArrowDownCircleIcon, 
  ArrowUpCircleIcon, 
  ArrowPathIcon,
  ShieldCheckIcon
} from "@heroicons/react/24/outline";

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
  const { writeContractAsync: writeMockWETH } = useScaffoldWriteContract({
    contractName: "MockWETH",
  });

  const { writeContractAsync: writeMockUSDC } = useScaffoldWriteContract({
    contractName: "MockUSDC",
  });

  const { writeContractAsync: writePool, isPending: poolPending } = useScaffoldWriteContract({
    contractName: "LendingPool",
  });

  const handleDeposit = async () => {
    try {
      const amount = parseEther(depositAmount);
      await writeMockWETH({
        functionName: "approve",
        args: ["0x0000000000000000000000000000000000000000", amount], // SE-2 will replace 0x0... with LendingPool addr
      });
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

  const hfNum = healthFactor ? parseFloat(formatEther(healthFactor)) : 0;
  const hfDisplay = healthFactor
    ? healthFactor === BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff")
      ? "∞"
      : hfNum.toFixed(3)
    : "—";

  const getHFColor = () => {
    if (hfDisplay === "∞" || hfNum >= 1.5) return "text-success";
    if (hfNum >= 1.0) return "text-warning";
    return "text-error";
  };

  return (
    <div className="bg-base-100 border border-base-300 rounded-xl overflow-hidden shadow-sm flex flex-col h-full">
      <div className="p-4 border-b border-base-300 flex items-center gap-2 bg-base-200/30">
        <CreditCardIcon className="w-4 h-4 opacity-50" />
        <h2 className="text-xs uppercase font-black tracking-widest opacity-60 text-gradient">Position Control</h2>
      </div>

      <div className="p-6 flex-grow">
        {/* Position Context */}
        <div className="grid grid-cols-3 gap-4 mb-8 bg-base-200/50 p-4 rounded-xl border border-base-300/50">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase opacity-40 font-black mb-1">Collateral</span>
            <span className="font-black tracking-tighter">
              {parseFloat(formatEther(position?.collateralAmount || 0n)).toFixed(3)} <span className="text-[10px] opacity-40">WETH</span>
            </span>
          </div>
          <div className="flex flex-col border-x border-base-300 px-4">
            <span className="text-[10px] uppercase opacity-40 font-black mb-1">Debt</span>
            <span className="font-black tracking-tighter">
              {parseFloat(formatEther(position?.debtAmount || 0n)).toFixed(2)} <span className="text-[10px] opacity-40">USDC</span>
            </span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] uppercase opacity-40 font-black mb-1">Health</span>
            <span className={`font-black tracking-tighter ${getHFColor()}`}>
              {hfDisplay}
            </span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-1 p-1 bg-base-200 rounded-lg mb-6">
          {(["deposit", "borrow", "repay", "withdraw"] as const).map((tab) => (
            <button
              key={tab}
              className={`flex-1 py-1.5 text-[10px] uppercase font-black rounded-md transition-all ${
                activeTab === tab ? "bg-base-100 shadow-sm text-primary" : "opacity-40 hover:opacity-100"
              }`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Action Form */}
        <div className="space-y-4">
          <div className="relative">
            <input
              type="number"
              placeholder="0.00"
              className="w-full bg-base-200 border-none rounded-xl p-4 pr-16 font-black text-2xl focus:ring-1 focus:ring-primary/30 transition-all outline-none"
              value={
                activeTab === "deposit" ? depositAmount : 
                activeTab === "borrow" ? borrowAmount : 
                activeTab === "repay" ? repayAmount : withdrawAmount
              }
              onChange={(e) => {
                if (activeTab === "deposit") setDepositAmount(e.target.value);
                else if (activeTab === "borrow") setBorrowAmount(e.target.value);
                else if (activeTab === "repay") setRepayAmount(e.target.value);
                else setWithdrawAmount(e.target.value);
              }}
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 font-black opacity-30 text-xs">
              {activeTab === "deposit" || activeTab === "withdraw" ? "WETH" : "USDC"}
            </div>
          </div>

          <button 
            className="w-full py-4 rounded-xl premium-gradient text-white font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-primary/20 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50"
            onClick={() => {
              if (activeTab === "deposit") handleDeposit();
              else if (activeTab === "borrow") handleBorrow();
              else if (activeTab === "repay") handleRepay();
              else handleWithdraw();
            }}
            disabled={poolPending}
          >
            {poolPending ? (
              <ArrowPathIcon className="w-5 h-5 animate-spin" />
            ) : (
              <>
                {activeTab === "deposit" && <ArrowDownCircleIcon className="w-5 h-5" />}
                {activeTab === "borrow" && <ArrowUpCircleIcon className="w-5 h-5" />}
                {activeTab === "repay" && <ArrowPathIcon className="w-5 h-5" />}
                {activeTab === "withdraw" && <ArrowUpCircleIcon className="w-5 h-5" />}
                {activeTab} funds
              </>
            )}
          </button>
          
          <div className="flex items-center justify-center gap-2 opacity-30 text-[10px] font-black uppercase tracking-tighter">
            <ShieldCheckIcon className="w-3 h-3" />
            Instant on-chain settlement
          </div>
        </div>
      </div>
    </div>
  );
};
