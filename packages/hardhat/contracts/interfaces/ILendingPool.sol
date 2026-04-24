// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title ILendingPool
/// @notice Interface for the core lending pool contract
interface ILendingPool {
    // ──────────────────────────────────────────────
    //  Structs
    // ──────────────────────────────────────────────

    struct Position {
        uint256 collateralAmount; // WETH deposited (18 decimals)
        uint256 debtAmount; // USDC borrowed (6 decimals), scaled to 18 internally
        uint256 lastUpdateTimestamp;
    }

    // ──────────────────────────────────────────────
    //  Events
    // ──────────────────────────────────────────────

    event Deposit(address indexed user, uint256 amount);
    event Withdraw(address indexed user, uint256 amount);
    event Borrow(address indexed user, uint256 amount);
    event Repay(address indexed user, uint256 amount);
    event Liquidation(
        address indexed liquidator,
        address indexed borrower,
        uint256 debtRepaid,
        uint256 collateralSeized
    );
    event LTVUpdated(uint256 oldLtv, uint256 newLtv);
    event LiquidationParamsUpdated(uint256 closeFactor, uint256 liquidationIncentive);
    event OracleUpdated(address oldOracle, address newOracle);
    event LiquidationThresholdUpdated(uint256 oldThreshold, uint256 newThreshold);

    // ──────────────────────────────────────────────
    //  User actions
    // ──────────────────────────────────────────────

    function deposit(uint256 amount) external;
    function withdraw(uint256 amount) external;
    function borrow(uint256 amount) external;
    function repay(uint256 amount) external;

    // ──────────────────────────────────────────────
    //  Liquidation
    // ──────────────────────────────────────────────

    function liquidate(address borrower, uint256 repayAmount) external;

    // ──────────────────────────────────────────────
    //  View functions
    // ──────────────────────────────────────────────

    function getHealthFactor(address user) external view returns (uint256);
    function getPosition(address user) external view returns (Position memory);
    function getTotalDeposits() external view returns (uint256);
    function getTotalBorrows() external view returns (uint256);
    function getUtilizationRate() external view returns (uint256);
    function getBorrowRate() external view returns (uint256);
}
