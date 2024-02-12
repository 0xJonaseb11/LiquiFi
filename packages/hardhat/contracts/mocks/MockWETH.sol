// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title MockWETH
/// @notice Test WETH token with public mint for local development
contract MockWETH is ERC20, Ownable {
    constructor() ERC20("Wrapped Ether", "WETH") Ownable(msg.sender) {}

    /// @notice Mint tokens for testing - only owner in prod, public for testnet
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    /// @notice Returns 18 decimals (standard)
    function decimals() public pure override returns (uint8) {
        return 18;
    }
}
