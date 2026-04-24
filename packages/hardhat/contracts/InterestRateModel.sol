// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "./interfaces/IInterestRateModel.sol";

/// @title InterestRateModel
/// @notice Utilization-based interest rate model with kink (optimal utilization point)
/// @dev Follows the jump rate model pattern used by Compound/Aave:
///      - Below optimal utilization: gentle linear slope (slope1)
///      - Above optimal utilization: steep linear slope (slope2) to incentivize deposits
contract InterestRateModel is Initializable, UUPSUpgradeable, OwnableUpgradeable, IInterestRateModel {
    // ──────────────────────────────────────────────
    //  Custom Errors (gas-efficient over require strings)
    // ──────────────────────────────────────────────

    error InvalidOptimalUtilization();
    error InvalidBaseRate();
    error InvalidSlope();

    // ──────────────────────────────────────────────
    //  Constants
    // ──────────────────────────────────────────────

    /// @notice Precision for rate calculations (100% = 1e18)
    uint256 public constant PRECISION = 1e18;

    /// @notice Seconds per year for APR → per-second conversion
    uint256 public constant SECONDS_PER_YEAR = 365.25 days;

    // ──────────────────────────────────────────────
    //  State Variables
    // ──────────────────────────────────────────────

    /// @notice Base borrow rate per year (e.g., 2% = 0.02e18)
    uint256 public baseRatePerYear;

    /// @notice Slope below optimal utilization (e.g., 10% = 0.10e18)
    uint256 public slope1;

    /// @notice Slope above optimal utilization (e.g., 100% = 1.0e18)
    uint256 public slope2;

    /// @notice Optimal utilization rate (e.g., 80% = 0.80e18)
    uint256 public optimalUtilization;

    /// @notice Reserve factor — portion of interest kept as protocol revenue
    uint256 public reserveFactor;

    // ──────────────────────────────────────────────
    //  Events
    // ──────────────────────────────────────────────

    event RateParamsUpdated(uint256 baseRate, uint256 slope1, uint256 slope2, uint256 optimalUtilization);

    // ──────────────────────────────────────────────
    //  Initializer (replaces constructor for UUPS)
    // ──────────────────────────────────────────────

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @notice Initialize the interest rate model with parameters
    /// @param _baseRatePerYear Annual base rate (1e18 = 100%)
    /// @param _slope1 Rate slope below optimal utilization
    /// @param _slope2 Rate slope above optimal utilization (steep)
    /// @param _optimalUtilization The kink point (e.g., 0.8e18 = 80%)
    /// @param _reserveFactor Fraction of interest for protocol (e.g., 0.1e18 = 10%)
    function initialize(
        uint256 _baseRatePerYear,
        uint256 _slope1,
        uint256 _slope2,
        uint256 _optimalUtilization,
        uint256 _reserveFactor,
        address _owner
    ) external initializer {
        if (_optimalUtilization == 0 || _optimalUtilization > PRECISION) {
            revert InvalidOptimalUtilization();
        }

        __Ownable_init(_owner);
        __UUPSUpgradeable_init();

        baseRatePerYear = _baseRatePerYear;
        slope1 = _slope1;
        slope2 = _slope2;
        optimalUtilization = _optimalUtilization;
        reserveFactor = _reserveFactor;
    }

    // ──────────────────────────────────────────────
    //  External View Functions
    // ──────────────────────────────────────────────

    /// @inheritdoc IInterestRateModel
    function getUtilization(uint256 totalDeposits, uint256 totalBorrows) public pure override returns (uint256) {
        if (totalDeposits == 0) return 0;
        return (totalBorrows * PRECISION) / totalDeposits;
    }

    /// @inheritdoc IInterestRateModel
    function getBorrowRate(uint256 totalDeposits, uint256 totalBorrows) external view override returns (uint256) {
        return _getBorrowRatePerSecond(totalDeposits, totalBorrows);
    }

    /// @inheritdoc IInterestRateModel
    function getSupplyRate(uint256 totalDeposits, uint256 totalBorrows) external view override returns (uint256) {
        uint256 borrowRate = _getBorrowRatePerSecond(totalDeposits, totalBorrows);
        uint256 utilization = getUtilization(totalDeposits, totalBorrows);

        // Supply rate = borrow rate * utilization * (1 - reserveFactor)
        return (borrowRate * utilization * (PRECISION - reserveFactor)) / (PRECISION * PRECISION);
    }

    /// @notice Get the annualized borrow rate for display purposes
    function getBorrowRateAPR(uint256 totalDeposits, uint256 totalBorrows) external view returns (uint256) {
        return _getBorrowRatePerSecond(totalDeposits, totalBorrows) * SECONDS_PER_YEAR;
    }

    // ──────────────────────────────────────────────
    //  Admin Functions
    // ──────────────────────────────────────────────

    /// @notice Update rate model parameters
    function updateParams(
        uint256 _baseRatePerYear,
        uint256 _slope1,
        uint256 _slope2,
        uint256 _optimalUtilization
    ) external onlyOwner {
        if (_optimalUtilization == 0 || _optimalUtilization > PRECISION) {
            revert InvalidOptimalUtilization();
        }
        baseRatePerYear = _baseRatePerYear;
        slope1 = _slope1;
        slope2 = _slope2;
        optimalUtilization = _optimalUtilization;

        emit RateParamsUpdated(_baseRatePerYear, _slope1, _slope2, _optimalUtilization);
    }

    // ──────────────────────────────────────────────
    //  Internal Logic
    // ──────────────────────────────────────────────

    /// @dev Core rate calculation: jump rate model
    ///      If utilization <= optimal: rate = baseRate + (utilization / optimal) * slope1
    ///      If utilization >  optimal: rate = baseRate + slope1 + ((utilization - optimal) / (1 - optimal)) * slope2
    function _getBorrowRatePerSecond(uint256 totalDeposits, uint256 totalBorrows) internal view returns (uint256) {
        uint256 utilization = getUtilization(totalDeposits, totalBorrows);
        uint256 annualRate;

        if (utilization <= optimalUtilization) {
            // Linear ramp: base + proportional slope1
            annualRate = baseRatePerYear + (utilization * slope1) / optimalUtilization;
        } else {
            // Above kink: base + full slope1 + excess * slope2
            uint256 excessUtilization = utilization - optimalUtilization;
            uint256 remainingUtilization = PRECISION - optimalUtilization;
            annualRate = baseRatePerYear + slope1 + (excessUtilization * slope2) / remainingUtilization;
        }

        // Convert annual rate to per-second rate
        return annualRate / SECONDS_PER_YEAR;
    }

    // ──────────────────────────────────────────────
    //  UUPS Authorization
    // ──────────────────────────────────────────────

    /// @dev Only owner can upgrade the implementation
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
