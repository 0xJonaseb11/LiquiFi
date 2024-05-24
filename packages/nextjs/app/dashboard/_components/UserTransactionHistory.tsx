"use client";

import { formatEther, formatUnits } from "viem";
import { useAccount } from "wagmi";
import { ArrowDownRightIcon, ArrowUpRightIcon, ClockIcon } from "@heroicons/react/24/outline";
import { useScaffoldEventHistory } from "~~/hooks/scaffold-eth";

type HistoryEvent = {
  type: "Deposit" | "Withdraw" | "Borrow" | "Repay" | "Liquidation";
  amount: bigint;
  asset: string;
  txHash: string;
  blockNumber: bigint;
};

export const UserTransactionHistory = () => {
  const { address } = useAccount();

  const { data: depositEvents, isLoading: isDepositLoading } = useScaffoldEventHistory({
    contractName: "LendingPool",
    eventName: "Deposit",
    fromBlock: 0n,
    filters: { user: address },
  });

  const { data: withdrawEvents, isLoading: isWithdrawLoading } = useScaffoldEventHistory({
    contractName: "LendingPool",
    eventName: "Withdraw",
    fromBlock: 0n,
    filters: { user: address },
  });

  const { data: borrowEvents, isLoading: isBorrowLoading } = useScaffoldEventHistory({
    contractName: "LendingPool",
    eventName: "Borrow",
    fromBlock: 0n,
    filters: { user: address },
  });

  const { data: repayEvents, isLoading: isRepayLoading } = useScaffoldEventHistory({
    contractName: "LendingPool",
    eventName: "Repay",
    fromBlock: 0n,
    filters: { user: address },
  });

  const isLoading = isDepositLoading || isWithdrawLoading || isBorrowLoading || isRepayLoading;

  const history: HistoryEvent[] = [];

  if (depositEvents) {
    depositEvents.forEach((e: any) => {
      history.push({
        type: "Deposit",
        amount: e.args.amount || 0n,
        asset: "WETH",
        txHash: e.transactionHash,
        blockNumber: e.blockNumber,
      });
    });
  }

  if (withdrawEvents) {
    withdrawEvents.forEach((e: any) => {
      history.push({
        type: "Withdraw",
        amount: e.args.amount || 0n,
        asset: "WETH",
        txHash: e.transactionHash,
        blockNumber: e.blockNumber,
      });
    });
  }

  if (borrowEvents) {
    borrowEvents.forEach((e: any) => {
      history.push({
        type: "Borrow",
        amount: e.args.amount || 0n,
        asset: "USDC",
        txHash: e.transactionHash,
        blockNumber: e.blockNumber,
      });
    });
  }

  if (repayEvents) {
    repayEvents.forEach((e: any) => {
      history.push({
        type: "Repay",
        amount: e.args.amount || 0n,
        asset: "USDC",
        txHash: e.transactionHash,
        blockNumber: e.blockNumber,
      });
    });
  }

  // Sort descending by block number
  history.sort((a, b) => Number(b.blockNumber - a.blockNumber));

  return (
    <div className="bg-base-100 border border-base-300 rounded-xl overflow-hidden shadow-sm flex flex-col h-full">
      <div className="p-4 border-b border-base-300 flex items-center gap-2 bg-base-200/30">
        <ClockIcon className="w-4 h-4 opacity-50" />
        <h2 className="text-xs uppercase font-black tracking-widest opacity-60">Transaction History</h2>
      </div>

      <div className="p-0 overflow-y-auto max-h-[400px]">
        {isLoading ? (
          <div className="flex justify-center p-8">
            <span className="loading loading-spinner text-primary"></span>
          </div>
        ) : history.length === 0 ? (
          <div className="text-center p-8 opacity-40 italic text-sm">No recent transactions</div>
        ) : (
          <table className="table table-sm w-full">
            <tbody>
              {history.map((tx, idx) => (
                <tr key={`${tx.txHash}-${idx}`} className="hover:bg-base-200 transition-colors">
                  <td className="w-10">
                    {tx.type === "Deposit" || tx.type === "Repay" ? (
                      <ArrowDownRightIcon className="w-4 h-4 text-success" />
                    ) : (
                      <ArrowUpRightIcon className="w-4 h-4 text-warning" />
                    )}
                  </td>
                  <td>
                    <div className="font-bold text-xs uppercase">{tx.type}</div>
                    <div className="text-[10px] opacity-40 font-mono">
                      {tx.txHash.slice(0, 6)}...{tx.txHash.slice(-4)}
                    </div>
                  </td>
                  <td className="text-right font-medium">
                    {tx.asset === "WETH"
                      ? parseFloat(formatEther(tx.amount)).toFixed(4)
                      : parseFloat(formatUnits(tx.amount, 6)).toFixed(2)}{" "}
                    <span className="text-[10px] opacity-50">{tx.asset}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
