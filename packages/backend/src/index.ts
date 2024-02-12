import { ethers } from "ethers";
import { config } from "./config";
import { logger } from "./logger";
import { NonceManager } from "./nonce-manager";
import { TransactionQueue } from "./transaction-queue";
import { LiquidationBot } from "./liquidation-bot";
import { MockPriceFeed } from "./price-feed";
import { CrossChainModule } from "./cross-chain-module";

/**
 * LiquiFi Bot — Main entry point.
 * Orchestrates all backend services: liquidation bot, price feed,
 * AI risk scoring, and cross-chain module.
 */
async function main() {
  logger.info("═".repeat(50));
  logger.info("  🏦 LiquiFi Liquidation Bot Starting...");
  logger.info("═".repeat(50));

  // 1. Initialize provider & wallet
  const provider = new ethers.JsonRpcProvider(config.rpcUrl);
  const wallet = new ethers.Wallet(config.privateKey, provider);
  logger.info(`Wallet: ${wallet.address}`);

  // 2. Initialize nonce manager
  const nonceManager = new NonceManager(provider, wallet);
  await nonceManager.initialize();

  // 3. Initialize transaction queue
  const txQueue = new TransactionQueue(nonceManager);

  // 4. Initialize liquidation bot
  const bot = new LiquidationBot(provider, wallet, nonceManager, txQueue);

  // 5. Initialize price feed (mock for local)
  const priceFeed = new MockPriceFeed();
  priceFeed.on("priceUpdate", ({ asset, price }: any) => {
    logger.debug(`Price update: ${asset} = $${price.toFixed(2)}`);
  });
  priceFeed.on("priceDeviation", ({ asset, deviation }: any) => {
    logger.warn(`⚠️ Price deviation alert: ${asset} moved ${(deviation * 100).toFixed(1)}%`);
  });
  priceFeed.connect();

  // 6. Initialize cross-chain module
  const crossChain = new CrossChainModule(provider, wallet);
  crossChain.startListeners();

  // 7. AI risk scoring — poll periodically
  const aiUpdateLoop = setInterval(async () => {
    try {
      const response = await fetch(`${config.ai.serviceUrl}/api/risk-score`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prices: priceFeed.getAllPrices(),
          timestamp: Date.now(),
        }),
      });
      if (response.ok) {
        const data = await response.json();
        bot.updateThresholdFromRiskScore(data.risk_score);
        logger.info(`AI Risk Score: ${data.risk_score}/100`, { reasoning: data.reasoning });
      }
    } catch {
      logger.debug("AI service unavailable, using default threshold");
    }
  }, config.ai.updateIntervalMs);

  // 8. Stuck TX monitor
  const stuckTxLoop = setInterval(async () => {
    await nonceManager.checkStuckTransactions(config.bot.txTimeoutMs, config.bot.gasPriceBumpPercent);
  }, 15000);

  // 9. Start the bot
  await bot.start();

  // Graceful shutdown
  const shutdown = () => {
    logger.info("Shutting down...");
    bot.stop();
    priceFeed.disconnect();
    clearInterval(aiUpdateLoop);
    clearInterval(stuckTxLoop);
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  logger.info("🤖 All systems operational. Press Ctrl+C to stop.");
}

main().catch((error) => {
  logger.error("Fatal error", { error: error.message, stack: error.stack });
  process.exit(1);
});
