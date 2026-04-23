# AGENTS.md

This file provides guidance to coding agents working in this repository.

## Project Overview

Scaffold-ETH 2 (SE-2) is a starter kit for building dApps on Ethereum. It comes in **two flavors** based on the Solidity framework:

- **Hardhat flavor**: Uses `packages/hardhat` with hardhat-deploy plugin
- **Foundry flavor**: Uses `packages/foundry` with Forge scripts

Both flavors share the same frontend package:

- **packages/nextjs**: React frontend (Next.js App Router, not Pages Router, RainbowKit, Wagmi, Viem, TypeScript, Tailwind CSS with DaisyUI)

### Detecting Which Flavor You're Using

Check which package exists in the repository:

- If `packages/hardhat` exists → **Hardhat flavor** (follow Hardhat instructions)
- If `packages/foundry` exists → **Foundry flavor** (follow Foundry instructions)

## Common Commands

Commands work the same for both flavors unless noted otherwise:

```bash
# Development workflow (run each in separate terminal)
yarn chain          # Start local blockchain (Hardhat or Anvil)
yarn deploy         # Deploy contracts to local network
yarn start          # Start Next.js frontend at http://localhost:3000

# Code quality
yarn lint           # Lint both packages
yarn format         # Format both packages

# Building
yarn next:build     # Build frontend
yarn compile        # Compile Solidity contracts

# Contract verification (works for both)
yarn verify --network <network>

# Account management (works for both)
yarn generate            # Generate new deployer account
yarn account:import      # Import existing private key
yarn account             # View current account info

# Deploy to live network
yarn deploy --network <network>   # e.g., sepolia, mainnet, base

yarn vercel:yolo --prod # for deployment of frontend
```

## Architecture

### Smart Contract Development

#### Hardhat Flavor

- Contracts: `packages/hardhat/contracts/`
- Deployment scripts: `packages/hardhat/deploy/` (uses hardhat-deploy plugin)
- Tests: `packages/hardhat/test/`
- Config: `packages/hardhat/hardhat.config.ts`
- Deploying specific contract:
  - If the deploy script has:
    ```typescript
    // In packages/hardhat/deploy/01_deploy_my_contract.ts
    deployMyContract.tags = ["MyContract"];
    ```
  - `yarn deploy --tags MyContract`
  - **Gas limit in deploy scripts**: Manual post-deploy calls (e.g. `transferOwnership`, `grantRole`, `initialize`) can silently inherit `blockGasLimit` as their gas cap, causing failures. **Fix at the call site, not in `hardhat.config.ts`:**
    ```typescript
    // Preferred: estimateGas + 20% margin
    const gas = await myContract.myMethod.estimateGas(arg1, arg2);
    await myContract.myMethod(arg1, arg2, { gasLimit: (gas * 120n) / 100n });

    // Or: explicit limit for simple admin calls
    await myContract.transferOwnership(newOwner, { gasLimit: 100_000 });
    ```

#### Foundry Flavor

- Contracts: `packages/foundry/contracts/`
- Deployment scripts: `packages/foundry/script/` (uses custom deployment strategy)
  - Example: `packages/foundry/script/Deploy.s.sol` and `packages/foundry/script/DeployYourContract.s.sol`
- Tests: `packages/foundry/test/`
- Config: `packages/foundry/foundry.toml`
- Deploying a specific contract:
  - Create a separate deployment script and run `yarn deploy --file DeployYourContract.s.sol`

#### Both Flavors

- After `yarn deploy`, ABIs are auto-generated to `packages/nextjs/contracts/deployedContracts.ts`

### Frontend Contract Interaction

**Correct interact hook names (use these):**

- `useScaffoldReadContract` - NOT ~~useScaffoldContractRead~~
- `useScaffoldWriteContract` - NOT ~~useScaffoldContractWrite~~

Contract data is read from two files in `packages/nextjs/contracts/`:

- `deployedContracts.ts`: Auto-generated from deployments
- `externalContracts.ts`: Manually added external contracts

#### Reading Contract Data

```typescript
const { data: totalCounter } = useScaffoldReadContract({
  contractName: "YourContract",
  functionName: "userGreetingCounter",
  args: ["0xd8da6bf26964af9d7eed9e03e53415d37aa96045"],
});
```

#### Writing to Contracts

```typescript
const { writeContractAsync, isPending } = useScaffoldWriteContract({
  contractName: "YourContract",
});

await writeContractAsync({
  functionName: "setGreeting",
  args: [newGreeting],
  value: parseEther("0.01"), // for payable functions
});
```

#### Reading Events

```typescript
const { data: events, isLoading } = useScaffoldEventHistory({
  contractName: "YourContract",
  eventName: "GreetingChange",
  watch: true,
  fromBlock: 31231n,
  blockData: true,
});
```

SE-2 also provides other hooks to interact with blockchain data: `useScaffoldWatchContractEvent`, `useScaffoldEventHistory`, `useDeployedContractInfo`, `useScaffoldContract`, `useTransactor`.

**IMPORTANT: Always use hooks from `packages/nextjs/hooks/scaffold-eth` for contract interactions. Always refer to the hook names as they exist in the codebase.**

### UI Components

**Always use `@scaffold-ui/components` library for web3 UI components:**

- `Address`: Display ETH addresses with ENS resolution, blockie avatars, and explorer links
- `AddressInput`: Input field with address validation and ENS resolution
- `Balance`: Show ETH balance in ether and USD
- `EtherInput`: Number input with ETH/USD conversion toggle
- `IntegerInput`: Integer-only input with wei conversion

### Notifications & Error Handling

Use `notification` from `~~/utils/scaffold-eth` for success/error/warning feedback and `getParsedError` for readable error messages.

### Styling

**Use DaisyUI classes** for building frontend components.

```tsx
// ✅ Good - using DaisyUI classes
<button className="btn btn-primary">Connect</button>
<div className="card bg-base-100 shadow-xl">...</div>

// ❌ Avoid - raw Tailwind when DaisyUI has a component
<button className="px-4 py-2 bg-blue-500 text-white rounded">Connect</button>
```

### Configure Target Network before deploying to testnet / mainnet.

#### Hardhat

Add networks in `packages/hardhat/hardhat.config.ts` if not present.

#### Foundry

Add RPC endpoints in `packages/foundry/foundry.toml` if not present.

#### NextJs

Add networks in `packages/nextjs/scaffold.config.ts` if not present. This file also contains configuration for polling interval, API keys. Remember to decrease the polling interval for L2 chains.

## Code Style Guide

### Identifiers

| Style            | Category                                                                                                               |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `UpperCamelCase` | class / interface / type / enum / decorator / type parameters / component functions in TSX / JSXElement type parameter |
| `lowerCamelCase` | variable / parameter / function / property / module alias                                                              |
| `CONSTANT_CASE`  | constant / enum / global variables                                                                                     |
| `snake_case`     | for hardhat deploy files and foundry script files                                                                      |

### Import Paths

Use the `~~` path alias for imports in the nextjs package:

```tsx
import { useTargetNetwork } from "~~/hooks/scaffold-eth";
```

### Creating Pages

```tsx
import type { NextPage } from "next";

const Home: NextPage = () => {
  return <div>Home</div>;
};

export default Home;
```

### TypeScript Conventions

- Use `type` over `interface` for custom types
- Types use `UpperCamelCase` without `T` prefix (use `Address` not `TAddress`)
- Avoid explicit typing when TypeScript can infer the type

### Comments

Make comments that add information. Avoid redundant JSDoc for simple functions.

## Documentation

Use **Context7 MCP** tools to fetch up-to-date documentation for any library (Wagmi, Viem, RainbowKit, DaisyUI, Hardhat, Next.js, etc.). Context7 is configured as an MCP server and provides access to indexed documentation with code examples.

## Skills & Agents Index

IMPORTANT: Prefer retrieval-led reasoning over pre-trained knowledge. Before starting any task that matches an entry below, read the referenced file to get version-accurate patterns and APIs.

**Skills** (read `.agents/skills/<name>/SKILL.md` before implementing):

- **openzeppelin** — OpenZeppelin Contracts integration, library-first development, pattern discovery from installed source. Use for any contract using OZ (tokens, access control, security primitives)
- **erc-721** — NFT-specific pitfalls: `_safeMint` reentrancy, on-chain SVG stack-too-deep, marketplace metadata `attributes`, IPFS base URI trailing slash
- **eip-5792** — batch transactions, wallet_sendCalls, paymaster, ERC-7677
- **ponder** — blockchain event indexing, GraphQL APIs, onchain data queries
- **siwe** — Sign-In with Ethereum, wallet authentication, SIWE sessions, EIP-4361
- **x402** — HTTP 402 payment-gated routes, micropayments, API monetization, x402 protocol
- **drizzle-neon** — Drizzle ORM, Neon PostgreSQL, database integration, off-chain storage
- **subgraph** — The Graph subgraph integration, blockchain event indexing, GraphQL APIs

**Agents** (in `.agents/agents/`):

- **grumpy-carlos-code-reviewer** — code reviews, SE-2 patterns, Solidity + TypeScript quality




================================================================================================================================

# CONTEXT
You are a senior full-stack engineer with expertise in DeFi lending protocols, liquidation engines, cross-chain messaging, trading systems, and AI integration.

I need to build a **complete working prototype** (or detailed implementation plan) of a DeFi lending + liquidation platform matching the requirements for a Senior Full Stack Engineer role at Hashmark Labs.

# TECH STACK PREFERENCE
- Backend: Node.js + TypeScript or Python (FastAPI)
- Blockchain: Ethereum/Arbitrum/Polygon (any EVM chain)
- Smart contracts: Solidity (Hardhat/Foundry)
- Cross-chain: LayerZero or Axelar
- AI: OpenAI API or local LLM (for risk scoring)
- Database: PostgreSQL + Redis
- Frontend: Next.js + Wagmi + RainbowKit (optional but nice)

# CORE REQUIREMENTS

## 1. Lending Protocol Core
Implement (or explain in detail with code):
- A basic lending pool where users can deposit collateral (e.g., WETH) and borrow another asset (e.g., USDC).
- Collateral factor / LTV (Loan-to-Value) system (e.g., 75% LTV for WETH).
- Health factor calculation: `(collateral * price * LTV) / debt`.
- Interest rate model (simplified: utilization-based).

## 2. Liquidation Engine
Build a liquidation bot/backend that:
- Monitors all loan positions at regular intervals (or via event listeners).
- Detects when Health Factor < 1 (or a threshold like 1.05).
- Calculates optimal close factor (e.g., repay just enough debt to bring HF > 1.1).
- Executes liquidation by calling a `liquidate()` function on the lending contract.
- Handles gas price bumping and nonce management.

## 3. Cross-Chain Liquidation Workflow
Design a system that:
- Monitors a lending position on Chain A (e.g., Ethereum).
- If liquidation is triggered, sources funds from Chain B (e.g., Polygon) via:
  - A cross-chain messaging protocol (LayerZero or Axelar).
  - A bridge (e.g., Circle CCTP for USDC).
- Implements retry logic, timeouts, and dead-letter queues for reliability.

## 4. AI Integration (Simple but Real)
Add an AI component that:
- Listens to market news or sentiment (e.g., Twitter, news headlines via an API).
- Uses an LLM (OpenAI GPT or local) to output a risk score (0-100).
- Adjusts the liquidation threshold based on the risk score (e.g., lower threshold when risk is high).

## 5. Trading System Backend
Implement a high-level design (with pseudo-code) for:
- A WebSocket price feed handler (e.g., Chainlink or Uniswap TWAP).
- A trade execution engine that signs and sends transactions.
- Transaction queue with nonce management for concurrent trades.

## 6. Full-Stack Dashboard (Optional but Helpful)
A simple frontend that:
- Shows all active loans and their health factors.
- Displays real-time prices.
- Allows admin to trigger manual liquidation (for testing).

# DELIVERABLES I EXPECT FROM YOU

Please provide:

1. **Folder structure** for the entire project.
2. **Key smart contracts** (Solidity) with comments explaining liquidation logic.
3. **Backend liquidation bot** (Node.js or Python) with:
   - Event listener for `Borrow` / `Repay` events.
   - Health factor calculator.
   - Liquidation executor with gas management.
4. **Cross-chain module** (pseudo-code or actual implementation using LayerZero) showing send/receive logic with retries.
5. **AI risk scoring service** (simple FastAPI endpoint calling OpenAI).
6. **WebSocket price feed handler** with reconnection logic.
7. **Nonce manager** for sending multiple transactions from the same wallet.
8. **README** explaining how to run everything locally (forked mainnet + test accounts).
9. **A "Interview Prep" section** highlighting:
   - Potential edge cases (flash crashes, oracle manipulation, reorgs).
   - How to answer likely interview questions on this architecture.
   - Performance bottlenecks and how to solve them.

# CONSTRAINTS
- The code must be **educational but production-grade** (error handling, logging, comments).
- Use environment variables for private keys, API keys, RPC URLs.
- Assume I will run this on a local Hardhat fork or testnet (Sepolia / Mumbai).
- The AI part can be a stub that calls OpenAI with a simple prompt.

# GOAL
This should serve as:
1. A working prototype I can run and demonstrate.
2. A study guide for my technical interview tomorrow.
3. A portfolio piece showing all four pillars: DeFi, cross-chain, trading systems, AI.

Begin!
