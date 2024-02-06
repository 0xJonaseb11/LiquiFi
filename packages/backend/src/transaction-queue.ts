import { ethers } from "ethers";
import { logger } from "./logger";
import { NonceManager } from "./nonce-manager";

/**
 * Priority-based transaction queue for managing concurrent blockchain operations.
 *
 * Priority levels:
 *   0 = CRITICAL (liquidations)
 *   1 = HIGH (price updates, admin ops)
 *   2 = NORMAL (routine operations)
 *
 * Processes transactions sequentially via the NonceManager to avoid nonce conflicts.
 */
export enum TxPriority {
  CRITICAL = 0,
  HIGH = 1,
  NORMAL = 2,
}

interface QueuedTransaction {
  id: string;
  priority: TxPriority;
  txRequest: ethers.TransactionRequest;
  resolve: (tx: ethers.TransactionResponse) => void;
  reject: (error: Error) => void;
  createdAt: number;
  retryCount: number;
  maxRetries: number;
  description: string;
}

export class TransactionQueue {
  private queue: QueuedTransaction[] = [];
  private processing: boolean = false;
  private nonceManager: NonceManager;
  private maxRetries: number;
  private processedCount: number = 0;
  private failedCount: number = 0;

  constructor(nonceManager: NonceManager, maxRetries: number = 3) {
    this.nonceManager = nonceManager;
    this.maxRetries = maxRetries;
  }

  /**
   * Add a transaction to the queue.
   * Returns a promise that resolves when the TX is mined.
   */
  async submit(
    txRequest: ethers.TransactionRequest,
    priority: TxPriority = TxPriority.NORMAL,
    description: string = "Unknown TX"
  ): Promise<ethers.TransactionResponse> {
    return new Promise((resolve, reject) => {
      const item: QueuedTransaction = {
        id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        priority,
        txRequest,
        resolve,
        reject,
        createdAt: Date.now(),
        retryCount: 0,
        maxRetries: this.maxRetries,
        description,
      };

      // Insert in priority order (lower number = higher priority)
      const insertIndex = this.queue.findIndex(q => q.priority > priority);
      if (insertIndex === -1) {
        this.queue.push(item);
      } else {
        this.queue.splice(insertIndex, 0, item);
      }

      logger.info(`TX queued: ${description}`, {
        id: item.id,
        priority: TxPriority[priority],
        queueLength: this.queue.length,
      });

      // Start processing if not already running
      this._processQueue();
    });
  }

  /**
   * Get current queue stats.
   */
  getStats(): { queued: number; processed: number; failed: number; pending: number } {
    return {
      queued: this.queue.length,
      processed: this.processedCount,
      failed: this.failedCount,
      pending: this.nonceManager.getPendingCount(),
    };
  }

  // ──────────────────────────────────────────────
  //  Internal Processing
  // ──────────────────────────────────────────────

  private async _processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const item = this.queue.shift()!;

      try {
        logger.info(`Processing TX: ${item.description}`, { id: item.id });
        const tx = await this.nonceManager.sendTransaction(item.txRequest);

        // Wait for confirmation
        const receipt = await tx.wait();
        if (receipt && receipt.status === 1) {
          this.processedCount++;
          logger.info(`TX confirmed: ${item.description}`, {
            id: item.id,
            hash: tx.hash,
            gasUsed: receipt.gasUsed.toString(),
          });
          item.resolve(tx);
        } else {
          throw new Error(`TX reverted: ${tx.hash}`);
        }
      } catch (error: any) {
        item.retryCount++;
        if (item.retryCount < item.maxRetries) {
          logger.warn(`TX failed, retrying (${item.retryCount}/${item.maxRetries}): ${item.description}`, {
            error: error.message,
          });
          // Re-insert at front of same priority
          this.queue.unshift(item);
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 1000 * item.retryCount));
        } else {
          this.failedCount++;
          logger.error(`TX failed permanently: ${item.description}`, {
            id: item.id,
            error: error.message,
          });
          item.reject(error);
        }
      }
    }

    this.processing = false;
  }
}
