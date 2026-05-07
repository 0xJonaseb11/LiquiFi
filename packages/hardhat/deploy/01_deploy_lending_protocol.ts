import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "ethers";

/**
 * Deploy the full LiquiFi lending protocol:
 * 1. Mock tokens (WETH, USDC)
 * 2. PriceOracle (UUPS proxy)
 * 3. InterestRateModel (UUPS proxy)
 * 4. LendingPool (UUPS proxy)
 * 5. CrossChainLiquidator (UUPS proxy)
 * 6. Set initial prices, mint test tokens, seed liquidity
 */
const deployLendingProtocol: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  console.log("\n🚀 Deploying LiquiFi Protocol with deployer:", deployer);

  // ──────────────────────────────────────────────
  //  1. Deploy Mock Tokens
  // ──────────────────────────────────────────────

  console.log("\n📦 Deploying Mock Tokens...");

  const mockWETH = await deploy("MockWETH", {
    from: deployer,
    log: true,
    autoMine: true,
  });

  const mockUSDC = await deploy("MockUSDC", {
    from: deployer,
    log: true,
    autoMine: true,
  });

  console.log("  ✅ MockWETH:", mockWETH.address);
  console.log("  ✅ MockUSDC:", mockUSDC.address);

  // ──────────────────────────────────────────────
  //  2. Deploy PriceOracle (UUPS Proxy)
  // ──────────────────────────────────────────────

  console.log("\n📦 Deploying PriceOracle...");

  const priceOracle = await deploy("PriceOracle", {
    from: deployer,
    log: true,
    autoMine: true,
    proxy: {
      proxyContract: "ERC1967Proxy",
      proxyArgs: ["{implementation}", "{data}"],
      execute: {
        init: {
          methodName: "initialize",
          args: [deployer],
        },
      },
    },
  });

  console.log("  ✅ PriceOracle (proxy):", priceOracle.address);

  // ──────────────────────────────────────────────
  //  3. Deploy InterestRateModel (UUPS Proxy)
  // ──────────────────────────────────────────────

  console.log("\n📦 Deploying InterestRateModel...");

  // Rate parameters:
  //   Base rate:    2% APR  = 0.02e18
  //   Slope1:      10% APR = 0.10e18 (below optimal)
  //   Slope2:      100% APR = 1.00e18 (above optimal — steep)
  //   Optimal:     80%     = 0.80e18
  //   Reserve:     10%     = 0.10e18
  const baseRate = ethers.parseEther("0.02");
  const slope1 = ethers.parseEther("0.10");
  const slope2 = ethers.parseEther("1.00");
  const optimalUtilization = ethers.parseEther("0.80");
  const reserveFactor = ethers.parseEther("0.10");

  const interestRateModel = await deploy("InterestRateModel", {
    from: deployer,
    log: true,
    autoMine: true,
    proxy: {
      proxyContract: "ERC1967Proxy",
      proxyArgs: ["{implementation}", "{data}"],
      execute: {
        init: {
          methodName: "initialize",
          args: [baseRate, slope1, slope2, optimalUtilization, reserveFactor, deployer],
        },
      },
    },
  });

  console.log("  ✅ InterestRateModel (proxy):", interestRateModel.address);

  // ──────────────────────────────────────────────
  //  4. Deploy LendingPool (UUPS Proxy)
  // ──────────────────────────────────────────────

  console.log("\n📦 Deploying LendingPool...");

  // LTV:                  75% = 0.75e18
  // Close Factor:         50% = 0.50e18 (max debt repayable per liquidation)
  // Liquidation Incentive: 5% = 0.05e18 (bonus for liquidators)
  const ltvRatio = ethers.parseEther("0.75");
  const closeFactor = ethers.parseEther("0.50");
  const liquidationIncentive = ethers.parseEther("0.05");

  const lendingPool = await deploy("LendingPool", {
    from: deployer,
    log: true,
    autoMine: true,
    proxy: {
      proxyContract: "ERC1967Proxy",
      proxyArgs: ["{implementation}", "{data}"],
      execute: {
        init: {
          methodName: "initialize",
          args: [
            mockWETH.address,
            mockUSDC.address,
            priceOracle.address,
            interestRateModel.address,
            ltvRatio,
            closeFactor,
            liquidationIncentive,
            deployer,
          ],
        },
      },
    },
  });

  console.log("  ✅ LendingPool (proxy):", lendingPool.address);

  // ──────────────────────────────────────────────
  //  5. Deploy CrossChainLiquidator (UUPS Proxy)
  // ──────────────────────────────────────────────

  console.log("\n📦 Deploying CrossChainLiquidator...");

  const crossChainLiquidator = await deploy("CrossChainLiquidator", {
    from: deployer,
    log: true,
    autoMine: true,
    proxy: {
      proxyContract: "ERC1967Proxy",
      proxyArgs: ["{implementation}", "{data}"],
      execute: {
        init: {
          methodName: "initialize",
          args: [
            lendingPool.address,
            mockUSDC.address,
            ethers.ZeroAddress, // Mock mode: no real LZ endpoint
            deployer,
          ],
        },
      },
    },
  });

  console.log("  ✅ CrossChainLiquidator (proxy):", crossChainLiquidator.address);

  // ──────────────────────────────────────────────
  //  6. Post-Deploy Setup
  // ──────────────────────────────────────────────

  console.log("\n⚙️  Running post-deploy setup...");

  const signer = await hre.ethers.getSigner(deployer);

  // Set initial oracle prices
  const oracleContract = await hre.ethers.getContractAt("PriceOracle", priceOracle.address, signer);
  const ethPrice = 2000_00000000n; // $2,000.00 (8 decimals)
  const usdcPrice = 1_00000000n; // $1.00 (8 decimals)

  const gasEstimate1 = await oracleContract.setPrice.estimateGas(mockWETH.address, ethPrice);
  await oracleContract.setPrice(mockWETH.address, ethPrice, { gasLimit: (gasEstimate1 * 120n) / 100n });

  const gasEstimate2 = await oracleContract.setPrice.estimateGas(mockUSDC.address, usdcPrice);
  await oracleContract.setPrice(mockUSDC.address, usdcPrice, { gasLimit: (gasEstimate2 * 120n) / 100n });

  console.log("  ✅ Oracle prices set: ETH=$2,000 | USDC=$1.00");

  // Mint test tokens to deployer
  const wethContract = await hre.ethers.getContractAt("MockWETH", mockWETH.address, signer);
  const usdcContract = await hre.ethers.getContractAt("MockUSDC", mockUSDC.address, signer);

  const mintWETH = ethers.parseEther("1000"); // 1000 WETH
  const mintUSDC = 10_000_000_000000n; // 10M USDC (6 decimals)

  await wethContract.mint(deployer, mintWETH, { gasLimit: 100_000 });
  await usdcContract.mint(deployer, mintUSDC, { gasLimit: 100_000 });
  console.log("  ✅ Minted 1,000 WETH + 10M USDC to deployer");

  // Seed USDC liquidity into the pool
  const seedAmount = 5_000_000_000000n; // 5M USDC
  await usdcContract.approve(lendingPool.address, seedAmount, { gasLimit: 100_000 });

  const poolContract = await hre.ethers.getContractAt("LendingPool", lendingPool.address, signer);
  await poolContract.seedLiquidity(seedAmount, { gasLimit: 200_000 });
  console.log("  ✅ Seeded 5M USDC liquidity into pool");

  // ──────────────────────────────────────────────
  //  Summary
  // ──────────────────────────────────────────────

  console.log("\n" + "═".repeat(60));
  console.log("  🏦 LiquiFi Protocol Deployed Successfully!");
  console.log("═".repeat(60));
  console.log(`  MockWETH:              ${mockWETH.address}`);
  console.log(`  MockUSDC:              ${mockUSDC.address}`);
  console.log(`  PriceOracle:           ${priceOracle.address}`);
  console.log(`  InterestRateModel:     ${interestRateModel.address}`);
  console.log(`  LendingPool:           ${lendingPool.address}`);
  console.log(`  CrossChainLiquidator:  ${crossChainLiquidator.address}`);
  console.log("═".repeat(60) + "\n");
};

export default deployLendingProtocol;
deployLendingProtocol.tags = ["LendingProtocol"];
