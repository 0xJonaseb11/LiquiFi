"use client";

import { useCallback, useEffect, useState } from "react";
import { useChainContext } from "~~/contexts/ChainContext";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { usePolkadotContracts } from "~~/providers/PolkadotContractProvider";
import { usePolkadotContext } from "~~/providers/PolkadotProvider";

/**
 * Unified contract read hook.
 * In EVM mode, delegates to useScaffoldReadContract.
 * In Polkadot mode, calls ink! contract queries.
 */
export const useChainReadContract = (params: { contractName: string; functionName: string; args?: any[] }) => {
  const { isEvm } = useChainContext();
  const evmResult = useScaffoldReadContract({
    contractName: params.contractName as any,
    functionName: params.functionName as any,
    args: params.args as any,
  } as any);
  const [polkadotData, setPolkadotData] = useState<any>(null);
  const [polkadotLoading, setPolkadotLoading] = useState(false);
  const [polkadotError, setPolkadotError] = useState<string | null>(null);
  let contracts: Record<string, any> = {};
  let isReady = false;
  let selectedAccount: any = null;
  try {
    const ctx = usePolkadotContracts();
    contracts = ctx.contracts;
    isReady = ctx.isReady;
    const polkadotCtx = usePolkadotContext();
    selectedAccount = polkadotCtx.selectedAccount;
  } catch {}
  useEffect(() => {
    if (isEvm || !isReady) return;
    const contract = contracts[params.contractName];
    if (!contract) return;
    const queryContract = async () => {
      setPolkadotLoading(true);
      try {
        const callerAddress = selectedAccount?.address || "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY";
        const { result, output } = await contract.query[params.functionName](
          callerAddress,
          { gasLimit: -1 },
          ...(params.args || []),
        );
        if (result.isOk && output) {
          setPolkadotData(output.toHuman());
        }
      } catch (err: any) {
        setPolkadotError(err?.message || "Query failed");
      } finally {
        setPolkadotLoading(false);
      }
    };
    queryContract();
  }, [
    isEvm,
    isReady,
    params.contractName,
    params.functionName,
    JSON.stringify(params.args, (_k, v) => (typeof v === "bigint" ? v.toString() : v)),
  ]);
  if (isEvm) {
    return evmResult as any;
  }
  return {
    data: polkadotData,
    isLoading: polkadotLoading,
    error: polkadotError,
    refetch: () => {},
  } as any;
};
/**
 * Unified contract write hook.
 * In EVM mode, delegates to useScaffoldWriteContract.
 * In Polkadot mode, submits ink! contract transactions.
 */
export const useChainWriteContract = (params: { contractName: string }) => {
  const { isEvm } = useChainContext();
  const [isPending, setIsPending] = useState(false);
  const evmResult = useScaffoldWriteContract({
    contractName: params.contractName as any,
  } as any);
  let contracts: Record<string, any> = {};
  let isReady = false;
  let selectedAccount: any = null;
  try {
    const ctx = usePolkadotContracts();
    contracts = ctx.contracts;
    isReady = ctx.isReady;
    const polkadotCtx = usePolkadotContext();
    selectedAccount = polkadotCtx.selectedAccount;
  } catch {}
  const writeAsync = useCallback(
    async (writeParams: { functionName: string; args?: any[] }) => {
      if (!isReady || !selectedAccount) {
        throw new Error("Polkadot not connected");
      }
      const contract = contracts[params.contractName];
      if (!contract) {
        throw new Error(`Contract ${params.contractName} not found`);
      }
      setIsPending(true);
      try {
        const { web3FromSource } = await import("@polkadot/extension-dapp");
        const injector = await web3FromSource(selectedAccount.source);
        const { gasRequired } = await contract.query[writeParams.functionName](
          selectedAccount.address,
          { gasLimit: -1 },
          ...(writeParams.args || []),
        );
        await contract.tx[writeParams.functionName]({ gasLimit: gasRequired }, ...(writeParams.args || [])).signAndSend(
          selectedAccount.address,
          { signer: injector.signer },
        );
      } finally {
        setIsPending(false);
      }
    },
    [isReady, selectedAccount, contracts, params.contractName],
  );
  if (isEvm) {
    return evmResult as any;
  }
  return {
    writeContractAsync: writeAsync,
    isPending,
  } as any;
};
