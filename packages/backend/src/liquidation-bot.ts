import { ethers, Contract } from "ethers";
import { logger } from "./logger";
import { config } from "./config";
import { NonceManager } from "./nonce-manager";
import { TransactionQueue, TxPriority } from "./transaction-queue";

// Minimal ABIs for the contracts we interact with
const LENDING_POOL_ABI = [
  "function getBorrowerCount() view returns (uint256)",
  "function getBorrowerAt(uint256) view returns (address)",
  "function getPosition(address) view returns (tuple(uint256 collateralAmount, uint256 debtAmount, uint256 lastUpdateTimestamp))",
  "function getHealthFactor(address) view returns (uint256)",
  "function liquidate(address borrower, uint256 repayAmount)",
  "function closeFactor() view returns (uint256)",
  "function liquidationIncentive() view returns (uint256)",
  "function ltv() view returns (uint256)",
  "function oracle() view returns (address)",
  "function getTotalDeposits() view returns (uint256)",
  "function getTotalBorrows() view returns (uint256)",
  "function getUtilizationRate() view returns (uint256)",
  "function getBorrowRate() view returns (uint256)",
  "event Deposit(address indexed user, uint256 amount)",
  "event Withdraw(address indexed user, uint256 amount)",
  "event Borrow(address indexed user, uint256 amount)",
  "event Repay(address indexed user, uint256 amount)",
  "event Liquidation(address indexed liquidator, address indexed borrower, uint256 debtRepaid, uint256 collateralSeized)",
];

const ORACLE_ABI = [
  "function getPrice(address) view returns (uint256)",
];

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function approve(address, uint256) returns (bool)",
  "function allowance(address, address) view returns (uint256)",
];

export interface PositionData {
  borrower: string;
  collateralAmount: bigint;
  debtAmount: bigint;
  healthFactor: bigint;
}

/**
 * Core liquidation bot engine.
 *
 * Responsibilities:
 * 1. Monitor all borrower positions via periodic scanning + event listeners
 * 2. Detect positions with Health Factor < threshold
 * 3. Calculate optimal close factor to restore health
 * 4. Execute liquidation via TransactionQueue
 * 5. Dynamically adjust threshold based on AI risk score
 */
export class LiquidationBot {
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private lendingPool: Contract;
  private usdc: Contract;
  private txQueue: TransactionQueue;
  private nonceManager: NonceManager;

  // Dynamic threshold (adjusted by AI risk score)
  private liquidationThreshold: bigint;
  private targetHealthFactor: number;

  // Tracking
  private borrowers: Set<string> = new Set();
  private scanTimer: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private totalLiquidations: number = 0;

  constructor(
    provider: ethers.JsonRpcProvider,
    wallet: ethers.Wallet,
    nonceManager: NonceManager,
    txQueue: TransactionQueue
  ) {
    this.provider = provider;
    this.wallet = wallet;
    this.nonceManager = nonceManager;
    this.txQueue = txQueue;

    // Initialize contracts
    this.lendingPool = new ethers.Contract(
      config.contracts.lendingPool,
      LENDING_POOL_ABI,
      wallet
    );
    this.usdc = new ethers.Contract(config.contracts.usdc, ERC20_ABI, wallet);

    // Parse threshold from config (1.0 = 1e18)
    this.liquidationThreshold = ethers.parseEther(config.bot.liquidationThreshold.toString());
    this.targetHealthFactor = config.bot.targetHealthFactor;
  }

  /**
   * Start the liquidation bot.
   */
  async start(): Promise<void> {
    logger.info("🤖 Liquidation bot starting...");
    this.isRunning = true;

    // Load existing borrowers from contract
    await this._loadBorrowers();

    // Start event listeners
    this._startEventListeners();

    // Start periodic scanning
    this.scanTimer = setInterval(
      () => this._scanAndLiquidate(),
      config.bot.scanIntervalMs
    );

    // Initial scan
    await this._scanAndLiquidate();

    logger.info("🤖 Liquidation bot running", {
      borrowerCount: this.borrowers.size,
      threshold: ethers.formatEther(this.liquidationThreshold),
      scanInterval: `${config.bot.scanIntervalMs}ms`,
    });
  }

  /**
   * Stop the bot gracefully.
   */
  stop(): void {
    this.isRunning = false;
    if (this.scanTimer) {
      clearInterval(this.scanTimer);
    }
    this.lendingPool.removeAllListeners();
    logger.info("🤖 Liquidation bot stopped");
  }

  /**
   * Update the liquidation threshold based on AI risk score.
   * Higher risk → lower threshold (liquidate sooner).
   *
   * @param riskScore 0-100 from AI service
   */
  updateThresholdFromRiskScore(riskScore: number): void {
    // Risk 0 → threshold 1.0 (standard)
    // Risk 50 → threshold 1.05
    // Risk 100 → threshold 1.15 (aggressive — liquidate earlier)
    const adjustedThreshold = 1.0 + (riskScore / 100) * 0.15;
    this.liquidationThreshold = ethers.parseEther(adjustedThreshold.toFixed(4));

    logger.info("Threshold updated from AI risk score", {
      riskScore,
      newThreshold: adjustedThreshold.toFixed(4),
    });
  }

  /**
   * Get all current positions with health factors.
   */
  async getPositions(): Promise<PositionData[]> {
    const positions: PositionData[] = [];

    for (const borrower of this.borrowers) {
      try {
        const pos = await this.lendingPool.getPosition(borrower);
        const hf = await this.lendingPool.getHealthFactor(borrower);

        if (pos.debtAmount > 0n) {
          positions.push({
            borrower,
            collateralAmount: pos.collateralAmount,
            debtAmount: pos.debtAmount,
            healthFactor: hf,
          });
        }
      } catch (error: any) {
        logger.warn(`Failed to get position for ${borrower}`, { error: error.message });
      }
    }

    return positions;
  }

  /**
   * Get bot stats for dashboard.
   */
  getStats() {
    return {
      isRunning: this.isRunning,
      borrowerCount: this.borrowers.size,
      totalLiquidations: this.totalLiquidations,
      currentThreshold: ethers.formatEther(this.liquidationThreshold),
      txQueueStats: this.txQueue.getStats(),
    };
  }

  // ──────────────────────────────────────────────
  //  Internal: Scanning & Detection
  // ──────────────────────────────────────────────

  private async _loadBorrowers(): Promise<void> {
    try {
      const count = await this.lendingPool.getBorrowerCount();
      for (let i = 0; i < count; i++) {
        const addr = await this.lendingPool.getBorrowerAt(i);
        this.borrowers.add(addr);
      }
      logger.info(`Loaded ${this.borrowers.size} borrowers from contract`);
    } catch (error: any) {
      logger.error("Failed to load borrowers", { error: error.message });
    }
  }

  private _startEventListeners(): void {
    // Listen for new borrows
    this.lendingPool.on("Borrow", (user: string, amount: bigint) => {
      this.borrowers.add(user);
      logger.info(`📥 New borrow detected`, { user, amount: ethers.formatUnits(amount, 6) });
    });

    // Listen for full repays (remove from tracking if no debt)
    this.lendingPool.on("Repay", async (user: string) => {
      try {
        const pos = await this.lendingPool.getPosition(user);
        if (pos.debtAmount === 0n) {
          this.borrowers.delete(user);
          logger.info(`📤 Borrower fully repaid, removed from tracking`, { user });
        }
      } catch {
        // Ignore errors
      }
    });

    // Log liquidation events
    this.lendingPool.on(
      "Liquidation",
      (liquidator: string, borrower: string, debtRepaid: bigint, collateralSeized: bigint) => {
        logger.info(`⚡ Liquidation event`, {
          liquidator,
          borrower,
          debtRepaid: ethers.formatUnits(debtRepaid, 6),
          collateralSeized: ethers.formatEther(collateralSeized),
        });
      }
    );
  }

  private async _scanAndLiquidate(): Promise<void> {
    if (!this.isRunning) return;

    try {
      const positions = await this.getPositions();
      const liquidatable = positions.filter(
        p => p.healthFactor < this.liquidationThreshold
      );

      if (liquidatable.length > 0) {
        logger.warn(`🚨 Found ${liquidatable.length} liquidatable positions!`);

        for (const pos of liquidatable) {
          await this._executeLiquidation(pos);
        }
      } else {
        logger.debug(`Scan complete: ${positions.length} positions healthy`);
      }
    } catch (error: any) {
      logger.error("Scan failed", { error: error.message });
    }
  }

  /**
   * Execute a liquidation for a specific position.
   *
   * Calculates optimal repay amount using close factor,
   * then submits via the transaction queue as CRITICAL priority.
   */
  private async _executeLiquidation(pos: PositionData): Promise<void> {
    try {
      const PRECISION = ethers.parseEther("1");
      const targetHF = ethers.parseEther(this.targetHealthFactor.toString());

      // 1. Fetch protocol parameters
      const [closeFactor, incentive, ltvRatio, oracleAddr] = await Promise.all([
        this.lendingPool.closeFactor(),
        this.lendingPool.liquidationIncentive(),
        this.lendingPool.ltv(),
        this.lendingPool.oracle(),
      ]);

      const oracle = new ethers.Contract(oracleAddr, ORACLE_ABI, this.provider);
      const [collateralPrice, debtPrice] = await Promise.all([
        oracle.getPrice(config.contracts.weth),
        oracle.getPrice(config.contracts.usdc),
      ]);

      // 2. Calculate current values in USD (18 decimals)
      // adjustedCollateral = (collateral * price * LTV) / 1e18
      const collateralValueUSD = (pos.collateralAmount * collateralPrice) / 10n**8n;
      const adjustedCollateral = (collateralValueUSD * ltvRatio) / PRECISION;
      
      const debtValueUSD = (pos.debtAmount * debtPrice) / 10n**8n;

      /**
       * 3. Calculate Optimal Repay Amount
       * 
       * deltaD = (TargetHF * DebtUSD - AdjustedCollateral) / (TargetHF - (1 + incentive) * LTV)
       * 
       * Note: We want to repay JUST enough to reach TargetHF.
       */
      const numerator = (targetHF * debtValueUSD / PRECISION) - adjustedCollateral;
      const denominator = targetHF - ((PRECISION + incentive) * ltvRatio / PRECISION);
      
      let optimalRepayUSD = (numerator * PRECISION) / denominator;
      
      // Convert USD back to normalized debt amount (18 dec)
      let optimalRepay18 = (optimalRepayUSD * 10n**8n) / debtPrice;

      // 4. Enforce close factor limit
      const maxRepay18 = (pos.debtAmount * closeFactor) / PRECISION;
      if (optimalRepay18 > maxRepay18) {
        optimalRepay18 = maxRepay18;
      }

      // Convert to USDC (6 dec)
      const repayAmount = optimalRepay18 / 10n**12n;

      if (repayAmount === 0n) {
        logger.warn(`Optimal repay amount is 0 for ${pos.borrower}`);
        return;
      }

      // 5. Check our USDC balance
      const ourBalance = await this.usdc.balanceOf(this.wallet.address);
      if (ourBalance < repayAmount) {
        logger.warn(`Insufficient USDC to liquidate ${pos.borrower}. Have: ${ethers.formatUnits(ourBalance, 6)}, Need: ${ethers.formatUnits(repayAmount, 6)}`);
        
        // Potential cross-chain opportunity
        if (config.contracts.crossChainLiquidator) {
          logger.info(`🌐 Requesting cross-chain liquidation for ${pos.borrower}...`);
          await this._requestCrossChain(pos.borrower, repayAmount);
        }
        return;
      }

      // 6. Ensure allowance
      const currentAllowance = await this.usdc.allowance(
        this.wallet.address,
        config.contracts.lendingPool
      );
      if (currentAllowance < repayAmount) {
        logger.info(`Approving USDC for liquidation...`);
        const approveTx = this.usdc.interface.encodeFunctionData("approve", [
          config.contracts.lendingPool,
          ethers.MaxUint256,
        ]);
        await this.txQueue.submit(
          { to: config.contracts.usdc, data: approveTx },
          TxPriority.CRITICAL,
          `Approve USDC for liquidation`
        );
      }

      // 7. Submit liquidation TX
      const liquidateTx = this.lendingPool.interface.encodeFunctionData("liquidate", [
        pos.borrower,
        repayAmount,
      ]);

      logger.info(`⚡ Submitting optimal liquidation`, {
        borrower: pos.borrower,
        repayAmount: ethers.formatUnits(repayAmount, 6),
        healthFactor: ethers.formatEther(pos.healthFactor),
        targetHF: this.targetHealthFactor,
      });

      await this.txQueue.submit(
        { to: config.contracts.lendingPool, data: liquidateTx },
        TxPriority.CRITICAL,
        `Liquidate ${pos.borrower.slice(0, 8)}...`
      );

      this.totalLiquidations++;
    } catch (error: any) {
      logger.error(`Liquidation failed for ${pos.borrower}`, { error: error.message });
    }
  }

  /**
   * Request funds from source chain via CrossChainLiquidator.
   */
  private async _requestCrossChain(borrower: string, amount: bigint): Promise<void> {
    try {
      const liquidator = new ethers.Contract(
        config.contracts.crossChainLiquidator,
        ["function requestCrossChainLiquidation(address, uint256, uint16)"],
        this.wallet
      );

      const tx = await liquidator.requestCrossChainLiquidation(
        borrower,
        amount,
        config.crossChain.sourceChainId
      );
      await tx.wait();
      
      logger.info(`🌐 Cross-chain request submitted for ${borrower}`);
    } catch (error: any) {
      logger.error(`🌐 Cross-chain request failed`, { error: error.message });
    }
  }
}
