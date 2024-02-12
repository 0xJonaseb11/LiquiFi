// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "./interfaces/IPriceOracle.sol";

/// @title PriceOracle
/// @notice Mock price oracle with admin-settable prices for testing
/// @dev Production version would wrap Chainlink AggregatorV3Interface
contract PriceOracle is
    Initializable,
    UUPSUpgradeable,
    OwnableUpgradeable,
    IPriceOracle
{
    // ──────────────────────────────────────────────
    //  Custom Errors
    // ──────────────────────────────────────────────

    error PriceNotSet(address asset);
    error StalePrice(address asset, uint256 updatedAt, uint256 maxAge);
    error ZeroPrice();
    error ZeroAddress();

    // ──────────────────────────────────────────────
    //  Constants
    // ──────────────────────────────────────────────

    /// @notice Price precision: 8 decimals (matches Chainlink)
    uint256 public constant PRICE_PRECISION = 1e8;

    /// @notice Maximum acceptable price staleness
    uint256 public constant MAX_PRICE_AGE = 1 hours;

    // ──────────────────────────────────────────────
    //  State
    // ──────────────────────────────────────────────

    /// @notice asset address → USD price (8 decimals)
    mapping(address => uint256) private _prices;

    /// @notice asset address → last update timestamp
    mapping(address => uint256) private _updatedAt;

    // ──────────────────────────────────────────────
    //  Events
    // ──────────────────────────────────────────────

    event PriceSet(address indexed asset, uint256 price, uint256 timestamp);

    // ──────────────────────────────────────────────
    //  Initializer
    // ──────────────────────────────────────────────

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _owner) external initializer {
        __Ownable_init(_owner);
        __UUPSUpgradeable_init();
    }

    // ──────────────────────────────────────────────
    //  Admin Functions
    // ──────────────────────────────────────────────

    /// @notice Set the price for an asset (admin only)
    /// @param asset The token address
    /// @param price USD price with 8 decimals (e.g., 2000_00000000 = $2000)
    function setPrice(address asset, uint256 price) external onlyOwner {
        if (asset == address(0)) revert ZeroAddress();
        if (price == 0) revert ZeroPrice();

        _prices[asset] = price;
        _updatedAt[asset] = block.timestamp;

        emit PriceSet(asset, price, block.timestamp);
    }

    /// @notice Batch set prices for multiple assets
    /// @param assets Array of token addresses
    /// @param prices Array of USD prices with 8 decimals
    function setPrices(
        address[] calldata assets,
        uint256[] calldata prices
    ) external onlyOwner {
        uint256 len = assets.length;
        for (uint256 i; i < len; ) {
            if (assets[i] == address(0)) revert ZeroAddress();
            if (prices[i] == 0) revert ZeroPrice();

            _prices[assets[i]] = prices[i];
            _updatedAt[assets[i]] = block.timestamp;

            emit PriceSet(assets[i], prices[i], block.timestamp);

            unchecked { ++i; }
        }
    }

    // ──────────────────────────────────────────────
    //  View Functions
    // ──────────────────────────────────────────────

    /// @inheritdoc IPriceOracle
    function getPrice(address asset) external view override returns (uint256) {
        uint256 price = _prices[asset];
        if (price == 0) revert PriceNotSet(asset);
        return price;
    }

    /// @inheritdoc IPriceOracle
    function getPriceWithTimestamp(
        address asset
    ) external view override returns (uint256 price, uint256 updatedAt) {
        price = _prices[asset];
        if (price == 0) revert PriceNotSet(asset);
        updatedAt = _updatedAt[asset];
    }

    /// @notice Check if a price is considered fresh
    /// @param asset The token address
    /// @return True if the price was updated within MAX_PRICE_AGE
    function isPriceFresh(address asset) external view returns (bool) {
        return _updatedAt[asset] + MAX_PRICE_AGE >= block.timestamp;
    }

    // ──────────────────────────────────────────────
    //  UUPS Authorization
    // ──────────────────────────────────────────────

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
