"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useChainAccount } from "~~/hooks/useChainAccount";

export const AuthGuard = ({ children }: { children: React.ReactNode }) => {
  const { isConnected, isConnecting, isReconnecting } = useChainAccount();
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);
  useEffect(() => {
    if (isMounted && !isConnecting && !isReconnecting && !isConnected) {
      router.push("/");
    }
  }, [isConnected, isConnecting, isReconnecting, router, isMounted]);
  if (!isMounted || isConnecting || isReconnecting || !isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-200/20">
        <span className="loading loading-spinner loading-lg text-primary"></span>
      </div>
    );
  }
  return <>{children}</>;
};
