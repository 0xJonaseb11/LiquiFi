/**
 * PolkadotAdapter — Implements ChainAdapter for Substrate/ink! contracts.
 * Uses @polkadot/api and @polkadot/api-contract for chain interaction.
 */

import { ChainAdapter } from "./chain-adapter";
import { config } from "../config";
import { logger } from "../logger";

// These are dynamically imported to avoid bundling issues when running EVM-only
let ApiPromise: any;
let WsProvider: any;
let ContractPromise: any;
let Keyring: any;

export class PolkadotAdapter implements ChainAdapter {
  private api: any = null;
  private keyring: any = null;
  private signer: any = null;
  private lendingPool: any = null;
  private oracleContract: any = null;

  // Contract metadata (loaded from JSON files)
  private metadata: Record<string, any> = {};

  async connect(): Promise<void> {
    // Dynamic imports
    const polkadotApi = await import("@polkadot/api");
    const polkadotContract = await import("@polkadot/api-contract");
    const polkadotKeyring = await import("@polkadot/keyring");

    ApiPromise = polkadotApi.ApiPromise;
    WsProvider = polkadotApi.WsProvider;
    ContractPromise = polkadotContract.ContractPromise;
    Keyring = polkadotKeyring.Keyring;

    const polkadotConfig = (config as any).polkadot;
    const provider = new WsProvider(polkadotConfig.rpcUrl);
    this.api = await ApiPromise.create({ provider });

    // Initialize keyring and signer
    this.keyring = new Keyring({ type: "sr25519" });
    this.signer = this.keyring.addFromUri(polkadotConfig.seed || "//Alice");

    logger.info(`[Polkadot] Connected to ${polkadotConfig.rpcUrl}`);
    logger.info(`[Polkadot] Wallet: ${this.signer.address}`);

    // Load contract instances
    // In production, metadata JSON files would be loaded from disk
    // For now, we create stubs that will be populated after contract deployment
    const contracts = polkadotConfig.contracts;
    if (contracts.lendingPool) {
      try {
        const fs = await import("fs");
        const path = await import("path");
        const metadataPath = path.resolve(__dirname, "../../ink-metadata/lending_pool.json");
        if (fs.existsSync(metadataPath)) {
          const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf-8"));
          this.lendingPool = new ContractPromise(this.api, metadata, contracts.lendingPool);
          logger.info(`[Polkadot] LendingPool contract loaded at ${contracts.lendingPool}`);
        }
      } catch (err: any) {
        logger.warn(`[Polkadot] Could not load LendingPool metadata: ${err.message}`);
      }
    }
  }

  getWalletAddress(): string {
    return this.signer?.address || "";
  }

  async getBorrowerCount(): Promise<number> {
    if (!this.lendingPool) return 0;
    const { output } = await this.lendingPool.query.getBorrowerCount(this.signer.address, { gasLimit: -1 });
    return output ? Number(output.toHuman()) : 0;
  }

  async getBorrowerAt(index: number): Promise<string> {
    if (!this.lendingPool) return "";
    const { output } = await this.lendingPool.query.getBorrowerAt(this.signer.address, { gasLimit: -1 }, index);
    return output ? output.toHuman() : "";
  }

  async getPosition(borrower: string) {
    if (!this.lendingPool) return { collateralAmount: 0n, debtAmount: 0n };
    const { output } = await this.lendingPool.query.getPosition(this.signer.address, { gasLimit: -1 }, borrower);
    if (!output) return { collateralAmount: 0n, debtAmount: 0n };
    const pos = output.toJSON() as any;
    return {
      collateralAmount: BigInt(pos.collateralAmount || 0),
      debtAmount: BigInt(pos.debtAmount || 0),
    };
  }

  async getHealthFactor(borrower: string): Promise<bigint> {
    if (!this.lendingPool) return BigInt("0xFFFFFFFFFFFFFFFF");
    const { output } = await this.lendingPool.query.getHealthFactor(this.signer.address, { gasLimit: -1 }, borrower);
    return output ? BigInt(output.toJSON()) : BigInt("0xFFFFFFFFFFFFFFFF");
  }

  async executeLiquidation(borrower: string, repayAmount: bigint): Promise<string> {
    if (!this.lendingPool) throw new Error("LendingPool contract not loaded");

    // Dry run for gas estimation
    const { gasRequired } = await this.lendingPool.query.liquidate(
      this.signer.address, { gasLimit: -1 }, borrower, repayAmount.toString(),
    );

    return new Promise((resolve, reject) => {
      this.lendingPool.tx
        .liquidate({ gasLimit: gasRequired }, borrower, repayAmount.toString())
        .signAndSend(this.signer, (result: any) => {
          if (result.status.isFinalized) {
            resolve(result.status.asFinalized.toHex());
          }
          if (result.isError) {
            reject(new Error("Transaction failed"));
          }
        });
    });
  }

  async approveToken(_token: string, _spender: string, _amount: bigint): Promise<void> {
    // PSP22 approve — would need the token contract instance
    logger.warn("[Polkadot] Token approval not yet implemented");
  }

  async getBalance(_token: string, _address: string): Promise<bigint> {
    // PSP22 balance_of — would need the token contract instance
    return 0n;
  }

  async getProtocolParams() {
    if (!this.lendingPool) {
      return { closeFactor: 0n, liquidationIncentive: 0n, ltv: 0n, oracleAddress: "" };
    }

    const queries = ["closeFactor", "liquidationIncentive", "ltv", "oracle"];
    const results = await Promise.all(
      queries.map(q => this.lendingPool.query[q](this.signer.address, { gasLimit: -1 })),
    );

    return {
      closeFactor: BigInt((results[0].output as any)?.toJSON() || 0),
      liquidationIncentive: BigInt((results[1].output as any)?.toJSON() || 0),
      ltv: BigInt((results[2].output as any)?.toJSON() || 0),
      oracleAddress: (results[3].output as any)?.toJSON() || "",
    };
  }

  async getOraclePrice(_oracleAddress: string, _asset: string): Promise<bigint> {
    // Would need oracle contract instance
    return 0n;
  }

  onBorrow(_callback: (user: string, amount: bigint) => void): void {
    // Substrate event subscriptions via api.query.system.events
    logger.debug("[Polkadot] Event subscriptions not yet implemented");
  }

  onRepay(_callback: (user: string) => void): void {}
  onLiquidation(_callback: (l: string, b: string, d: bigint, c: bigint) => void): void {}
  removeAllListeners(): void {}

  getCollateralToken(): string { return (config as any).polkadot?.contracts?.wdot || ""; }
  getDebtToken(): string { return (config as any).polkadot?.contracts?.usdc || ""; }
}
