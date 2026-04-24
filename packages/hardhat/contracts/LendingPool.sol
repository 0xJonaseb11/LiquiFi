// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/IPriceOracle.sol";
import "./interfaces/IInterestRateModel.sol";
import "./interfaces/ILendingPool.sol";

/// @title LendingPool
/// @notice Core lending protocol: deposit WETH as collateral, borrow USDC against it
/// @dev Single-pair pool for clarity. Production would use a factory pattern for multi-asset markets.
///      Security: ReentrancyGuard on all external mutating functions, Pausable for emergencies.
///      Gas: custom errors, unchecked math where safe, minimal storage reads via caching.
contract LendingPool is
    Initializable,
    UUPSUpgradeable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    PausableUpgradeable,
    ILendingPool
{
    using SafeERC20 for IERC20;

    // ──────────────────────────────────────────────
    //  Custom Errors
    // ──────────────────────────────────────────────

    error ZeroAmount();
    error InsufficientCollateral();
    error InsufficientDebt();
    error BorrowExceedsLTV();
    error PositionHealthy(uint256 healthFactor);
    error ExceedsCloseFactor(uint256 maxRepay);
    error InsufficientPoolLiquidity();
    error WithdrawWouldBreachLTV();
    error InvalidLTV();
    error InvalidCloseFactor();
    error InvalidLiquidationIncentive();
    error SelfLiquidation();
    error StaleOraclePrice();

    // ──────────────────────────────────────────────
    //  Constants
    // ──────────────────────────────────────────────

    /// @notice All internal math uses 1e18 precision
    uint256 public constant PRECISION = 1e18;

    /// @notice Oracle prices use 8 decimals (Chainlink standard)
    uint256 public constant ORACLE_PRECISION = 1e8;

    /// @notice WETH decimals
    uint256 public constant COLLATERAL_DECIMALS = 18;

    /// @notice USDC decimals
    uint256 public constant DEBT_DECIMALS = 6;

    /// @notice Health factor threshold below which liquidation is allowed
    /// @dev Scaled to 1e18 (1.0 = standard, higher = more aggressive)
    uint256 public liquidationThreshold;

    // ──────────────────────────────────────────────
    //  State Variables
    // ──────────────────────────────────────────────

    /// @notice Collateral token (WETH)
    IERC20 public collateralToken;

    /// @notice Debt token (USDC)
    IERC20 public debtToken;

    /// @notice Price oracle for asset valuation
    IPriceOracle public oracle;

    /// @notice Interest rate model
    IInterestRateModel public interestRateModel;

    /// @notice Loan-to-Value ratio (e.g., 0.75e18 = 75%)
    uint256 public ltv;

    /// @notice Max % of debt repayable in single liquidation (e.g., 0.50e18 = 50%)
    uint256 public closeFactor;

    /// @notice Bonus collateral for liquidators (e.g., 0.05e18 = 5%)
    uint256 public liquidationIncentive;

    /// @notice Total collateral deposited across all users
    uint256 public totalDeposits;

    /// @notice Total debt outstanding (normalized to 18 decimals internally)
    uint256 public totalBorrows;

    /// @notice Cumulative borrow index for interest accrual
    uint256 public borrowIndex;

    /// @notice Timestamp of last interest accrual
    uint256 public lastAccrualTimestamp;

    /// @notice User address → position data
    mapping(address => Position) private _positions;

    /// @notice User address → borrow index at time of last interaction
    mapping(address => uint256) private _userBorrowIndex;

    /// @notice Set of all addresses that have ever borrowed (for position scanning)
    address[] public borrowerList;
    mapping(address => bool) public isBorrower;

    // ──────────────────────────────────────────────
    //  Initializer
    // ──────────────────────────────────────────────

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @notice Initialize the lending pool
    /// @param _collateralToken WETH address
    /// @param _debtToken USDC address
    /// @param _oracle Price oracle address
    /// @param _interestRateModel Interest rate model address
    /// @param _ltv Loan-to-value ratio (1e18 = 100%)
    /// @param _closeFactor Max liquidation close factor
    /// @param _liquidationIncentive Liquidator bonus
    /// @param _owner Protocol admin
    function initialize(
        address _collateralToken,
        address _debtToken,
        address _oracle,
        address _interestRateModel,
        uint256 _ltv,
        uint256 _closeFactor,
        uint256 _liquidationIncentive,
        address _owner
    ) external initializer {
        if (_ltv == 0 || _ltv > PRECISION) revert InvalidLTV();
        if (_closeFactor == 0 || _closeFactor > PRECISION) revert InvalidCloseFactor();
        if (_liquidationIncentive > PRECISION) revert InvalidLiquidationIncentive();

        __Ownable_init(_owner);
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();
        __Pausable_init();

        collateralToken = IERC20(_collateralToken);
        debtToken = IERC20(_debtToken);
        oracle = IPriceOracle(_oracle);
        interestRateModel = IInterestRateModel(_interestRateModel);
        ltv = _ltv;
        closeFactor = _closeFactor;
        liquidationIncentive = _liquidationIncentive;
        liquidationThreshold = PRECISION; // Default to 1.0
        borrowIndex = PRECISION; // Start at 1.0
        lastAccrualTimestamp = block.timestamp;
    }

    // ──────────────────────────────────────────────
    //  User Actions
    // ──────────────────────────────────────────────

    /// @notice Deposit WETH as collateral
    /// @param amount Amount of WETH to deposit (18 decimals)
    function deposit(uint256 amount) external nonReentrant whenNotPaused {
        if (amount == 0) revert ZeroAmount();

        _accrueInterest();

        _positions[msg.sender].collateralAmount += amount;
        totalDeposits += amount;

        collateralToken.safeTransferFrom(msg.sender, address(this), amount);

        emit Deposit(msg.sender, amount);
    }

    /// @notice Withdraw collateral (must maintain healthy position)
    /// @param amount Amount of WETH to withdraw
    function withdraw(uint256 amount) external nonReentrant whenNotPaused {
        if (amount == 0) revert ZeroAmount();

        Position storage pos = _positions[msg.sender];
        if (pos.collateralAmount < amount) revert InsufficientCollateral();

        _accrueInterest();
        _applyUserInterest(msg.sender);

        // Check that withdrawal doesn't breach LTV if user has debt
        uint256 remainingCollateral = pos.collateralAmount - amount;
        if (pos.debtAmount > 0) {
            uint256 maxBorrow = _calculateMaxBorrow(remainingCollateral);
            uint256 currentDebt = _debtInUSD(pos.debtAmount);
            if (currentDebt > maxBorrow) revert WithdrawWouldBreachLTV();
        }

        pos.collateralAmount = remainingCollateral;
        totalDeposits -= amount;

        collateralToken.safeTransfer(msg.sender, amount);

        emit Withdraw(msg.sender, amount);
    }

    /// @notice Borrow USDC against deposited collateral
    /// @param amount Amount of USDC to borrow (6 decimals)
    function borrow(uint256 amount) external nonReentrant whenNotPaused {
        if (amount == 0) revert ZeroAmount();

        _accrueInterest();
        _applyUserInterest(msg.sender);

        Position storage pos = _positions[msg.sender];

        // Normalize USDC (6 dec) → 18 decimals for internal accounting
        uint256 normalizedAmount = _normalizeDebtAmount(amount);

        // Check LTV constraint
        uint256 newDebt = pos.debtAmount + normalizedAmount;
        uint256 maxBorrow = _calculateMaxBorrow(pos.collateralAmount);
        uint256 newDebtUSD = _debtInUSD(newDebt);
        if (newDebtUSD > maxBorrow) revert BorrowExceedsLTV();

        // Check pool liquidity
        if (debtToken.balanceOf(address(this)) < amount) revert InsufficientPoolLiquidity();

        pos.debtAmount = newDebt;
        pos.lastUpdateTimestamp = block.timestamp;
        totalBorrows += normalizedAmount;

        // Track borrower for position scanning
        if (!isBorrower[msg.sender]) {
            isBorrower[msg.sender] = true;
            borrowerList.push(msg.sender);
        }

        _userBorrowIndex[msg.sender] = borrowIndex;

        debtToken.safeTransfer(msg.sender, amount);

        emit Borrow(msg.sender, amount);
    }

    /// @notice Repay borrowed USDC
    /// @param amount Amount of USDC to repay (6 decimals)
    function repay(uint256 amount) external nonReentrant whenNotPaused {
        if (amount == 0) revert ZeroAmount();

        _accrueInterest();
        _applyUserInterest(msg.sender);

        Position storage pos = _positions[msg.sender];
        uint256 normalizedAmount = _normalizeDebtAmount(amount);

        // Cap repayment to outstanding debt
        if (normalizedAmount > pos.debtAmount) {
            normalizedAmount = pos.debtAmount;
            // Recalculate actual USDC amount to transfer
            amount = _denormalizeDebtAmount(normalizedAmount);
        }

        pos.debtAmount -= normalizedAmount;
        totalBorrows -= normalizedAmount;
        _userBorrowIndex[msg.sender] = borrowIndex;

        debtToken.safeTransferFrom(msg.sender, address(this), amount);

        emit Repay(msg.sender, amount);
    }

    // ──────────────────────────────────────────────
    //  Liquidation
    // ──────────────────────────────────────────────

    /// @notice Liquidate an unhealthy position
    /// @dev Liquidator repays part of borrower's USDC debt and receives WETH collateral at a discount.
    ///      The close factor limits how much debt can be repaid in one liquidation call.
    /// @param borrower Address of the unhealthy position
    /// @param repayAmount Amount of USDC to repay (6 decimals)
    function liquidate(address borrower, uint256 repayAmount) external nonReentrant whenNotPaused {
        if (repayAmount == 0) revert ZeroAmount();
        if (borrower == msg.sender) revert SelfLiquidation();

        _accrueInterest();
        _applyUserInterest(borrower);

        Position storage pos = _positions[borrower];

        // Verify position is liquidatable
        uint256 hf = _calculateHealthFactor(pos);
        if (hf >= liquidationThreshold) revert PositionHealthy(hf);

        // Enforce close factor: max repayable = closeFactor * totalDebt
        uint256 normalizedRepay = _normalizeDebtAmount(repayAmount);
        uint256 maxRepay = (pos.debtAmount * closeFactor) / PRECISION;
        if (normalizedRepay > maxRepay) revert ExceedsCloseFactor(maxRepay);

        // Calculate collateral to seize:
        //   collateralSeized = (repayValueUSD * (1 + incentive)) / collateralPriceUSD
        uint256 debtPrice = oracle.getPrice(address(debtToken));
        uint256 collateralPrice = oracle.getPrice(address(collateralToken));

        // repayValueUSD in 8-decimal precision
        uint256 repayValueUSD = (normalizedRepay * debtPrice) / (10 ** COLLATERAL_DECIMALS);
        uint256 seizeValueUSD = (repayValueUSD * (PRECISION + liquidationIncentive)) / PRECISION;
        uint256 collateralSeized = (seizeValueUSD * (10 ** COLLATERAL_DECIMALS)) / collateralPrice;

        // Cap seizure to available collateral
        if (collateralSeized > pos.collateralAmount) {
            collateralSeized = pos.collateralAmount;
        }

        // Update state
        pos.debtAmount -= normalizedRepay;
        pos.collateralAmount -= collateralSeized;
        totalBorrows -= normalizedRepay;
        totalDeposits -= collateralSeized;

        // Transfer: liquidator pays USDC, receives WETH
        debtToken.safeTransferFrom(msg.sender, address(this), repayAmount);
        collateralToken.safeTransfer(msg.sender, collateralSeized);

        emit Liquidation(msg.sender, borrower, repayAmount, collateralSeized);
    }

    // ──────────────────────────────────────────────
    //  View Functions
    // ──────────────────────────────────────────────

    /// @notice Get the health factor of a user's position
    /// @return Health factor scaled to 1e18 (1e18 = 1.0, below = liquidatable)
    function getHealthFactor(address user) external view override returns (uint256) {
        return _calculateHealthFactor(_positions[user]);
    }

    /// @notice Get the current liquidation threshold
    function getLiquidationThreshold() external view returns (uint256) {
        return liquidationThreshold;
    }

    /// @notice Get full position data for a user
    function getPosition(address user) external view override returns (Position memory) {
        return _positions[user];
    }

    /// @inheritdoc ILendingPool
    function getTotalDeposits() external view override returns (uint256) {
        return totalDeposits;
    }

    /// @inheritdoc ILendingPool
    function getTotalBorrows() public view override returns (uint256) {
        uint256 elapsed = block.timestamp - lastAccrualTimestamp;
        if (elapsed == 0 || totalBorrows == 0) return totalBorrows;

        uint256 borrowRate = interestRateModel.getBorrowRate(totalDeposits, totalBorrows);
        uint256 interestFactor = borrowRate * elapsed;
        return totalBorrows + (totalBorrows * interestFactor) / PRECISION;
    }

    /// @inheritdoc ILendingPool
    function getUtilizationRate() external view override returns (uint256) {
        return interestRateModel.getUtilization(totalDeposits, getTotalBorrows());
    }

    /// @inheritdoc ILendingPool
    function getBorrowRate() external view override returns (uint256) {
        return interestRateModel.getBorrowRate(totalDeposits, getTotalBorrows());
    }

    /// @notice Get total number of borrowers (for off-chain scanning)
    function getBorrowerCount() external view returns (uint256) {
        return borrowerList.length;
    }

    /// @notice Get borrower address by index
    function getBorrowerAt(uint256 index) external view returns (address) {
        return borrowerList[index];
    }

    /// @notice Get the current borrow index (for interest calculation)
    function getBorrowIndex() external view returns (uint256) {
        return borrowIndex;
    }

    /// @notice Calculate max additional USDC borrowable by a user
    function getMaxBorrow(address user) external view returns (uint256) {
        Position memory pos = _positions[user];
        uint256 maxBorrowUSD = _calculateMaxBorrow(pos.collateralAmount);
        uint256 currentDebtUSD = _debtInUSD(pos.debtAmount);
        if (currentDebtUSD >= maxBorrowUSD) return 0;
        uint256 remainingUSD = maxBorrowUSD - currentDebtUSD;
        // Convert USD (8 dec) back to USDC (6 dec)
        uint256 debtPrice = oracle.getPrice(address(debtToken));
        return (remainingUSD * (10 ** DEBT_DECIMALS)) / debtPrice;
    }

    // ──────────────────────────────────────────────
    //  Admin Functions
    // ──────────────────────────────────────────────

    /// @notice Update the LTV ratio
    function setLTV(uint256 _ltv) external onlyOwner {
        if (_ltv == 0 || _ltv > PRECISION) revert InvalidLTV();
        uint256 oldLtv = ltv;
        ltv = _ltv;
        emit LTVUpdated(oldLtv, _ltv);
    }

    /// @notice Update liquidation parameters
    function setLiquidationParams(uint256 _closeFactor, uint256 _liquidationIncentive) external onlyOwner {
        if (_closeFactor == 0 || _closeFactor > PRECISION) revert InvalidCloseFactor();
        if (_liquidationIncentive > PRECISION) revert InvalidLiquidationIncentive();
        closeFactor = _closeFactor;
        liquidationIncentive = _liquidationIncentive;
        emit LiquidationParamsUpdated(_closeFactor, _liquidationIncentive);
    }

    /// @notice Update the price oracle
    function setOracle(address _oracle) external onlyOwner {
        address oldOracle = address(oracle);
        oracle = IPriceOracle(_oracle);
        emit OracleUpdated(oldOracle, _oracle);
    }

    /// @notice Emergency pause
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Unpause
    function unpause() external onlyOwner {
        _unpause();
    }

    /// @notice Update the liquidation threshold (AI risk adjustment)
    function setLiquidationThreshold(uint256 _threshold) external onlyOwner {
        if (_threshold < PRECISION) revert InvalidLTV(); // Threshold cannot be below 1.0
        uint256 oldThreshold = liquidationThreshold;
        liquidationThreshold = _threshold;
        emit LiquidationThresholdUpdated(oldThreshold, _threshold);
    }

    /// @notice Seed USDC liquidity into the pool (for lending)
    function seedLiquidity(uint256 amount) external onlyOwner {
        debtToken.safeTransferFrom(msg.sender, address(this), amount);
    }

    // ──────────────────────────────────────────────
    //  Internal: Interest Accrual
    // ──────────────────────────────────────────────

    /// @dev Accrue protocol-wide interest. Called before any state mutation.
    ///      Updates borrowIndex based on elapsed time and current borrow rate.
    function _accrueInterest() internal {
        uint256 elapsed = block.timestamp - lastAccrualTimestamp;
        if (elapsed == 0) return;

        if (totalBorrows > 0) {
            uint256 borrowRate = interestRateModel.getBorrowRate(totalDeposits, totalBorrows);
            // borrowIndex *= (1 + borrowRate * elapsed)
            uint256 interestFactor = borrowRate * elapsed;
            borrowIndex += (borrowIndex * interestFactor) / PRECISION;
        }

        lastAccrualTimestamp = block.timestamp;
    }

    /// @dev Apply accumulated interest to a specific user's debt
    function _applyUserInterest(address user) internal {
        Position storage pos = _positions[user];
        if (pos.debtAmount == 0) return;

        uint256 userIndex = _userBorrowIndex[user];
        if (userIndex == 0) {
            _userBorrowIndex[user] = borrowIndex;
            return;
        }

        // Scale debt by ratio of current index to user's stored index
        uint256 oldDebt = pos.debtAmount;
        pos.debtAmount = (pos.debtAmount * borrowIndex) / userIndex;

        // Update totalBorrows with the actual interest applied to this user
        // This keeps totalBorrows exactly in sync with the sum of all debtAmount
        totalBorrows = totalBorrows + pos.debtAmount - oldDebt;

        _userBorrowIndex[user] = borrowIndex;
    }

    // ──────────────────────────────────────────────
    //  Internal: Health Factor & LTV Calculations
    // ──────────────────────────────────────────────

    /// @dev Health Factor = (collateralValue * LTV) / debtValue
    ///      All in 1e18 precision. Returns type(uint256).max if no debt.
    function _calculateHealthFactor(Position memory pos) internal view returns (uint256) {
        if (pos.debtAmount == 0) return type(uint256).max;

        uint256 collateralPrice = oracle.getPrice(address(collateralToken));
        uint256 debtPrice = oracle.getPrice(address(debtToken));

        // collateralValueUSD = collateral * price / 1e18 (collateral is 18 dec, price is 8 dec)
        uint256 collateralValueUSD = (pos.collateralAmount * collateralPrice) / (10 ** COLLATERAL_DECIMALS);
        // Apply LTV to collateral value
        uint256 adjustedCollateral = (collateralValueUSD * ltv) / PRECISION;

        // debtValueUSD = debt * price / 1e18 (debt is normalized to 18 dec, price is 8 dec)
        uint256 debtValueUSD = (pos.debtAmount * debtPrice) / (10 ** COLLATERAL_DECIMALS);

        if (debtValueUSD == 0) return type(uint256).max;

        // HF = adjustedCollateral / debtValueUSD, scaled to 1e18
        return (adjustedCollateral * PRECISION) / debtValueUSD;
    }

    /// @dev Calculate maximum borrow capacity in USD (8 decimal precision)
    function _calculateMaxBorrow(uint256 collateralAmount) internal view returns (uint256) {
        uint256 collateralPrice = oracle.getPrice(address(collateralToken));
        uint256 collateralValueUSD = (collateralAmount * collateralPrice) / (10 ** COLLATERAL_DECIMALS);
        return (collateralValueUSD * ltv) / PRECISION;
    }

    /// @dev Convert debt amount (normalized 18 dec) to USD value (8 dec)
    function _debtInUSD(uint256 debtAmount) internal view returns (uint256) {
        uint256 debtPrice = oracle.getPrice(address(debtToken));
        return (debtAmount * debtPrice) / (10 ** COLLATERAL_DECIMALS);
    }

    // ──────────────────────────────────────────────
    //  Internal: Decimal Normalization
    // ──────────────────────────────────────────────

    /// @dev Convert USDC amount (6 dec) → internal representation (18 dec)
    function _normalizeDebtAmount(uint256 amount) internal pure returns (uint256) {
        return amount * (10 ** (COLLATERAL_DECIMALS - DEBT_DECIMALS));
    }

    /// @dev Convert internal representation (18 dec) → USDC amount (6 dec)
    function _denormalizeDebtAmount(uint256 amount) internal pure returns (uint256) {
        return amount / (10 ** (COLLATERAL_DECIMALS - DEBT_DECIMALS));
    }

    // ──────────────────────────────────────────────
    //  UUPS Authorization
    // ──────────────────────────────────────────────

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
