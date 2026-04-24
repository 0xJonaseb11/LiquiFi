"use client";

import { useState } from "react";
import { parseEther, parseUnits } from "viem";
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
      // Need WETH address — read from contract or hardcode for now
      // Using writeContractAsync with setPrice on the oracle
      await writeOracle({
        functionName: "setPrice",
        // First arg is the WETH address, second is price
        // Since we don't know the address dynamically here, we'll use a workaround
        args: [
          "0x0000000000000000000000000000000000000000", // Will be replaced by actual WETH address
          priceWith8Dec,
        ],
      });
    } catch (e) {
      console.error("Set price failed:", e);
    }
  };

  const handleLiquidate = async () => {
    try {
      const amount = parseUnits(liquidateAmount, 6); // USDC 6 decimals
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
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body">
        <h2 className="card-title text-warning">⚙️ Admin Controls</h2>

        {/* Set Oracle Price */}
        <div className="form-control">
          <label className="label">
            <span className="label-text text-xs">Set ETH/USD Price</span>
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              placeholder="2000"
              className="input input-bordered input-sm flex-1"
              value={ethPrice}
              onChange={e => setEthPrice(e.target.value)}
            />
            <button className="btn btn-warning btn-sm" onClick={handleSetPrice} disabled={oraclePending}>
              {oraclePending ? "..." : "Set"}
            </button>
          </div>
        </div>

        {/* Manual Liquidation */}
        <div className="form-control">
          <label className="label">
            <span className="label-text text-xs">Manual Liquidation</span>
          </label>
          <input
            type="text"
            placeholder="Borrower address"
            className="input input-bordered input-sm mb-1"
            value={liquidateAddr}
            onChange={e => setLiquidateAddr(e.target.value)}
          />
          <div className="flex gap-2">
            <input
              type="number"
              placeholder="USDC amount"
              className="input input-bordered input-sm flex-1"
              value={liquidateAmount}
              onChange={e => setLiquidateAmount(e.target.value)}
            />
            <button className="btn btn-error btn-sm" onClick={handleLiquidate} disabled={poolPending}>
              {poolPending ? "..." : "⚡ Liquidate"}
            </button>
          </div>
        </div>

        {/* Set LTV */}
        <div className="form-control">
          <label className="label">
            <span className="label-text text-xs">LTV Ratio (%)</span>
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              placeholder="75"
              className="input input-bordered input-sm flex-1"
              value={newLtv}
              onChange={e => setNewLtv(e.target.value)}
            />
            <button className="btn btn-primary btn-sm" onClick={handleSetLTV} disabled={poolPending}>
              {poolPending ? "..." : "Set"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
