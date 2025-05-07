"use client";

import { formatEther } from "viem";
import { FireIcon, ListBulletIcon } from "@heroicons/react/24/outline";
import { useChainContext } from "~~/contexts/ChainContext";
import { useDeployedContractInfo } from "~~/hooks/scaffold-eth";
import { useChainReadContract, useChainWriteContract } from "~~/hooks/useChainContract";

export const PositionsTable = () => {
  const { data: borrowerCount } = useChainReadContract({
    contractName: "LendingPool",
    functionName: "getBorrowerCount",
  });
  const count = borrowerCount ? Number(borrowerCount) : 0;
  const indices = Array.from({ length: Math.min(count, 20) }, (_, i) => i);
  return (
    <div className="bg-base-100 border border-base-300 rounded-xl overflow-hidden shadow-sm">
      <div className="p-4 border-b border-base-300 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ListBulletIcon className="w-4 h-4 opacity-50" />
          <h2 className="text-xs uppercase font-black tracking-widest opacity-60">Active Positions</h2>
        </div>
        <span className="text-[10px] bg-base-200 px-2 py-0.5 rounded-full font-bold opacity-50">
          {count} Total Borrowers
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="table table-zebra table-sm">
          <thead>
            <tr className="bg-base-200/50">
              <th className="text-[10px] uppercase font-black tracking-wider py-4">Borrower</th>
              <th className="text-[10px] uppercase font-black tracking-wider">Collateral</th>
              <th className="text-[10px] uppercase font-black tracking-wider">Debt (USDC)</th>
              <th className="text-[10px] uppercase font-black tracking-wider">Health Factor</th>
              <th className="text-[10px] uppercase font-black tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {count === 0 ? (
              <tr>
                <td colSpan={5} className="text-center opacity-40 py-12 italic text-sm">
                  Zero active positions in protocol
                </td>
              </tr>
            ) : (
              indices.map(i => <PositionItem key={i} index={BigInt(i)} />)
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
const PositionItem = ({ index }: { index: bigint }) => {
  const { data: poolInfo } = useDeployedContractInfo({ contractName: "LendingPool" });
  const { writeContractAsync: writePool } = useChainWriteContract({ contractName: "LendingPool" });
  const { writeContractAsync: writeUSDC } = useChainWriteContract({ contractName: "MockUSDC" });
  const { data: borrower } = useChainReadContract({
    contractName: "LendingPool",
    functionName: "getBorrowerAt",
    args: [index],
  });
  const { data: position } = useChainReadContract({
    contractName: "LendingPool",
    functionName: "getPosition",
    args: [borrower || "0x0000000000000000000000000000000000000000"],
  });
  const { data: hf } = useChainReadContract({
    contractName: "LendingPool",
    functionName: "getHealthFactor",
    args: [borrower || "0x0000000000000000000000000000000000000000"],
  });
  if (!borrower || !position || position.debtAmount === 0n) return null;
  const handleLiquidate = async () => {
    try {
      const repayAmountNormalized = position.debtAmount / 2n;
      const repayAmountActual = repayAmountNormalized / 10n ** 12n;
      await writeUSDC({
        functionName: "approve",
        args: [poolInfo?.address, repayAmountActual],
      });
      await writePool({
        functionName: "liquidate",
        args: [borrower, repayAmountActual],
      });
    } catch (e) {
      console.error("Liquidation failed:", e);
    }
  };
  const getHFBadge = (hfVal: bigint) => {
    const hfNum = parseFloat(formatEther(hfVal));
    if (hfVal === BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff")) {
      return <span className="text-success font-black">∞ Safe</span>;
    }
    if (hfNum >= 1.5) return <span className="text-success font-black">{hfNum.toFixed(3)}</span>;
    if (hfNum >= 1.0) return <span className="text-warning font-black">{hfNum.toFixed(3)}</span>;
    return <span className="text-error font-black animate-pulse">{hfNum.toFixed(3)}</span>;
  };
  return (
    <tr className="hover:bg-primary/5 transition-colors group">
      <td className="py-4 font-mono text-xs opacity-80">
        {borrower.slice(0, 6)}...{borrower.slice(-4)}
      </td>
      <td className="font-medium">{Number.parseFloat(formatEther(position.collateralAmount)).toFixed(4)}</td>
      <td className="font-medium">{Number.parseFloat(formatEther(position.debtAmount)).toFixed(2)}</td>
      <td>{getHFBadge(hf || 0n)}</td>
      <td className="text-right">
        <button
          className="btn btn-ghost btn-xs text-error hover:bg-error/10 disabled:opacity-30"
          onClick={handleLiquidate}
          disabled={Number.parseFloat(formatEther(hf || 0n)) >= 1.0}
        >
          <FireIcon className="w-3.5 h-3.5 mr-1" />
          Liquidate
        </button>
      </td>
    </tr>
  );
};
