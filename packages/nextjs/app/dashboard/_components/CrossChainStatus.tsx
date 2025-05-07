"use client";

import {
  ArrowPathIcon,
  ArrowPathRoundedSquareIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  GlobeAltIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";
import { useChainContext } from "~~/contexts/ChainContext";
import { useChainReadContract, useChainWriteContract } from "~~/hooks/useChainContract";

export const CrossChainStatus = () => {
  const { isEvm } = useChainContext();
  const { data: nextId } = useChainReadContract({
    contractName: isEvm ? "CrossChainLiquidator" : "XCMLiquidator",
    functionName: isEvm ? "nextRequestId" : "next_request_id",
  });
  const lastId = nextId ? Number(nextId) - 1 : 0;
  const requestIds = Array.from({ length: Math.min(lastId, 5) }, (_, i) => lastId - i);
  return (
    <div className="bg-base-100 border border-base-300 rounded-xl overflow-hidden shadow-sm">
      <div className="p-4 border-b border-base-300 flex items-center gap-2 bg-base-200/30">
        <GlobeAltIcon className="w-4 h-4 opacity-50" />
        <h2 className="text-xs uppercase font-black tracking-widest opacity-60">Cross-Chain Sync</h2>
      </div>
      <div className="p-4">
        {requestIds.length === 0 ? (
          <div className="text-center py-6 opacity-30 text-[10px] font-black uppercase">No active bridge requests</div>
        ) : (
          <div className="space-y-3">
            {requestIds.map(id => (
              <RequestItem key={id} id={BigInt(id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
const RequestItem = ({ id }: { id: bigint }) => {
  const { isEvm } = useChainContext();
  const { data: request } = useChainReadContract({
    contractName: isEvm ? "CrossChainLiquidator" : "XCMLiquidator",
    functionName: isEvm ? "requests" : "get_request",
    args: [id],
  });
  const { writeContractAsync: writeCC } = useChainWriteContract({
    contractName: isEvm ? "CrossChainLiquidator" : "XCMLiquidator",
  });
  if (!request) return null;
  const states = ["NONE", "PENDING", "BRIDGING", "CONFIRMING", "EXECUTING", "COMPLETE", "FAILED"];
  const state = states[Number(request[3])] || "UNKNOWN";
  const getStatusIcon = () => {
    if (state === "COMPLETE") return <CheckCircleIcon className="w-4 h-4 text-success" />;
    if (state === "FAILED") return <ExclamationTriangleIcon className="w-4 h-4 text-error" />;
    return <ArrowPathIcon className="w-4 h-4 text-primary animate-spin" />;
  };
  let stateColorClass = "bg-primary/20 text-primary";
  if (state === "COMPLETE") {
    stateColorClass = "bg-success/20 text-success";
  } else if (state === "FAILED") {
    stateColorClass = "bg-error/20 text-error";
  }
  return (
    <div className="flex flex-col bg-base-200/50 rounded-lg border border-base-300/50 overflow-hidden">
      <div className="flex items-center justify-between p-3">
        <div className="flex items-center gap-3">
          {getStatusIcon()}
          <div>
            <div className="text-[10px] font-black opacity-40 uppercase leading-none mb-1">REQ #{id.toString()}</div>
            <div className="text-xs font-bold truncate max-w-[120px]">{request[1]}</div>
          </div>
        </div>
        <div className="text-right">
          <div className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${stateColorClass}`}>{state}</div>
          <div className="text-[10px] opacity-40 font-bold mt-1">{Number(request[2]) / 1e6} USDC</div>
        </div>
      </div>
      {(state === "CONFIRMING" || state === "FAILED") && (
        <div className="flex border-t border-base-300/50">
          {state === "CONFIRMING" && (
            <button
              className="flex-1 py-1.5 bg-success/10 hover:bg-success/20 text-success text-[10px] font-black uppercase flex items-center justify-center gap-1 transition-colors"
              onClick={() => writeCC({ functionName: "confirmFundsReceived", args: [id] })}
            >
              <ShieldCheckIcon className="w-3 h-3" />
              Confirm Arrival
            </button>
          )}
          {state === "FAILED" && (
            <button
              className="flex-1 py-1.5 bg-warning/10 hover:bg-warning/20 text-warning text-[10px] font-black uppercase flex items-center justify-center gap-1 transition-colors"
              onClick={() => writeCC({ functionName: "retry", args: [id] })}
            >
              <ArrowPathRoundedSquareIcon className="w-3 h-3" />
              Retry Bridge
            </button>
          )}
        </div>
      )}
    </div>
  );
};
