"use client";

import { useState } from "react";
import { parseEther, parseUnits } from "viem";
import { AdjustmentsHorizontalIcon, BoltIcon, CurrencyDollarIcon, FireIcon } from "@heroicons/react/24/outline";
import { useScaffoldWriteContract } from "~~/hooks/scaffold-eth";

export const AdminPanel = () => {
  const [ethPrice, setEthPrice] = useState("2000");
  const [liquidateAddr, setLiquidateAddr] = useState("");
  const [liquidateAmount, setLiquidateAmount] = useState("");
  const [newLtv, setNewLtv] = useState("75");

  const { writeContractAsync: writeOracle, isPending: oraclePending } = useScaffoldWriteContract({
    contractName: "PriceOracle",
  });

  const { writeContractAsync: writePool, isPending: poolPending } = useScaffoldWriteContract({
    contractName: "LendingPool",
  });

  const handleSetPrice = async () => {
    try {
      const priceWith8Dec = BigInt(Math.round(parseFloat(ethPrice) * 1e8));
      await writeOracle({
        functionName: "setPrice",
        args: ["0x0000000000000000000000000000000000000000", priceWith8Dec],
      });
    } catch (e) {
      console.error("Set price failed:", e);
    }
  };

  const handleLiquidate = async () => {
    try {
      const amount = parseUnits(liquidateAmount, 6);
      await writePool({
        functionName: "liquidate",
        args: [liquidateAddr, amount],
      });
    } catch (e) {
      console.error("Liquidation failed:", e);
    }
  };

  const handleSetLTV = async () => {
    try {
      const ltvWei = parseEther((parseFloat(newLtv) / 100).toString());
      await writePool({
        functionName: "setLTV",
        args: [ltvWei],
      });
    } catch (e) {
      console.error("Set LTV failed:", e);
    }
  };

  return (
    <div className="bg-base-100 border border-base-300 rounded-xl overflow-hidden shadow-sm flex flex-col">
      <div className="p-4 border-b border-base-300 flex items-center gap-2 bg-base-200/30">
        <AdjustmentsHorizontalIcon className="w-4 h-4 opacity-50" />
        <h2 className="text-xs uppercase font-black tracking-widest opacity-60">Protocol Override</h2>
      </div>

      <div className="p-6 space-y-6">
        {/* Set Oracle Price */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <CurrencyDollarIcon className="w-3.5 h-3.5 opacity-50" />
            <span className="text-[10px] uppercase font-black tracking-widest opacity-40">Price Feed Emulator</span>
          </div>
          <div className="flex gap-2">
            <input
              type="number"
              className="bg-base-200 border-none rounded-lg p-2 flex-1 text-sm font-bold outline-none focus:ring-1 focus:ring-primary/20"
              value={ethPrice}
              onChange={e => setEthPrice(e.target.value)}
            />
            <button className="btn btn-primary btn-sm rounded-lg" onClick={handleSetPrice} disabled={oraclePending}>
              Update
            </button>
          </div>
        </div>

        <div className="border-t border-base-300/50" />

        {/* Manual Liquidation */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <FireIcon className="w-3.5 h-3.5 text-error opacity-50" />
            <span className="text-[10px] uppercase font-black tracking-widest opacity-40">Emergency Liquidation</span>
          </div>
          <input
            type="text"
            placeholder="Target Wallet Address"
            className="w-full bg-base-200 border-none rounded-lg p-2 text-xs font-medium mb-2 outline-none focus:ring-1 focus:ring-error/20"
            value={liquidateAddr}
            onChange={e => setLiquidateAddr(e.target.value)}
          />
          <div className="flex gap-2">
            <input
              type="number"
              placeholder="Debt Amount"
              className="bg-base-200 border-none rounded-lg p-2 flex-1 text-sm font-bold outline-none focus:ring-1 focus:ring-error/20"
              value={liquidateAmount}
              onChange={e => setLiquidateAmount(e.target.value)}
            />
            <button
              className="btn btn-error btn-sm rounded-lg flex gap-2"
              onClick={handleLiquidate}
              disabled={poolPending}
            >
              <BoltIcon className="w-3 h-3" />
              Burn
            </button>
          </div>
        </div>

        <div className="border-t border-base-300/50" />

        {/* Set LTV */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <AdjustmentsHorizontalIcon className="w-3.5 h-3.5 opacity-50" />
            <span className="text-[10px] uppercase font-black tracking-widest opacity-40">System LTV Ratio (%)</span>
          </div>
          <div className="flex gap-2">
            <input
              type="number"
              className="bg-base-200 border-none rounded-lg p-2 flex-1 text-sm font-bold outline-none focus:ring-1 focus:ring-primary/20"
              value={newLtv}
              onChange={e => setNewLtv(e.target.value)}
            />
            <button className="btn btn-neutral btn-sm rounded-lg" onClick={handleSetLTV} disabled={poolPending}>
              Config
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
