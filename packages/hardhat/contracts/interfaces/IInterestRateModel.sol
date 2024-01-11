// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IInterestRateModel
/// @notice Interface for the utilization-based interest rate model
interface IInterestRateModel {
    /// @notice Calculate the current borrow rate per second
    /// @param totalDeposits Total deposits in the pool
    /// @param totalBorrows Total outstanding borrows
    /// @return borrowRate The borrow rate per second (scaled by 1e18)
    function getBorrowRate(uint256 totalDeposits, uint256 totalBorrows) external view returns (uint256 borrowRate);

    /// @notice Calculate the current supply rate per second
    /// @param totalDeposits Total deposits in the pool
    /// @param totalBorrows Total outstanding borrows
    /// @return supplyRate The supply rate per second (scaled by 1e18)
    function getSupplyRate(uint256 totalDeposits, uint256 totalBorrows) external view returns (uint256 supplyRate);

    /// @notice Get the current utilization rate
    /// @param totalDeposits Total deposits in the pool
    /// @param totalBorrows Total outstanding borrows
    /// @return utilization The utilization rate (scaled by 1e18)
    function getUtilization(uint256 totalDeposits, uint256 totalBorrows) external pure returns (uint256 utilization);
}
