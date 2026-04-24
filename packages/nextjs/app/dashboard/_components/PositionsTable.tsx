"use client";

import { useEffect, useState } from "react";
import { Address } from "@scaffold-ui/components";
import { formatEther } from "viem";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";
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

  const { data: borrowerCount } = useScaffoldReadContract({
    contractName: "LendingPool",
    functionName: "getBorrowerCount",
  });

  // We need to fetch each borrower individually — SE-2 hooks don't support loops,
  // so we use a manual approach with indices 0..N
  const count = borrowerCount ? Number(borrowerCount) : 0;

  // Fetch borrowers by index — we'll support up to 20 for the dashboard
  const indices = Array.from({ length: Math.min(count, 20) }, (_, i) => i);

  // Individual borrower reads
  const borrowerReads = indices.map(i => {
    const { data } = useScaffoldReadContract({
      contractName: "LendingPool",
      functionName: "getBorrowerAt",
      args: [BigInt(i)],
    });
    return data;
  });

  // Fetch positions for each borrower
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

  const getHFBadge = (hf: bigint) => {
    const hfNum = parseFloat(formatEther(hf));
    if (hf === BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff")) {
      return <span className="badge badge-success badge-sm">∞ Safe</span>;
    }
    if (hfNum >= 1.5) return <span className="badge badge-success badge-sm">{hfNum.toFixed(3)}</span>;
    if (hfNum >= 1.0) return <span className="badge badge-warning badge-sm">{hfNum.toFixed(3)}</span>;
    return <span className="badge badge-error badge-sm animate-pulse">{hfNum.toFixed(3)} ⚠️</span>;
  };

  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body">
        <h2 className="card-title">📋 Active Positions</h2>
        <div className="overflow-x-auto">
          <table className="table table-sm">
            <thead>
              <tr>
                <th>Borrower</th>
                <th>Collateral (WETH)</th>
                <th>Debt (USDC norm.)</th>
                <th>Health Factor</th>
              </tr>
            </thead>
            <tbody>
              {positions.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center opacity-50 py-8">
                    No active positions
                  </td>
                </tr>
              ) : (
                positions.map(pos => (
                  <tr key={pos.address} className="hover">
                    <td>
                      <Address address={pos.address} chain={targetNetwork} />
                    </td>
                    <td>{parseFloat(formatEther(pos.collateral)).toFixed(4)}</td>
                    <td>{parseFloat(formatEther(pos.debt)).toFixed(2)}</td>
                    <td>{getHFBadge(pos.healthFactor)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="text-xs opacity-50 mt-2">
          Showing {positions.length} of {count} total borrowers
        </p>
      </div>
    </div>
  );
};
