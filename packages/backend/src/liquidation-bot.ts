import { ethers } from "ethers";
import { logger } from "./logger";
import { config } from "./config";
import { ChainAdapter, PositionData } from "./adapters/chain-adapter";
/**
 * Core liquidation bot engine — Chain Agnostic.
 * 
 * Works with any blockchain that implements the ChainAdapter interface.
 */
export class LiquidationBot {
  private adapter: ChainAdapter;
  private liquidationThreshold: bigint;
  private targetHealthFactor: number;
  private borrowers: Set<string> = new Set();
  private scanTimer: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private totalLiquidations: number = 0;
  constructor(adapter: ChainAdapter) {
    this.adapter = adapter;
    this.liquidationThreshold = ethers.parseEther(config.bot.liquidationThreshold.toString());
    this.targetHealthFactor = config.bot.targetHealthFactor;
  }
  async start(): Promise<void> {
    logger.info(`🤖 Liquidation bot starting on ${(this.adapter.constructor as any).name}...`);
    this.isRunning = true;
    await this.adapter.connect();
    await this._loadBorrowers();
    this._startEventListeners();
    this.scanTimer = setInterval(
      () => this._scanAndLiquidate(),
      config.bot.scanIntervalMs
    );
    await this._scanAndLiquidate();
    logger.info("🤖 Liquidation bot running", {
      borrowerCount: this.borrowers.size,
      threshold: ethers.formatEther(this.liquidationThreshold),
      scanInterval: `${config.bot.scanIntervalMs}ms`,
    });
  }
  stop(): void {
    this.isRunning = false;
    if (this.scanTimer) clearInterval(this.scanTimer);
    this.adapter.removeAllListeners();
    logger.info("🤖 Liquidation bot stopped");
  }
  updateThresholdFromRiskScore(riskScore: number): void {
    const adjustedThreshold = 1.0 + (riskScore / 100) * 0.15;
    this.liquidationThreshold = ethers.parseEther(adjustedThreshold.toFixed(4));
    logger.info("Threshold updated from AI risk score", {
      riskScore,
      newThreshold: adjustedThreshold.toFixed(4),
    });
  }
  async getPositions(): Promise<PositionData[]> {
    const positions: PositionData[] = [];
    for (const borrower of this.borrowers) {
      try {
        const pos = await this.adapter.getPosition(borrower);
        const hf = await this.adapter.getHealthFactor(borrower);
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
  getStats() {
    return {
      isRunning: this.isRunning,
      borrowerCount: this.borrowers.size,
      totalLiquidations: this.totalLiquidations,
      currentThreshold: ethers.formatEther(this.liquidationThreshold),
      chain: this.adapter.constructor.name,
    };
  }
  private async _loadBorrowers(): Promise<void> {
    try {
      const count = await this.adapter.getBorrowerCount();
      for (let i = 0; i < count; i++) {
        const addr = await this.adapter.getBorrowerAt(i);
        this.borrowers.add(addr);
      }
      logger.info(`Loaded ${this.borrowers.size} borrowers from contract`);
    } catch (error: any) {
      logger.error("Failed to load borrowers", { error: error.message });
    }
  }
  private _startEventListeners(): void {
    this.adapter.onBorrow((user, amount) => {
      this.borrowers.add(user);
      logger.info(`📥 New borrow detected`, { user, amount: amount.toString() });
    });
    this.adapter.onRepay(async (user) => {
      try {
        const pos = await this.adapter.getPosition(user);
        if (pos.debtAmount === 0n) {
          this.borrowers.delete(user);
          logger.info(`📤 Borrower fully repaid, removed from tracking`, { user });
        }
      } catch {}
    });
    this.adapter.onLiquidation((liquidator, borrower, debtRepaid, collateralSeized) => {
      logger.info(`⚡ Liquidation event`, {
        liquidator, borrower, debtRepaid: debtRepaid.toString(), collateralSeized: collateralSeized.toString(),
      });
    });
  }
  private async _scanAndLiquidate(): Promise<void> {
    if (!this.isRunning) return;
    try {
      const positions = await this.getPositions();
      const liquidatable = positions.filter(p => p.healthFactor < this.liquidationThreshold);
      if (liquidatable.length > 0) {
        logger.warn(`🚨 Found ${liquidatable.length} liquidatable positions!`);
        for (const pos of liquidatable) {
          await this._executeLiquidation(pos);
        }
      }
    } catch (error: any) {
      logger.error("Scan failed", { error: error.message });
    }
  }
  private async _executeLiquidation(pos: PositionData): Promise<void> {
    try {
      const PRECISION = BigInt("1000000000000000000");
      const targetHF = ethers.parseEther(this.targetHealthFactor.toString());
      const params = await this.adapter.getProtocolParams();
      const collateralPrice = await this.adapter.getOraclePrice(params.oracleAddress, this.adapter.getCollateralToken());
      const debtPrice = await this.adapter.getOraclePrice(params.oracleAddress, this.adapter.getDebtToken());
      const collateralValueUSD = (pos.collateralAmount * collateralPrice) / 10n**8n;
      const adjustedCollateral = (collateralValueUSD * params.ltv) / PRECISION;
      const debtValueUSD = (pos.debtAmount * debtPrice) / 10n**8n;
      const numerator = (targetHF * debtValueUSD / PRECISION) - adjustedCollateral;
      const denominator = targetHF - ((PRECISION + params.liquidationIncentive) * params.ltv / PRECISION);
      let optimalRepayUSD = (numerator * PRECISION) / denominator;
      let optimalRepay18 = (optimalRepayUSD * 10n**8n) / debtPrice;
      const maxRepay18 = (pos.debtAmount * params.closeFactor) / PRECISION;
      if (optimalRepay18 > maxRepay18) optimalRepay18 = maxRepay18;
      const repayAmount = optimalRepay18 / 10n**12n; 
      if (repayAmount === 0n) return;
      const ourBalance = await this.adapter.getBalance(this.adapter.getDebtToken(), this.adapter.getWalletAddress());
      if (ourBalance < repayAmount) {
        logger.warn(`Insufficient balance to liquidate ${pos.borrower}`);
        return;
      }
      logger.info(`⚡ Executing liquidation for ${pos.borrower}`, { repayAmount: repayAmount.toString() });
      const txHash = await this.adapter.executeLiquidation(pos.borrower, repayAmount);
      logger.info(`✅ Liquidation successful: ${txHash}`);
      this.totalLiquidations++;
    } catch (error: any) {
      logger.error(`Liquidation failed for ${pos.borrower}`, { error: error.message });
    }
  }
}
