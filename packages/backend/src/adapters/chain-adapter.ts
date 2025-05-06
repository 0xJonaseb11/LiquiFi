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
  /** Connect to the blockchain node. */
  connect(): Promise<void>;

  /** Get the bot's wallet address. */
  getWalletAddress(): string;

  /** Get total number of borrowers tracked by the lending pool. */
  getBorrowerCount(): Promise<number>;

  /** Get borrower address at index. */
  getBorrowerAt(index: number): Promise<string>;

  /** Get full position data for a borrower. */
  getPosition(borrower: string): Promise<{ collateralAmount: bigint; debtAmount: bigint }>;

  /** Get health factor for a borrower. */
  getHealthFactor(borrower: string): Promise<bigint>;

  /** Execute a liquidation. Returns tx hash. */
  executeLiquidation(borrower: string, repayAmount: bigint): Promise<string>;

  /** Approve token spending. */
  approveToken(token: string, spender: string, amount: bigint): Promise<void>;

  /** Get token balance. */
  getBalance(token: string, address: string): Promise<bigint>;

  /** Get protocol parameters. */
  getProtocolParams(): Promise<{
    closeFactor: bigint;
    liquidationIncentive: bigint;
    ltv: bigint;
    oracleAddress: string;
  }>;

  /** Get asset price from oracle (8 decimals). */
  getOraclePrice(oracleAddress: string, asset: string): Promise<bigint>;

  /** Subscribe to contract events. */
  onBorrow(callback: (user: string, amount: bigint) => void): void;
  onRepay(callback: (user: string) => void): void;
  onLiquidation(callback: (liquidator: string, borrower: string, debtRepaid: bigint, collateralSeized: bigint) => void): void;

  /** Cleanup listeners. */
  removeAllListeners(): void;

  /** Get collateral and debt token addresses/identifiers. */
  getCollateralToken(): string;
  getDebtToken(): string;
}
