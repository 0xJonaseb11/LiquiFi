"use client";

import { useEffect, useState } from "react";
import { BoltIcon, CpuChipIcon, ShieldExclamationIcon } from "@heroicons/react/24/outline";

type RiskData = {
  risk_score: number;
  reasoning: string;
  recommended_threshold: number;
  source: string;
};
export const RiskScoreWidget = () => {
  const [risk, setRisk] = useState<RiskData | null>(null);
  const [loading, setLoading] = useState(false);
  const fetchRisk = async () => {
    setLoading(true);
    try {
      const backendUrl = process.env.NEXT_PUBLIC_AI_BACKEND_URL;
      if (!backendUrl) {
        throw new Error("No backend URL configured");
      }
      const res = await fetch(`${backendUrl}/api/risk-score`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prices: { ETH: 2000, USDC: 1 }, headlines: [] }),
      });
      if (res.ok) {
        const data = await res.json();
        setRisk(data);
      }
    } catch {
      setRisk({
        risk_score: 30,
        reasoning: "AI service offline — using default",
        recommended_threshold: 1.05,
        source: "offline",
      });
    }
    setLoading(false);
  };
  useEffect(() => {
    fetchRisk();
    const interval = setInterval(fetchRisk, 60000);
    return () => clearInterval(interval);
  }, []);
  const getScoreColor = (score: number) => {
    if (score < 30) return "text-success";
    if (score < 60) return "text-warning";
    return "text-error";
  };
  return (
    <div className="bg-base-100 border border-base-300 rounded-xl overflow-hidden shadow-sm h-full flex flex-col">
      <div className="p-4 border-b border-base-300 flex items-center justify-between bg-base-200/30">
        <div className="flex items-center gap-2">
          <CpuChipIcon className="w-4 h-4 text-primary" />
          <h2 className="text-xs uppercase font-black tracking-widest opacity-60">AI Risk Intelligence</h2>
        </div>
        {loading ? (
          <BoltIcon className="w-4 h-4 animate-pulse text-warning" />
        ) : (
          <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded bg-success/20 text-success">Live</span>
        )}
      </div>
      <div className="p-6 flex flex-col flex-grow">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-baseline gap-1">
              <span className={`text-5xl font-black tracking-tighter ${getScoreColor(risk?.risk_score || 0)}`}>
                {risk?.risk_score || "—"}
              </span>
              <span className="text-xs font-black opacity-30 uppercase tracking-widest">Score</span>
            </div>
            <p className="text-[10px] font-bold opacity-40 uppercase tracking-widest mt-1 italic">
              Scale 0-100 (Safe to Critical)
            </p>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-black opacity-30 uppercase tracking-widest block mb-1">
              On-Chain Threshold
            </span>
            <span className="text-2xl font-black tracking-tighter">
              {risk?.recommended_threshold.toFixed(2) || "1.05"}
            </span>
          </div>
        </div>
        <div className="bg-base-200/50 rounded-lg p-3 border border-base-300/50 flex-grow">
          <div className="flex items-start gap-2">
            <ShieldExclamationIcon className="w-4 h-4 opacity-30 mt-0.5" />
            <div>
              <span className="text-[10px] font-black opacity-40 uppercase tracking-widest block mb-1 underline">
                AI Reasoning
              </span>
              <p className="text-xs font-medium leading-relaxed opacity-70 italic">&quot;{risk?.reasoning}&quot;</p>
            </div>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <div
              className={`w-1.5 h-1.5 rounded-full ${risk?.source === "offline" ? "bg-error" : "bg-success"} animate-pulse`}
            />
            <span className="text-[10px] font-bold opacity-40 uppercase tracking-widest">Source: {risk?.source}</span>
          </div>
          <button
            onClick={fetchRisk}
            className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline"
          >
            Refresh Analysis
          </button>
        </div>
      </div>
    </div>
  );
};
