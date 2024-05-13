"use client";

import { useState } from "react";
import { parseEther, parseUnits } from "viem";
import {
  AdjustmentsHorizontalIcon,
  BoltIcon,
  CurrencyDollarIcon,
  FireIcon,
  PauseIcon,
  PlayIcon,
} from "@heroicons/react/24/outline";
import { useDeployedContractInfo, useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";

export const AdminPanel = () => {
  const [ethPrice, setEthPrice] = useState("2000");
  const [liquidateAddr, setLiquidateAddr] = useState("");
  const [liquidateAmount, setLiquidateAmount] = useState("");
  const [newLtv, setNewLtv] = useState("75");
  const [seedAmount, setSeedAmount] = useState("");
  const [closeFactor, setCloseFactor] = useState("50");
  const [incentive, setIncentive] = useState("5");
  const [threshold, setThreshold] = useState("100");

  const { data: wethInfo } = useDeployedContractInfo("MockWETH");
  const { data: usdcInfo } = useDeployedContractInfo("MockUSDC");
  const { data: poolInfo } = useDeployedContractInfo("LendingPool");

  const { writeContractAsync: writeOracle, isPending: oraclePending } = useScaffoldWriteContract({
    contractName: "PriceOracle",
  });

  const { writeContractAsync: writePool, isPending: poolPending } = useScaffoldWriteContract({
    contractName: "LendingPool",
  });

  const { writeContractAsync: writeUSDC } = useScaffoldWriteContract({
    contractName: "MockUSDC",
  });

  const { data: isPaused } = useScaffoldReadContract({
    contractName: "LendingPool",
    functionName: "paused",
  });

  const handleSetPrice = async () => {
    try {
      const ethPrice8 = BigInt(Math.round(parseFloat(ethPrice) * 1e8));
      const usdcPrice8 = BigInt(1 * 1e8); // USDC is $1

      if (wethInfo?.address) {
        await writeOracle({
          functionName: "setPrice",
          args: [wethInfo.address, ethPrice8],
        });
      }
      if (usdcInfo?.address) {
        await writeOracle({
          functionName: "setPrice",
          args: [usdcInfo.address, usdcPrice8],
        });
      }
    } catch (e) {
      console.error("Set price failed:", e);
    }
  };

  const handleSeedLiquidity = async () => {
    try {
      const amount = parseUnits(seedAmount, 6);
      await writeUSDC({
        functionName: "approve",
        args: [poolInfo?.address, amount],
      });
      await writePool({
        functionName: "seedLiquidity",
        args: [amount],
      });
      setSeedAmount("");
    } catch (e) {
      console.error("Seed liquidity failed:", e);
    }
  };

  const handleLiquidate = async () => {
    try {
      const amount = parseUnits(liquidateAmount, 6);
      await writeUSDC({
        functionName: "approve",
        args: [poolInfo?.address, amount],
      });
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

  const handleSetLiquidationParams = async () => {
    try {
      const cfWei = parseEther((parseFloat(closeFactor) / 100).toString());
      const liWei = parseEther((parseFloat(incentive) / 100).toString());
      await writePool({
        functionName: "setLiquidationParams",
        args: [cfWei, liWei],
      });
    } catch (e) {
      console.error("Set Liquidation Params failed:", e);
    }
  };

  const handleSetThreshold = async () => {
    try {
      const thresholdWei = parseEther((parseFloat(threshold) / 100).toString());
      await writePool({
        functionName: "setLiquidationThreshold",
        args: [thresholdWei],
      });
    } catch (e) {
      console.error("Set Threshold failed:", e);
    }
  };

  const handleTogglePause = async () => {
    try {
      await writePool({
        functionName: isPaused ? "unpause" : "pause",
      });
    } catch (e) {
      console.error("Toggle pause failed:", e);
    }
  };

  return (
    <div className="bg-base-100 border border-base-300 rounded-xl overflow-hidden shadow-sm flex flex-col">
      <div className="p-4 border-b border-base-300 flex items-center justify-between bg-base-200/30">
        <div className="flex items-center gap-2">
          <AdjustmentsHorizontalIcon className="w-4 h-4 opacity-50" />
          <h2 className="text-xs uppercase font-black tracking-widest opacity-60">Protocol Override</h2>
        </div>
        <button
          className={`btn btn-xs rounded-md ${isPaused ? "btn-success" : "btn-error"}`}
          onClick={handleTogglePause}
          disabled={poolPending}
        >
          {isPaused ? <PlayIcon className="w-3 h-3 mr-1" /> : <PauseIcon className="w-3 h-3 mr-1" />}
          {isPaused ? "Resume" : "Halt"}
        </button>
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

        <div className="border-t border-base-300/50" />

        {/* Seed Liquidity */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <CurrencyDollarIcon className="w-3.5 h-3.5 opacity-50" />
            <span className="text-[10px] uppercase font-black tracking-widest opacity-40">Seed USDC Liquidity</span>
          </div>
          <div className="flex gap-2">
            <input
              type="number"
              className="bg-base-200 border-none rounded-lg p-2 flex-1 text-sm font-bold outline-none focus:ring-1 focus:ring-primary/20"
              value={seedAmount}
              onChange={e => setSeedAmount(e.target.value)}
              placeholder="Amount (USDC)"
            />
            <button className="btn btn-accent btn-sm rounded-lg" onClick={handleSeedLiquidity} disabled={poolPending}>
              Seed
            </button>
          </div>
        </div>

        <div className="border-t border-base-300/50" />

        {/* Liquidation Config */}
        <div className="space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <FireIcon className="w-3.5 h-3.5 opacity-50" />
              <span className="text-[10px] uppercase font-black tracking-widest opacity-40">
                Liquidation Parameters
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div className="flex flex-col gap-1">
                <span className="text-[9px] uppercase font-bold opacity-30 px-1">Close Factor (%)</span>
                <input
                  type="number"
                  className="bg-base-200 border-none rounded-lg p-2 text-xs font-bold outline-none"
                  value={closeFactor}
                  onChange={e => setCloseFactor(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[9px] uppercase font-bold opacity-30 px-1">Incentive (%)</span>
                <input
                  type="number"
                  className="bg-base-200 border-none rounded-lg p-2 text-xs font-bold outline-none"
                  value={incentive}
                  onChange={e => setIncentive(e.target.value)}
                />
              </div>
            </div>
            <button
              className="btn btn-neutral btn-block btn-sm rounded-lg"
              onClick={handleSetLiquidationParams}
              disabled={poolPending}
            >
              Update Risk Params
            </button>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <BoltIcon className="w-3.5 h-3.5 opacity-50" />
              <span className="text-[10px] uppercase font-black tracking-widest opacity-40">AI Risk Threshold</span>
            </div>
            <div className="flex gap-2">
              <input
                type="number"
                className="bg-base-200 border-none rounded-lg p-2 flex-1 text-sm font-bold outline-none"
                value={threshold}
                onChange={e => setThreshold(e.target.value)}
              />
              <button className="btn btn-primary btn-sm rounded-lg" onClick={handleSetThreshold} disabled={poolPending}>
                Sync
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
