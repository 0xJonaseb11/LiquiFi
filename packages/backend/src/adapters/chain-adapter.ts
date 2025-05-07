/**
 * ChainAdapter — Abstract interface for chain-specific operations.
 * The liquidation bot uses this interface, making it chain-agnostic.
 */
export interface PositionData {
  borrower: string;
  collateralAmount: bigint;
  debtAmount: bigint;
  healthFactor: bigint;
}
export interface ChainAdapter {
  connect(): Promise<void>;
  getWalletAddress(): string;
  getBorrowerCount(): Promise<number>;
  getBorrowerAt(index: number): Promise<string>;
  getPosition(borrower: string): Promise<{ collateralAmount: bigint; debtAmount: bigint }>;
  getHealthFactor(borrower: string): Promise<bigint>;
  executeLiquidation(borrower: string, repayAmount: bigint): Promise<string>;
  approveToken(token: string, spender: string, amount: bigint): Promise<void>;
  getBalance(token: string, address: string): Promise<bigint>;
  getProtocolParams(): Promise<{
    closeFactor: bigint;
    liquidationIncentive: bigint;
    ltv: bigint;
    oracleAddress: string;
  }>;
  getOraclePrice(oracleAddress: string, asset: string): Promise<bigint>;
  onBorrow(callback: (user: string, amount: bigint) => void): void;
  onRepay(callback: (user: string) => void): void;
  onLiquidation(callback: (liquidator: string, borrower: string, debtRepaid: bigint, collateralSeized: bigint) => void): void;
  removeAllListeners(): void;
  getCollateralToken(): string;
  getDebtToken(): string;
}
