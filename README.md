# 🏦 LiquiFi — DeFi Lending Protocol with AI-Powered Liquidation Engine

A complete DeFi lending and liquidation platform demonstrating all four pillars: **lending protocol**, **liquidation engine**, **cross-chain workflows**, and **AI risk scoring**.

Built on **Scaffold-ETH 2** with UUPS upgradeable smart contracts.

## Architecture

```
┌─────────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Next.js Frontend  │────▶│  Smart Contracts  │◀────│  Liquidation Bot│
│   (Dashboard/Admin) │     │  (Hardhat/EVM)    │     │  (TypeScript)   │
└─────────────────────┘     └──────────────────┘     └────────┬────────┘
                                     ▲                         │
                            ┌────────┴────────┐     ┌─────────▼────────┐
                            │  Cross-Chain     │     │  AI Risk Scorer  │
                            │  Liquidator      │     │  (FastAPI/GPT)   │
                            │  (LayerZero)     │     └──────────────────┘
                            └─────────────────┘
```

## Quick Start

### Prerequisites
- Node.js >= 20
- Yarn 4.x
- Python 3.10+ (for AI service)

### 1. Install Dependencies
```bash
yarn install
```

### 2. Start Local Blockchain
```bash
yarn chain
```

### 3. Deploy Contracts
```bash
yarn deploy
```

### 4. Start Frontend
```bash
yarn start
```
Visit http://localhost:3000

### 5. Start AI Service (optional)
```bash
cd packages/ai-service
pip install -r requirements.txt
cp .env.example .env  # Add your OPENAI_API_KEY
python main.py
```

### 6. Start Liquidation Bot (optional)
```bash
cd packages/backend
cp .env.example .env  # Fill in contract addresses from deploy output
npm install
npm run dev
```

## Smart Contracts

| Contract | Description |
|----------|-------------|
| `LendingPool.sol` | Core lending pool — deposit WETH, borrow USDC, liquidation |
| `InterestRateModel.sol` | Utilization-based jump rate model (2% base, kink at 80%) |
| `PriceOracle.sol` | Mock oracle with admin price-setting (Chainlink-compatible) |
| `CrossChainLiquidator.sol` | LayerZero cross-chain liquidation with state machine |
| `MockWETH.sol` / `MockUSDC.sol` | Test tokens with public mint |

All contracts are **UUPS upgradeable** with custom errors for gas optimization.

## Testing Liquidation Scenarios

1. **Deploy & seed**: Contracts deploy with 5M USDC pool liquidity
2. **Deposit**: Deposit 10 WETH as collateral via dashboard
3. **Borrow**: Borrow 14,000 USDC (near max 75% LTV)
4. **Trigger**: Use Admin Panel to set ETH price to $1,500
5. **Health Factor drops**: HF = (10 × 1500 × 0.75) / 14000 ≈ 0.803 → LIQUIDATABLE
6. **Liquidate**: Bot auto-detects, or use Admin Panel manual liquidation

## Key Design Decisions

### Why Custom Errors over require()?
- Custom errors save ~50-100 gas per revert vs. string error messages
- Better for production; same debugging info with custom error parameters

### Why UUPS over Transparent Proxy?
- Smaller proxy contract (cheaper deployment)
- Upgrade logic lives in implementation (can be removed by deploying non-upgradeable)
- Recommended by OpenZeppelin for new projects

### Why Single-Pair Pool?
- Simpler to explain in interviews; same architecture scales to multi-pair via factory
- Avoids complexity of shared liquidity pools and cross-collateralization

## Project Structure

```
packages/
├── hardhat/            # Smart contracts
│   ├── contracts/      # Solidity source
│   ├── deploy/         # Hardhat-deploy scripts
│   └── test/           # Mocha/Chai tests
├── backend/            # Liquidation bot (TypeScript)
│   └── src/
│       ├── index.ts              # Entry point
│       ├── liquidation-bot.ts    # Core engine
│       ├── nonce-manager.ts      # TX nonce management
│       ├── price-feed.ts         # WebSocket price handler
│       ├── cross-chain-module.ts # Cross-chain workflows
│       └── transaction-queue.ts  # Priority TX queue
├── ai-service/         # AI risk scoring (Python/FastAPI)
│   ├── main.py         # Risk score endpoint
│   └── sentiment.py    # News sentiment fetcher
└── nextjs/             # Frontend dashboard
    └── app/
        ├── page.tsx              # Landing page
        └── dashboard/            # Dashboard with components
```

## License

MIT