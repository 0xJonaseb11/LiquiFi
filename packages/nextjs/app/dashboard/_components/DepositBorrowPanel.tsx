"use client";

import { useState } from "react";
import { formatEther, parseEther, parseUnits } from "viem";
import {
  ArrowDownCircleIcon,
  ArrowPathIcon,
  ArrowUpCircleIcon,
  BanknotesIcon,
  CreditCardIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";
import { useChainContext } from "~~/contexts/ChainContext";
import { useDeployedContractInfo } from "~~/hooks/scaffold-eth";
import { useChainAccount } from "~~/hooks/useChainAccount";
import { useChainReadContract, useChainWriteContract } from "~~/hooks/useChainContract";

export const DepositBorrowPanel = () => {
  const { address } = useChainAccount();
  const { isEvm } = useChainContext();
  const [depositAmount, setDepositAmount] = useState("");
  const [borrowAmount, setBorrowAmount] = useState("");
  const [repayAmount, setRepayAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [activeTab, setActiveTab] = useState<"supply" | "borrow" | "repay" | "withdraw">("supply");
  const { data: position } = useChainReadContract({
    contractName: "LendingPool",
    functionName: "getPosition",
    args: [address || "0x0000000000000000000000000000000000000000"],
  });
  const { data: healthFactor } = useChainReadContract({
    contractName: "LendingPool",
    functionName: "getHealthFactor",
    args: [address || "0x0000000000000000000000000000000000000000"],
  });
  const { writeContractAsync: writeMockCollateral } = useChainWriteContract({
    contractName: isEvm ? "MockWETH" : "MockWDOT",
  });
  const { writeContractAsync: writeMockUSDC } = useChainWriteContract({
    contractName: "MockUSDC",
  });
  const { writeContractAsync: writePool, isPending: poolPending } = useChainWriteContract({
    contractName: "LendingPool",
  });
  const { data: lendingPoolInfo } = useDeployedContractInfo({ contractName: "LendingPool" });
  const handleMintTokens = async () => {
    try {
      if (!address) return;
      await writeMockCollateral({
        functionName: "mint",
        args: [address, parseEther("100")],
      });
      await writeMockUSDC({
        functionName: "mint",
        args: [address, parseUnits("100000", 6)],
      });
    } catch (e) {
      console.error("Mint failed:", e);
    }
  };
  const handleDeposit = async () => {
    try {
      const amount = parseEther(depositAmount);
      await writeMockCollateral({
        functionName: "approve",
        args: [lendingPoolInfo?.address, amount],
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
        args: [lendingPoolInfo?.address, amount],
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
  const hfNum = healthFactor ? Number.parseFloat(formatEther(healthFactor)) : 0;
  let hfDisplay = "—";
  if (healthFactor) {
    if (healthFactor === BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff")) {
      hfDisplay = "∞";
    } else {
      hfDisplay = hfNum.toFixed(3);
    }
  }
  const getHFColor = () => {
    if (hfDisplay === "∞" || hfNum >= 1.5) return "text-success";
    if (hfNum >= 1) return "text-warning";
    return "text-error";
  };
  const getActiveTabState = () => {
    switch (activeTab) {
      case "supply":
        return { value: depositAmount, unit: isEvm ? "WETH" : "wDOT", label: "Supply Assets" };
      case "borrow":
        return { value: borrowAmount, unit: "USDC", label: "Borrow Funds" };
      case "repay":
        return { value: repayAmount, unit: "USDC", label: "Repay Debt" };
      case "withdraw":
        return { value: withdrawAmount, unit: isEvm ? "WETH" : "wDOT", label: "Withdraw Assets" };
      default:
        return { value: "", unit: "", label: "" };
    }
  };

  const { value: inputValue, unit: unitLabel, label: buttonLabel } = getActiveTabState();
  return (
    <div className="bg-base-100 border border-base-300 rounded-xl overflow-hidden shadow-sm flex flex-col h-full">
      <div className="p-4 border-b border-base-300 flex items-center justify-between bg-base-200/30">
        <div className="flex items-center gap-2">
          <CreditCardIcon className="w-4 h-4 opacity-50" />
          <h2 className="text-xs uppercase font-black tracking-widest opacity-60 text-gradient">Position Control</h2>
        </div>
        <button
          onClick={handleMintTokens}
          className="btn btn-xs btn-outline btn-primary rounded-full px-4 text-[10px] font-black tracking-wider uppercase flex items-center gap-1"
        >
          <BanknotesIcon className="w-3 h-3" />
          Mint Test Tokens
        </button>
      </div>
      <div className="p-6 flex-grow">
        {}
        <div className="grid grid-cols-3 gap-4 mb-8 bg-base-200/50 p-4 rounded-xl border border-base-300/50">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase opacity-40 font-black mb-1">Backing Assets</span>
            <span className="font-black tracking-tighter">
              {Number.parseFloat(formatEther(position?.collateralAmount || 0n)).toFixed(3)}{" "}
              <span className="text-[10px] opacity-40">{isEvm ? "WETH" : "wDOT"}</span>
            </span>
          </div>
          <div className="flex flex-col border-x border-base-300 px-4">
            <span className="text-[10px] uppercase opacity-40 font-black mb-1">Active Borrowing</span>
            <span className="font-black tracking-tighter">
              {Number.parseFloat(formatEther(position?.debtAmount || 0n)).toFixed(2)}{" "}
              <span className="text-[10px] opacity-40">USDC</span>
            </span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] uppercase opacity-40 font-black mb-1">Safety Score</span>
            <span className={`font-black tracking-tighter ${getHFColor()}`}>{hfDisplay}</span>
          </div>
        </div>
        {}
        <div className="flex gap-1 p-1 bg-base-200 rounded-lg mb-6">
          {(["supply", "borrow", "repay", "withdraw"] as const).map(tab => (
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
        {}
        <div className="space-y-4">
          <div className="relative">
            <input
              type="number"
              placeholder="0"
              className="w-full bg-base-200 border-none rounded-xl p-4 pr-16 font-black text-2xl focus:ring-1 focus:ring-primary/30 transition-all outline-none"
              value={inputValue}
              onChange={e => {
                if (activeTab === "supply") setDepositAmount(e.target.value);
                else if (activeTab === "borrow") setBorrowAmount(e.target.value);
                else if (activeTab === "repay") setRepayAmount(e.target.value);
                else setWithdrawAmount(e.target.value);
              }}
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 font-black opacity-30 text-xs">{unitLabel}</div>
          </div>
          <button
            className="w-full py-4 rounded-xl premium-gradient text-white font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-primary/20 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50"
            onClick={() => {
              if (activeTab === "supply") handleDeposit();
              else if (activeTab === "borrow") handleBorrow();
              else if (activeTab === "repay") handleRepay();
              else handleWithdraw();
            }}
            disabled={poolPending || !lendingPoolInfo?.address}
          >
            {poolPending ? (
              <ArrowPathIcon className="w-5 h-5 animate-spin" />
            ) : (
              <>
                {activeTab === "supply" && <ArrowDownCircleIcon className="w-5 h-5" />}
                {activeTab === "borrow" && <ArrowUpCircleIcon className="w-5 h-5" />}
                {activeTab === "repay" && <ArrowPathIcon className="w-5 h-5" />}
                {activeTab === "withdraw" && <ArrowUpCircleIcon className="w-5 h-5" />}
                {buttonLabel}
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
