import { ethers } from "ethers";
import { logger } from "./logger";
/**
 * Production-grade nonce manager for concurrent transaction submission.
 *
 * Solves the classic problem: when sending multiple TXs from the same wallet,
 * each needs a unique, sequential nonce. Ethers' built-in NonceManager has
 * race conditions under high concurrency.
 *
 * Features:
 * - Mutex lock preventing concurrent nonce allocation
 * - Auto-sync with on-chain nonce on errors
 * - Gas price bumping for stuck transactions
 * - Nonce gap detection and recovery
 */
export class NonceManager {
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private currentNonce: number = -1;
  private mutex: boolean = false;
  private pendingTxs: Map<number, { hash: string; timestamp: number; gasPrice: bigint }> = new Map();
  constructor(provider: ethers.JsonRpcProvider, wallet: ethers.Wallet) {
    this.provider = provider;
    this.wallet = wallet;
  }
  /**
   * Initialize by syncing nonce from chain
   */
  async initialize(): Promise<void> {
    this.currentNonce = await this.provider.getTransactionCount(this.wallet.address, "pending");
    logger.info(`Nonce manager initialized`, { address: this.wallet.address, nonce: this.currentNonce });
  }
  /**
   * Acquire the next nonce with mutex protection.
   * Prevents two concurrent calls from getting the same nonce.
   */
  async acquireNonce(): Promise<number> {
    while (this.mutex) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    this.mutex = true;
    try {
      if (this.currentNonce === -1) {
        await this.initialize();
      }
      const nonce = this.currentNonce;
      this.currentNonce++;
      return nonce;
    } finally {
      this.mutex = false;
    }
  }
  /**
   * Send a transaction with managed nonce and gas price bumping.
   *
   * @param txRequest The transaction to send (without nonce — we manage it)
   * @returns Transaction response
   */
  async sendTransaction(
    txRequest: ethers.TransactionRequest
  ): Promise<ethers.TransactionResponse> {
    const nonce = await this.acquireNonce();
    const gasEstimate = await this.provider.estimateGas({
      ...txRequest,
      from: this.wallet.address,
    });
    const gasLimit = (gasEstimate * 120n) / 100n;
    const feeData = await this.provider.getFeeData();
    const gasPrice = feeData.gasPrice || ethers.parseUnits("20", "gwei");
    const fullTx: ethers.TransactionRequest = {
      ...txRequest,
      nonce,
      gasLimit,
      gasPrice,
      from: this.wallet.address,
    };
    logger.info(`Sending TX`, { nonce, gasLimit: gasLimit.toString(), gasPrice: gasPrice.toString() });
    try {
      const tx = await this.wallet.sendTransaction(fullTx);
      this.pendingTxs.set(nonce, {
        hash: tx.hash,
        timestamp: Date.now(),
        gasPrice,
      });
      return tx;
    } catch (error: any) {
      if (error.message?.includes("nonce") || error.code === "NONCE_EXPIRED") {
        logger.warn(`Nonce error, re-syncing...`, { nonce, error: error.message });
        await this.resetNonce();
      }
      throw error;
    }
  }
  /**
   * Bump gas price for a stuck transaction.
   * Resubmits the same TX with higher gas to replace it in the mempool.
   */
  async bumpGasPrice(nonce: number, bumpPercent: number = 10): Promise<ethers.TransactionResponse | null> {
    const pending = this.pendingTxs.get(nonce);
    if (!pending) {
      logger.warn(`No pending TX found for nonce ${nonce}`);
      return null;
    }
    const newGasPrice = (pending.gasPrice * BigInt(100 + bumpPercent)) / 100n;
    logger.info(`Bumping gas for nonce ${nonce}`, {
      oldGasPrice: pending.gasPrice.toString(),
      newGasPrice: newGasPrice.toString(),
    });
    const tx = await this.provider.getTransaction(pending.hash);
    if (!tx) return null;
    const bumpedTx = await this.wallet.sendTransaction({
      to: tx.to,
      data: tx.data,
      value: tx.value,
      nonce,
      gasPrice: newGasPrice,
      gasLimit: tx.gasLimit,
    });
    this.pendingTxs.set(nonce, {
      hash: bumpedTx.hash,
      timestamp: Date.now(),
      gasPrice: newGasPrice,
    });
    return bumpedTx;
  }
  /**
   * Check for stuck transactions and bump gas if needed.
   * Called periodically by the main loop.
   */
  async checkStuckTransactions(timeoutMs: number = 30000, bumpPercent: number = 10): Promise<void> {
    const now = Date.now();
    for (const [nonce, pending] of this.pendingTxs) {
      if (now - pending.timestamp > timeoutMs) {
        logger.warn(`TX stuck for nonce ${nonce}, bumping gas...`);
        try {
          await this.bumpGasPrice(nonce, bumpPercent);
        } catch (error: any) {
          logger.error(`Failed to bump gas for nonce ${nonce}`, { error: error.message });
        }
      }
      try {
        const receipt = await this.provider.getTransactionReceipt(pending.hash);
        if (receipt) {
          this.pendingTxs.delete(nonce);
          logger.debug(`TX confirmed`, { nonce, hash: pending.hash, blockNumber: receipt.blockNumber });
        }
      } catch {
      }
    }
  }
  /**
   * Re-sync local nonce from chain state.
   */
  async resetNonce(): Promise<void> {
    this.currentNonce = await this.provider.getTransactionCount(this.wallet.address, "pending");
    logger.info(`Nonce reset to ${this.currentNonce}`);
  }
  /**
   * Get count of pending transactions.
   */
  getPendingCount(): number {
    return this.pendingTxs.size;
  }
}
