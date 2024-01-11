// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IPriceOracle
/// @notice Interface for price oracle - compatible with Chainlink aggregator pattern
interface IPriceOracle {
    /// @notice Get the USD price of an asset
    /// @param asset The asset address to price
    /// @return price The price in USD with 8 decimals (e.g., 2000_00000000 = $2000)
    function getPrice(address asset) external view returns (uint256 price);

    /// @notice Get the price and its staleness
    /// @param asset The asset address
    /// @return price The price in USD with 8 decimals
    /// @return updatedAt Timestamp of the last price update
    function getPriceWithTimestamp(address asset) external view returns (uint256 price, uint256 updatedAt);
}
