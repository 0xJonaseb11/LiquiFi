/**
 * EvmAdapter — Implements ChainAdapter for EVM chains using ethers.js.
 * Extracts the existing EVM interaction logic from the monolithic liquidation-bot.ts.
 */
import { ethers, Contract } from "ethers";
import { ChainAdapter } from "./chain-adapter";
import { config } from "../config";
import { logger } from "../logger";
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
  "event Borrow(address indexed user, uint256 amount)",
  "event Repay(address indexed user, uint256 amount)",
  "event Liquidation(address indexed liquidator, address indexed borrower, uint256 debtRepaid, uint256 collateralSeized)",
];
const ORACLE_ABI = ["function getPrice(address) view returns (uint256)"];
const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function approve(address, uint256) returns (bool)",
  "function allowance(address, address) view returns (uint256)",
];
export class EvmAdapter implements ChainAdapter {
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private lendingPool!: Contract;
  private debtTokenContract!: Contract;
  constructor() {
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
    this.wallet = new ethers.Wallet(config.privateKey, this.provider);
  }
  async connect(): Promise<void> {
    this.lendingPool = new ethers.Contract(config.contracts.lendingPool, LENDING_POOL_ABI, this.wallet);
    this.debtTokenContract = new ethers.Contract(config.contracts.usdc, ERC20_ABI, this.wallet);
    logger.info(`[EVM] Connected to ${config.rpcUrl}`);
  }
  getWalletAddress(): string { return this.wallet.address; }
  async getBorrowerCount(): Promise<number> {
    const count = await this.lendingPool.getBorrowerCount();
    return Number(count);
  }
  async getBorrowerAt(index: number): Promise<string> {
    return this.lendingPool.getBorrowerAt(index);
  }
  async getPosition(borrower: string) {
    const pos = await this.lendingPool.getPosition(borrower);
    return { collateralAmount: pos.collateralAmount, debtAmount: pos.debtAmount };
  }
  async getHealthFactor(borrower: string): Promise<bigint> {
    return this.lendingPool.getHealthFactor(borrower);
  }
  async executeLiquidation(borrower: string, repayAmount: bigint): Promise<string> {
    const tx = await this.lendingPool.liquidate(borrower, repayAmount);
    const receipt = await tx.wait();
    return receipt.hash;
  }
  async approveToken(token: string, spender: string, amount: bigint): Promise<void> {
    const contract = new ethers.Contract(token, ERC20_ABI, this.wallet);
    const tx = await contract.approve(spender, amount);
    await tx.wait();
  }
  async getBalance(token: string, address: string): Promise<bigint> {
    const contract = new ethers.Contract(token, ERC20_ABI, this.provider);
    return contract.balanceOf(address);
  }
  async getProtocolParams() {
    const [closeFactor, liquidationIncentive, ltv, oracleAddress] = await Promise.all([
      this.lendingPool.closeFactor(),
      this.lendingPool.liquidationIncentive(),
      this.lendingPool.ltv(),
      this.lendingPool.oracle(),
    ]);
    return { closeFactor, liquidationIncentive, ltv, oracleAddress };
  }
  async getOraclePrice(oracleAddress: string, asset: string): Promise<bigint> {
    const oracle = new ethers.Contract(oracleAddress, ORACLE_ABI, this.provider);
    return oracle.getPrice(asset);
  }
  onBorrow(callback: (user: string, amount: bigint) => void): void {
    this.lendingPool.on("Borrow", callback);
  }
  onRepay(callback: (user: string) => void): void {
    this.lendingPool.on("Repay", callback);
  }
  onLiquidation(callback: (liquidator: string, borrower: string, debtRepaid: bigint, collateralSeized: bigint) => void): void {
    this.lendingPool.on("Liquidation", callback);
  }
  removeAllListeners(): void {
    this.lendingPool.removeAllListeners();
  }
  getCollateralToken(): string { return config.contracts.weth; }
  getDebtToken(): string { return config.contracts.usdc; }
}
