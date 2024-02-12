import { ethers, Contract } from "ethers";
import { logger } from "./logger";
import { config } from "./config";

const CROSS_CHAIN_LIQUIDATOR_ABI = [
  "event CrossChainLiquidationRequested(uint256 indexed requestId, address borrower, uint256 repayAmount, uint16 sourceChain)",
  "event CrossChainStateChanged(uint256 indexed requestId, uint8 from, uint8 to)",
  "event CrossChainLiquidationComplete(uint256 indexed requestId, address borrower, uint256 repayAmount)",
  "event CrossChainLiquidationFailed(uint256 indexed requestId, string reason)",
  "function confirmFundsReceived(uint256 requestId) external",
  "function getRequest(uint256 requestId) view returns (tuple(uint256 id, address borrower, uint256 repayAmount, uint16 sourceChainId, uint256 createdAt, uint256 deadline, uint8 retryCount, uint8 state))",
];

/**
 * CrossChainModule
 * 
 * Handles the backend orchestration for cross-chain liquidations.
 * In this prototype, it simulates the bridging process and confirms
 * funds arrival on the target chain.
 */
export class CrossChainModule {
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private liquidator: Contract;

  constructor(provider: ethers.JsonRpcProvider, wallet: ethers.Wallet) {
    this.provider = provider;
    this.wallet = wallet;
    this.liquidator = new ethers.Contract(
      config.contracts.crossChainLiquidator,
      CROSS_CHAIN_LIQUIDATOR_ABI,
      wallet
    );
  }

  /**
   * Start listening for cross-chain liquidation events.
   */
  startListeners(): void {
    logger.info("🌐 Cross-chain module listening for requests...");

    this.liquidator.on(
      "CrossChainLiquidationRequested",
      async (requestId: bigint, borrower: string, repayAmount: bigint, sourceChain: number) => {
        logger.info(`🌐 Cross-chain liquidation requested`, {
          requestId: requestId.toString(),
          borrower,
          repayAmount: ethers.formatUnits(repayAmount, 6),
          sourceChain,
        });

        // Simulate bridging process
        this._handleBridging(requestId);
      }
    );

    this.liquidator.on("CrossChainLiquidationComplete", (requestId: bigint, borrower: string) => {
      logger.info(`✅ Cross-chain liquidation complete`, {
        requestId: requestId.toString(),
        borrower,
      });
    });

    this.liquidator.on("CrossChainLiquidationFailed", (requestId: bigint, reason: string) => {
      logger.error(`❌ Cross-chain liquidation failed`, {
        requestId: requestId.toString(),
        reason,
      });
    });
  }

  /**
   * Simulate the bridging of funds from the source chain.
   * In a real system, this would involve monitoring the source chain
   * and initiating a LayerZero/Axelar message.
   */
  private async _handleBridging(requestId: bigint): Promise<void> {
    try {
      logger.info(`🌐 Starting mock bridge for request ${requestId}...`);

      // Simulate bridge delay
      await new Promise((resolve) => setTimeout(resolve, 5000));

      logger.info(`🌐 Bridge simulation complete for request ${requestId}. Confirming funds...`);

      // Call confirmFundsReceived on-chain
      // Note: In production, this would be triggered by a LayerZero message receiver,
      // but here the bot manually confirms arrival to simulate the workflow.
      const tx = await this.liquidator.confirmFundsReceived(requestId);
      await tx.wait();

      logger.info(`🌐 Funds confirmed for request ${requestId}`);
    } catch (error: any) {
      logger.error(`🌐 Mock bridge failed for request ${requestId}`, {
        error: error.message,
      });
    }
  }
}
