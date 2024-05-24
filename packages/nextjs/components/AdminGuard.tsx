"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";

export const AdminGuard = ({ children }: { children: React.ReactNode }) => {
  const { address, isConnected, isConnecting, isReconnecting } = useAccount();
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);

  const { data: owner, isLoading: isOwnerLoading } = useScaffoldReadContract({
    contractName: "LendingPool",
    functionName: "owner",
  });

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted) return;

    if (!isConnecting && !isReconnecting && !isConnected) {
      router.push("/");
      return;
    }

    if (!isOwnerLoading && owner && address !== owner) {
      router.push("/dashboard");
    }
  }, [address, owner, isOwnerLoading, isConnected, isConnecting, isReconnecting, router, isMounted]);

  if (!isMounted || isConnecting || isReconnecting || !isConnected || isOwnerLoading || !owner) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-200/20">
        <span className="loading loading-spinner loading-lg text-primary"></span>
      </div>
    );
  }

  if (address !== owner) {
    return null;
  }

  return <>{children}</>;
};
