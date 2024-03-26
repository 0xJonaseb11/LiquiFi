import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer } from "ethers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("LiquiFi Lending Protocol", function () {
  let deployer: Signer;
  let borrower: Signer;
  let liquidator: Signer;
  let deployerAddr: string;
  let borrowerAddr: string;
  let liquidatorAddr: string;

  let weth: Contract;
  let usdc: Contract;
  let oracle: Contract;
  let interestModel: Contract;
  let lendingPool: Contract;

  // Constants
  const ETH_PRICE = 2000_00000000n;  // $2,000 (8 dec)
  const USDC_PRICE = 1_00000000n;    // $1.00 (8 dec)
  const PRECISION = ethers.parseEther("1");

  beforeEach(async function () {
    [deployer, borrower, liquidator] = await ethers.getSigners();
    deployerAddr = await deployer.getAddress();
    borrowerAddr = await borrower.getAddress();
    liquidatorAddr = await liquidator.getAddress();

    // Deploy mock tokens
    const MockWETH = await ethers.getContractFactory("MockWETH");
    weth = await MockWETH.deploy();

    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    usdc = await MockUSDC.deploy();

    // Deploy PriceOracle via proxy
    const PriceOracle = await ethers.getContractFactory("PriceOracle");
    const oracleImpl = await PriceOracle.deploy();
    const oracleInitData = oracleImpl.interface.encodeFunctionData("initialize", [deployerAddr]);
    const Proxy = await ethers.getContractFactory("@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol:ERC1967Proxy");
    const oracleProxy = await Proxy.deploy(await oracleImpl.getAddress(), oracleInitData);
    oracle = PriceOracle.attach(await oracleProxy.getAddress());

    // Deploy InterestRateModel via proxy
    const InterestRateModel = await ethers.getContractFactory("InterestRateModel");
    const irmImpl = await InterestRateModel.deploy();
    const irmInitData = irmImpl.interface.encodeFunctionData("initialize", [
      ethers.parseEther("0.02"),  // 2% base
      ethers.parseEther("0.10"),  // 10% slope1
      ethers.parseEther("1.00"),  // 100% slope2
      ethers.parseEther("0.80"),  // 80% optimal
      ethers.parseEther("0.10"),  // 10% reserve
      deployerAddr,
    ]);
    const irmProxy = await Proxy.deploy(await irmImpl.getAddress(), irmInitData);
    interestModel = InterestRateModel.attach(await irmProxy.getAddress());

    // Deploy LendingPool via proxy
    const LendingPool = await ethers.getContractFactory("LendingPool");
    const poolImpl = await LendingPool.deploy();
    const poolInitData = poolImpl.interface.encodeFunctionData("initialize", [
      await weth.getAddress(),
      await usdc.getAddress(),
      await oracle.getAddress(),
      await interestModel.getAddress(),
      ethers.parseEther("0.75"),  // 75% LTV
      ethers.parseEther("0.50"),  // 50% close factor
      ethers.parseEther("0.05"),  // 5% liquidation incentive
      deployerAddr,
    ]);
    const poolProxy = await Proxy.deploy(await poolImpl.getAddress(), poolInitData);
    lendingPool = LendingPool.attach(await poolProxy.getAddress());

    // Set oracle prices
    await oracle.setPrice(await weth.getAddress(), ETH_PRICE);
    await oracle.setPrice(await usdc.getAddress(), USDC_PRICE);

    // Mint tokens
    await weth.mint(borrowerAddr, ethers.parseEther("100"));     // 100 WETH
    await usdc.mint(deployerAddr, 10_000_000_000000n);            // 10M USDC
    await usdc.mint(liquidatorAddr, 1_000_000_000000n);           // 1M USDC

    // Seed pool with USDC liquidity
    await usdc.connect(deployer).approve(await lendingPool.getAddress(), 5_000_000_000000n);
    await lendingPool.connect(deployer).seedLiquidity(5_000_000_000000n);
  });

  // ──────────────────────────────────────────────
  //  Deposit & Withdraw
  // ──────────────────────────────────────────────

  describe("Deposit", function () {
    it("should deposit WETH and track collateral", async function () {
      const amount = ethers.parseEther("10");
      await weth.connect(borrower).approve(await lendingPool.getAddress(), amount);
      await lendingPool.connect(borrower).deposit(amount);

      const pos = await lendingPool.getPosition(borrowerAddr);
      expect(pos.collateralAmount).to.equal(amount);
      expect(await lendingPool.getTotalDeposits()).to.equal(amount);
    });

    it("should revert on zero deposit", async function () {
      await expect(
        lendingPool.connect(borrower).deposit(0)
      ).to.be.revertedWithCustomError(lendingPool, "ZeroAmount");
    });
  });

  describe("Withdraw", function () {
    beforeEach(async function () {
      const amount = ethers.parseEther("10");
      await weth.connect(borrower).approve(await lendingPool.getAddress(), amount);
      await lendingPool.connect(borrower).deposit(amount);
    });

    it("should withdraw collateral without debt", async function () {
      await lendingPool.connect(borrower).withdraw(ethers.parseEther("5"));
      const pos = await lendingPool.getPosition(borrowerAddr);
      expect(pos.collateralAmount).to.equal(ethers.parseEther("5"));
    });

    it("should revert withdrawal that would breach LTV", async function () {
      // Borrow first
      await lendingPool.connect(borrower).borrow(10_000_000000n); // 10k USDC
      // Try to withdraw too much collateral
      await expect(
        lendingPool.connect(borrower).withdraw(ethers.parseEther("9"))
      ).to.be.revertedWithCustomError(lendingPool, "WithdrawWouldBreachLTV");
    });
  });

  // ──────────────────────────────────────────────
  //  Borrow & Repay
  // ──────────────────────────────────────────────

  describe("Borrow", function () {
    beforeEach(async function () {
      const amount = ethers.parseEther("10");
      await weth.connect(borrower).approve(await lendingPool.getAddress(), amount);
      await lendingPool.connect(borrower).deposit(amount);
    });

    it("should borrow within LTV", async function () {
      // 10 WETH * $2000 * 75% LTV = $15,000 max borrow
      const borrowAmount = 14_000_000000n; // 14k USDC (within limit)
      await lendingPool.connect(borrower).borrow(borrowAmount);

      const pos = await lendingPool.getPosition(borrowerAddr);
      expect(pos.debtAmount).to.be.gt(0);
    });

    it("should revert borrow exceeding LTV", async function () {
      // 10 WETH * $2000 * 75% = $15,000 max → try $16,000
      const borrowAmount = 16_000_000000n;
      await expect(
        lendingPool.connect(borrower).borrow(borrowAmount)
      ).to.be.revertedWithCustomError(lendingPool, "BorrowExceedsLTV");
    });

    it("should track health factor correctly", async function () {
      await lendingPool.connect(borrower).borrow(10_000_000000n);
      const hf = await lendingPool.getHealthFactor(borrowerAddr);
      // HF = (10 * 2000 * 0.75) / (10000 * 1) = 15000/10000 = 1.5
      expect(hf).to.be.closeTo(ethers.parseEther("1.5"), ethers.parseEther("0.01"));
    });
  });

  describe("Repay", function () {
    beforeEach(async function () {
      await weth.connect(borrower).approve(await lendingPool.getAddress(), ethers.parseEther("10"));
      await lendingPool.connect(borrower).deposit(ethers.parseEther("10"));
      await lendingPool.connect(borrower).borrow(10_000_000000n);
      // Give borrower USDC to repay
      await usdc.mint(borrowerAddr, 20_000_000000n);
    });

    it("should repay debt fully", async function () {
      await usdc.connect(borrower).approve(await lendingPool.getAddress(), 10_000_000000n);
      await lendingPool.connect(borrower).repay(10_000_000000n);

      const pos = await lendingPool.getPosition(borrowerAddr);
      expect(pos.debtAmount).to.equal(0);
    });
  });

  // ──────────────────────────────────────────────
  //  Liquidation
  // ──────────────────────────────────────────────

  describe("Liquidation", function () {
    beforeEach(async function () {
      // Setup: borrower deposits 10 WETH, borrows 14k USDC (near max LTV)
      await weth.connect(borrower).approve(await lendingPool.getAddress(), ethers.parseEther("10"));
      await lendingPool.connect(borrower).deposit(ethers.parseEther("10"));
      await lendingPool.connect(borrower).borrow(14_000_000000n);
    });

    it("should revert liquidation on healthy position", async function () {
      await usdc.connect(liquidator).approve(await lendingPool.getAddress(), 7_000_000000n);
      await expect(
        lendingPool.connect(liquidator).liquidate(borrowerAddr, 7_000_000000n)
      ).to.be.revertedWithCustomError(lendingPool, "PositionHealthy");
    });

    it("should liquidate after price drop makes HF < 1", async function () {
      // Drop ETH price from $2000 to $1500
      // New HF = (10 * 1500 * 0.75) / (14000 * 1) = 11250/14000 ≈ 0.803
      await oracle.setPrice(await weth.getAddress(), 1500_00000000n);

      const hfBefore = await lendingPool.getHealthFactor(borrowerAddr);
      expect(hfBefore).to.be.lt(PRECISION); // HF < 1.0

      // Liquidator repays 50% of debt (close factor)
      const repayAmount = 7_000_000000n;
      await usdc.connect(liquidator).approve(await lendingPool.getAddress(), repayAmount);

      await expect(
        lendingPool.connect(liquidator).liquidate(borrowerAddr, repayAmount)
      ).to.emit(lendingPool, "Liquidation");

      // Health factor should improve after liquidation
      const hfAfter = await lendingPool.getHealthFactor(borrowerAddr);
      expect(hfAfter).to.be.gt(hfBefore);
    });

    it("should enforce close factor limit", async function () {
      await oracle.setPrice(await weth.getAddress(), 1500_00000000n);

      // Try to repay more than close factor allows (50% of 14k = 7k max)
      const repayAmount = 10_000_000000n; // Over the 7k limit
      await usdc.connect(liquidator).approve(await lendingPool.getAddress(), repayAmount);

      await expect(
        lendingPool.connect(liquidator).liquidate(borrowerAddr, repayAmount)
      ).to.be.revertedWithCustomError(lendingPool, "ExceedsCloseFactor");
    });

    it("should prevent self-liquidation", async function () {
      await oracle.setPrice(await weth.getAddress(), 1500_00000000n);
      await usdc.mint(borrowerAddr, 7_000_000000n);
      await usdc.connect(borrower).approve(await lendingPool.getAddress(), 7_000_000000n);

      await expect(
        lendingPool.connect(borrower).liquidate(borrowerAddr, 7_000_000000n)
      ).to.be.revertedWithCustomError(lendingPool, "SelfLiquidation");
    });
  });

  // ──────────────────────────────────────────────
  //  Interest Accrual
  // ──────────────────────────────────────────────

  describe("Interest Accrual", function () {
    it("should accrue interest over time", async function () {
      await weth.connect(borrower).approve(await lendingPool.getAddress(), ethers.parseEther("10"));
      await lendingPool.connect(borrower).deposit(ethers.parseEther("10"));
      await lendingPool.connect(borrower).borrow(10_000_000000n);

      const posBefore = await lendingPool.getPosition(borrowerAddr);

      // Advance 30 days
      await time.increase(30 * 24 * 60 * 60);

      // Trigger interest accrual via a no-op interaction
      await usdc.mint(borrowerAddr, 1_000000n);
      await usdc.connect(borrower).approve(await lendingPool.getAddress(), 1_000000n);
      await lendingPool.connect(borrower).repay(1_000000n);

      const posAfter = await lendingPool.getPosition(borrowerAddr);
      // Debt should be higher due to interest (minus the 1 USDC repaid)
      const debtBeforeMinusRepay = posBefore.debtAmount - ethers.parseEther("0.000001") * 10n ** 12n;
      // Just check totalBorrows increased
      expect(await lendingPool.getBorrowIndex()).to.be.gt(PRECISION);
    });
  });

  // ──────────────────────────────────────────────
  //  InterestRateModel
  // ──────────────────────────────────────────────

  describe("InterestRateModel", function () {
    it("should return higher rate above optimal utilization", async function () {
      const deposits = ethers.parseEther("100");
      const lowBorrow = ethers.parseEther("50");  // 50% util (below 80%)
      const highBorrow = ethers.parseEther("90"); // 90% util (above 80%)

      const lowRate = await interestModel.getBorrowRate(deposits, lowBorrow);
      const highRate = await interestModel.getBorrowRate(deposits, highBorrow);

      expect(highRate).to.be.gt(lowRate);
    });

    it("should return base rate with zero borrows", async function () {
      const rate = await interestModel.getBorrowRate(ethers.parseEther("100"), 0n);
      // 2% base rate per year = ~633761756 per second
      expect(rate).to.be.closeTo(633761756n, 100n);
    });
  });

  // ──────────────────────────────────────────────
  //  PriceOracle
  // ──────────────────────────────────────────────

  describe("PriceOracle", function () {
    it("should set and get prices", async function () {
      const price = await oracle.getPrice(await weth.getAddress());
      expect(price).to.equal(ETH_PRICE);
    });

    it("should revert for unset price", async function () {
      const randomAddr = "0x0000000000000000000000000000000000000042";
      await expect(
        oracle.getPrice(randomAddr)
      ).to.be.revertedWithCustomError(oracle, "PriceNotSet");
    });

    it("should batch set prices", async function () {
      const assets = [await weth.getAddress(), await usdc.getAddress()];
      const prices = [3000_00000000n, 1_00000000n];
      await oracle.setPrices(assets, prices);

      expect(await oracle.getPrice(assets[0])).to.equal(prices[0]);
      expect(await oracle.getPrice(assets[1])).to.equal(prices[1]);
    });
  });

  // ──────────────────────────────────────────────
  //  Pause / Admin
  // ──────────────────────────────────────────────

  describe("Admin & Pause", function () {
    it("should pause and unpause", async function () {
      await lendingPool.connect(deployer).pause();

      await weth.connect(borrower).approve(await lendingPool.getAddress(), ethers.parseEther("1"));
      await expect(
        lendingPool.connect(borrower).deposit(ethers.parseEther("1"))
      ).to.be.reverted; // EnforcedPause

      await lendingPool.connect(deployer).unpause();

      // Should work again
      await lendingPool.connect(borrower).deposit(ethers.parseEther("1"));
    });

    it("should update LTV", async function () {
      await lendingPool.connect(deployer).setLTV(ethers.parseEther("0.80"));
      expect(await lendingPool.ltv()).to.equal(ethers.parseEther("0.80"));
    });
  });
});
