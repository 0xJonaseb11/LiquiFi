import { ethers } from "ethers";
import { config } from "./config";
import { logger } from "./logger";
import { NonceManager } from "./nonce-manager";
import { TransactionQueue } from "./transaction-queue";
import { LiquidationBot } from "./liquidation-bot";
import { MockPriceFeed } from "./price-feed";
import { CrossChainModule } from "./cross-chain-module";
import { EvmAdapter } from "./adapters/evm-adapter";
import { PolkadotAdapter } from "./adapters/polkadot-adapter";
/**
 * LiquiFi Bot — Main entry point.
 * Orchestrates all backend services: liquidation bot, price feed,
 * AI risk scoring, and cross-chain module.
 */
async function main() {
  logger.info("═".repeat(50));
  logger.info("  🏦 LiquiFi Liquidation Bot Starting...");
  logger.info("═".repeat(50));
  const chainType = process.env.CHAIN_TYPE || "evm";
  logger.info(`Target Chain: ${chainType.toUpperCase()}`);
  const adapter = chainType === "polkadot" ? new PolkadotAdapter() : new EvmAdapter();
  const bot = new LiquidationBot(adapter);
  const priceFeed = new MockPriceFeed();
  priceFeed.on("priceUpdate", ({ asset, price }: any) => {
    logger.debug(`Price update: ${asset} = $${price.toFixed(2)}`);
  });
  priceFeed.on("priceDeviation", ({ asset, deviation }: any) => {
    logger.warn(`⚠️ Price deviation alert: ${asset} moved ${(deviation * 100).toFixed(1)}%`);
  });
  priceFeed.connect();
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
        const data = await response.json() as any;
        bot.updateThresholdFromRiskScore(data.risk_score);
        const currentOnChainThreshold = bot.getStats().currentThreshold;
        const recommendedThreshold = data.recommended_threshold; 
        const diff = Math.abs(parseFloat(currentOnChainThreshold) - recommendedThreshold);
        if (diff > 0.01) {
          logger.info(`🚨 AI recommending on-chain threshold update: ${currentOnChainThreshold} → ${recommendedThreshold}`);
        }
        logger.info(`AI Risk Score: ${data.risk_score}/100`, { reasoning: data.reasoning });
      }
    } catch {
      logger.debug("AI service unavailable, using default threshold");
    }
  }, config.ai.updateIntervalMs);
  await bot.start();
  const shutdown = () => {
    logger.info("Shutting down...");
    bot.stop();
    priceFeed.disconnect();
    clearInterval(aiUpdateLoop);
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
