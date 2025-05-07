import { EventEmitter } from "events";
import WebSocket from "ws";
import { logger } from "./logger";
/**
 * WebSocket price feed handler with automatic reconnection.
 *
 * Features:
 * - Exponential backoff reconnection (1s → 2s → 4s → ... → 30s max)
 * - Heartbeat monitoring — reconnect if no data for 60s
 * - Price deviation alerting (> 5% move in single update)
 * - TWAP calculation over configurable window
 * - Event-driven: emits 'priceUpdate' consumed by liquidation bot
 */
export class PriceFeed extends EventEmitter {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts: number = 0;
  private maxReconnectDelay: number = 30000;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private heartbeatTimeout: number = 60000;
  private isConnected: boolean = false;
  private shouldReconnect: boolean = true;
  private prices: Map<string, number> = new Map();
  private priceHistory: Map<string, { price: number; timestamp: number }[]> = new Map();
  private twapWindow: number; 
  private deviationThreshold: number = 0.05; 
  constructor(url: string, twapWindowMs: number = 5 * 60 * 1000) {
    super();
    this.url = url;
    this.twapWindow = twapWindowMs;
  }
  /**
   * Connect to the WebSocket price feed.
   */
  connect(): void {
    this.shouldReconnect = true;
    this._connect();
  }
  /**
   * Gracefully disconnect.
   */
  disconnect(): void {
    this.shouldReconnect = false;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    if (this.heartbeatTimer) {
      clearTimeout(this.heartbeatTimer);
    }
    this.isConnected = false;
    logger.info("Price feed disconnected");
  }
  /**
   * Get the latest price for an asset.
   */
  getPrice(asset: string): number | undefined {
    return this.prices.get(asset);
  }
  /**
   * Calculate TWAP over the configured window.
   */
  getTWAP(asset: string): number | undefined {
    const history = this.priceHistory.get(asset);
    if (!history || history.length === 0) return undefined;
    const cutoff = Date.now() - this.twapWindow;
    const relevantPrices = history.filter(p => p.timestamp >= cutoff);
    if (relevantPrices.length === 0) return history[history.length - 1].price;
    const sum = relevantPrices.reduce((acc, p) => acc + p.price, 0);
    return sum / relevantPrices.length;
  }
  /**
   * Manually update a price (for mock/testing mode).
   */
  updatePrice(asset: string, price: number): void {
    this._processPrice(asset, price);
  }
  /**
   * Get all current prices.
   */
  getAllPrices(): Record<string, number> {
    const result: Record<string, number> = {};
    for (const [asset, price] of this.prices) {
      result[asset] = price;
    }
    return result;
  }
  private _connect(): void {
    try {
      logger.info(`Connecting to price feed: ${this.url}`);
      this.ws = new WebSocket(this.url);
      this.ws.on("open", () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        logger.info("Price feed connected");
        this._startHeartbeat();
        this.emit("connected");
      });
      this.ws.on("message", (data: WebSocket.Data) => {
        this._resetHeartbeat();
        try {
          const parsed = JSON.parse(data.toString());
          if (parsed.asset && parsed.price) {
            this._processPrice(parsed.asset, parsed.price);
          } else if (parsed.answer) {
            this._processPrice(parsed.feed || "ETH", Number(parsed.answer) / 1e8);
          }
        } catch (error) {
          logger.warn("Failed to parse price data", { data: data.toString() });
        }
      });
      this.ws.on("close", (code: number) => {
        this.isConnected = false;
        logger.warn(`Price feed disconnected`, { code });
        if (this.shouldReconnect) {
          this._reconnect();
        }
      });
      this.ws.on("error", (error: Error) => {
        logger.error("Price feed error", { error: error.message });
      });
    } catch (error: any) {
      logger.error("Failed to create WebSocket", { error: error.message });
      if (this.shouldReconnect) {
        this._reconnect();
      }
    }
  }
  private _reconnect(): void {
    const delay = Math.min(
      1000 * Math.pow(2, this.reconnectAttempts),
      this.maxReconnectDelay
    );
    this.reconnectAttempts++;
    logger.info(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    setTimeout(() => this._connect(), delay);
  }
  private _startHeartbeat(): void {
    this._resetHeartbeat();
  }
  private _resetHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearTimeout(this.heartbeatTimer);
    }
    this.heartbeatTimer = setTimeout(() => {
      logger.warn("No price data received for 60s, reconnecting...");
      if (this.ws) {
        this.ws.terminate();
      }
    }, this.heartbeatTimeout);
  }
  private _processPrice(asset: string, price: number): void {
    const oldPrice = this.prices.get(asset);
    if (oldPrice && oldPrice > 0) {
      const deviation = Math.abs(price - oldPrice) / oldPrice;
      if (deviation > this.deviationThreshold) {
        logger.warn(`⚠️ Large price deviation for ${asset}`, {
          oldPrice,
          newPrice: price,
          deviation: `${(deviation * 100).toFixed(2)}%`,
        });
        this.emit("priceDeviation", { asset, oldPrice, newPrice: price, deviation });
      }
    }
    this.prices.set(asset, price);
    if (!this.priceHistory.has(asset)) {
      this.priceHistory.set(asset, []);
    }
    const history = this.priceHistory.get(asset)!;
    history.push({ price, timestamp: Date.now() });
    const cutoff = Date.now() - this.twapWindow * 2; 
    const firstValid = history.findIndex(p => p.timestamp >= cutoff);
    if (firstValid > 0) {
      history.splice(0, firstValid);
    }
    this.emit("priceUpdate", { asset, price, twap: this.getTWAP(asset) });
  }
}
/**
 * Mock price feed for local testing (no WebSocket needed).
 * Simulates price updates at a configurable interval.
 */
export class MockPriceFeed extends PriceFeed {
  private intervalTimer: NodeJS.Timeout | null = null;
  constructor(twapWindowMs: number = 5 * 60 * 1000) {
    super("ws://mock", twapWindowMs);
  }
  connect(): void {
    logger.info("Mock price feed started");
    this.updatePrice("ETH", 2000);
    this.updatePrice("USDC", 1);
    this.intervalTimer = setInterval(() => {
      const ethPrice = this.getPrice("ETH") || 2000;
      const change = ethPrice * (Math.random() * 0.01 - 0.005);
      this.updatePrice("ETH", ethPrice + change);
    }, 5000);
    this.emit("connected");
  }
  disconnect(): void {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
    }
    logger.info("Mock price feed stopped");
  }
}
