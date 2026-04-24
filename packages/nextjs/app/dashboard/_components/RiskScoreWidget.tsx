"use client";

import { useEffect, useState } from "react";

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
      const res = await fetch("http://127.0.0.1:8000/api/risk-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prices: { ETH: 2000, USDC: 1 }, headlines: [] }),
      });
      if (res.ok) {
        const data = await res.json();
        setRisk(data);
      }
    } catch {
      // AI service unavailable
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

  const getScoreBg = (score: number) => {
    if (score < 30) return "radial-progress text-success";
    if (score < 60) return "radial-progress text-warning";
    return "radial-progress text-error";
  };

  return (
    <div className="card bg-base-100 shadow-md">
      <div className="card-body p-4 flex-row items-center gap-4">
        <div>
          <div className="text-xs opacity-60 uppercase">AI Risk Score</div>
          {risk ? (
            <div className="flex items-center gap-3">
              <span className={`text-3xl font-bold ${getScoreColor(risk.risk_score)}`}>{risk.risk_score}</span>
              <span className="text-xs opacity-50">/100</span>
            </div>
          ) : (
            <span className="loading loading-spinner loading-sm"></span>
          )}
          {risk && (
            <div className="text-xs opacity-50 max-w-48 truncate" title={risk.reasoning}>
              {risk.reasoning}
            </div>
          )}
        </div>
        <div className="flex flex-col items-end text-xs">
          {risk && (
            <>
              <span className="badge badge-ghost badge-xs">{risk.source}</span>
              <span className="opacity-50 mt-1">Threshold: {risk.recommended_threshold.toFixed(2)}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
