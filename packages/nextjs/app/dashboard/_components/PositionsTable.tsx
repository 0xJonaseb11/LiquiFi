"use client";

import { useEffect, useState } from "react";
import { Address } from "@scaffold-ui/components";
import { formatEther } from "viem";
import { FireIcon } from "@heroicons/react/24/outline";
import { useDeployedContractInfo, useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { useTargetNetwork } from "~~/hooks/scaffold-eth";

type PositionRow = {
  address: string;
  collateral: bigint;
  debt: bigint;
  healthFactor: bigint;
};

export const PositionsTable = () => {
  const [positions, setPositions] = useState<PositionRow[]>([]);
  const { targetNetwork } = useTargetNetwork();

  const { data: poolInfo } = useDeployedContractInfo("LendingPool");
  const { writeContractAsync: writePool } = useScaffoldWriteContract({ contractName: "LendingPool" });
  const { writeContractAsync: writeUSDC } = useScaffoldWriteContract({ contractName: "MockUSDC" });

  const { data: borrowerCount } = useScaffoldReadContract({
    contractName: "LendingPool",
    functionName: "getBorrowerCount",
  });

  const count = borrowerCount ? Number(borrowerCount) : 0;
  const indices = Array.from({ length: Math.min(count, 20) }, (_, i) => i);

  const borrowerReads = indices.map(i => {
    const { data } = useScaffoldReadContract({
      contractName: "LendingPool",
      functionName: "getBorrowerAt",
      args: [BigInt(i)],
    });
    return data;
  });

  const positionReads = borrowerReads.map(addr => {
    const { data: position } = useScaffoldReadContract({
      contractName: "LendingPool",
      functionName: "getPosition",
      args: [addr || "0x0000000000000000000000000000000000000000"],
    });
    const { data: hf } = useScaffoldReadContract({
      contractName: "LendingPool",
      functionName: "getHealthFactor",
      args: [addr || "0x0000000000000000000000000000000000000000"],
    });
    return { address: addr, position, healthFactor: hf };
  });

  useEffect(() => {
    const rows: PositionRow[] = [];
    for (const read of positionReads) {
      if (read.address && read.position && read.position.debtAmount > 0n) {
        rows.push({
          address: read.address,
          collateral: read.position.collateralAmount,
          debt: read.position.debtAmount,
          healthFactor: read.healthFactor || 0n,
        });
      }
    }
    setPositions(rows);
  }, [JSON.stringify(positionReads.map(r => r.address))]);

  const handleLiquidate = async (borrower: string, debt: bigint) => {
    try {
      // Liquidate 50% of debt (assuming 0.5 close factor)
      const repayAmountNormalized = debt / 2n;
      const repayAmountActual = repayAmountNormalized / 10n ** 12n; // 18 -> 6 decimals

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


  const getHFBadge = (hf: bigint) => {
    const hfNum = parseFloat(formatEther(hf));
    if (hf === BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff")) {
      return <span className="text-success font-black">∞ Safe</span>;
    }
    if (hfNum >= 1.5) return <span className="text-success font-black">{hfNum.toFixed(3)}</span>;
    if (hfNum >= 1.0) return <span className="text-warning font-black">{hfNum.toFixed(3)}</span>;
    return <span className="text-error font-black animate-pulse">{hfNum.toFixed(3)}</span>;
  };

  return (
    <div className="bg-base-100 border border-base-300 rounded-xl overflow-hidden shadow-sm">
      <div className="p-4 border-b border-base-300 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ListBulletIcon className="w-4 h-4 opacity-50" />
          <h2 className="text-xs uppercase font-black tracking-widest opacity-60">Active Positions</h2>
        </div>
        <span className="text-[10px] bg-base-200 px-2 py-0.5 rounded-full font-bold opacity-50">
          {positions.length} Positions
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="table table-zebra table-sm">
          <thead>
            <tr className="bg-base-200/50">
              <th className="text-[10px] uppercase font-black tracking-wider py-4">Borrower</th>
              <th className="text-[10px] uppercase font-black tracking-wider">Collateral (WETH)</th>
              <th className="text-[10px] uppercase font-black tracking-wider">Debt (USDC)</th>
              <th className="text-[10px] uppercase font-black tracking-wider">Health Factor</th>
              <th className="text-[10px] uppercase font-black tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {positions.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center opacity-40 py-12 italic text-sm">
                  Zero active positions in protocol
                </td>
              </tr>
            ) : (
              positions.map(pos => (
                <tr key={pos.address} className="hover:bg-primary/5 transition-colors group">
                  <td className="py-4">
                    <Address address={pos.address} chain={targetNetwork} />
                  </td>
                  <td className="font-medium">{parseFloat(formatEther(pos.collateral)).toFixed(4)}</td>
                  <td className="font-medium">{parseFloat(formatEther(pos.debt)).toFixed(2)}</td>
                  <td>{getHFBadge(pos.healthFactor)}</td>
                  <td className="text-right">
                    <button
                      className="btn btn-ghost btn-xs text-error hover:bg-error/10 disabled:opacity-30"
                      onClick={() => handleLiquidate(pos.address, pos.debt)}
                      disabled={parseFloat(formatEther(pos.healthFactor)) >= 1.0}
                    >
                      <FireIcon className="w-3.5 h-3.5 mr-1" />
                      Liquidate
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
