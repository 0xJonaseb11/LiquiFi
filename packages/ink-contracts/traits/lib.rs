//! # LiquiFi Trait Definitions
//!
//! Shared trait interfaces for the LiquiFi DeFi lending protocol on Polkadot.
//! These mirror the Solidity interfaces (ILendingPool, IPriceOracle, IInterestRateModel).

#![cfg_attr(not(feature = "std"), no_std, no_main)]

use ink::prelude::vec::Vec;
use ink::primitives::AccountId;

// ──────────────────────────────────────────────
//  Error Types
// ──────────────────────────────────────────────

/// Unified error type for all protocol contracts.
#[derive(Debug, PartialEq, Eq, scale::Encode, scale::Decode)]
#[cfg_attr(feature = "std", derive(scale_info::TypeInfo))]
pub enum LiquiFiError {
    // General
    ZeroAmount,
    Unauthorized,
    // LendingPool
    InsufficientCollateral,
    InsufficientDebt,
    BorrowExceedsLtv,
    PositionHealthy,
    ExceedsCloseFactor,
    InsufficientPoolLiquidity,
    WithdrawWouldBreachLtv,
    InvalidLtv,
    InvalidCloseFactor,
    InvalidLiquidationIncentive,
    SelfLiquidation,
    StaleOraclePrice,
    // Oracle
    PriceNotSet,
    ZeroPrice,
    ZeroAddress,
    // InterestRateModel
    InvalidOptimalUtilization,
    InvalidBaseRate,
    InvalidSlope,
    // PSP22
    Psp22Error(Psp22ErrorKind),
    // Cross-chain
    InvalidState,
    RequestNotFound,
    RequestExpired,
    InsufficientBridgedFunds,
    MaxRetriesExceeded,
}

/// Simplified PSP22 error wrapper.
#[derive(Debug, PartialEq, Eq, scale::Encode, scale::Decode)]
#[cfg_attr(feature = "std", derive(scale_info::TypeInfo))]
pub enum Psp22ErrorKind {
    InsufficientBalance,
    InsufficientAllowance,
    ZeroRecipientAddress,
    ZeroSenderAddress,
    Custom(Vec<u8>),
}

// ──────────────────────────────────────────────
//  Position Struct
// ──────────────────────────────────────────────

/// User position in the lending pool.
#[derive(Debug, Default, Clone, PartialEq, Eq, scale::Encode, scale::Decode)]
#[cfg_attr(feature = "std", derive(scale_info::TypeInfo))]
pub struct Position {
    /// Collateral deposited (18 decimals)
    pub collateral_amount: u128,
    /// Debt borrowed, normalized to 18 decimals internally
    pub debt_amount: u128,
    /// Timestamp of last position update
    pub last_update_timestamp: u64,
}

// ──────────────────────────────────────────────
//  Trait: IPriceOracle
// ──────────────────────────────────────────────

/// Price oracle interface — compatible with Chainlink aggregator pattern.
/// Prices are returned in USD with 8 decimal places.
#[ink::trait_definition]
pub trait IPriceOracle {
    /// Get the USD price of an asset (8 decimals).
    #[ink(message)]
    fn get_price(&self, asset: AccountId) -> Result<u128, LiquiFiError>;

    /// Get the price and its staleness timestamp.
    #[ink(message)]
    fn get_price_with_timestamp(&self, asset: AccountId) -> Result<(u128, u64), LiquiFiError>;
}

// ──────────────────────────────────────────────
//  Trait: IInterestRateModel
// ──────────────────────────────────────────────

/// Interest rate model — utilization-based jump rate.
#[ink::trait_definition]
pub trait IInterestRateModel {
    /// Calculate borrow rate per second (scaled by 1e18).
    #[ink(message)]
    fn get_borrow_rate(&self, total_deposits: u128, total_borrows: u128) -> u128;

    /// Calculate supply rate per second (scaled by 1e18).
    #[ink(message)]
    fn get_supply_rate(&self, total_deposits: u128, total_borrows: u128) -> u128;

    /// Get utilization rate (scaled by 1e18).
    #[ink(message)]
    fn get_utilization(&self, total_deposits: u128, total_borrows: u128) -> u128;
}

// ──────────────────────────────────────────────
//  Trait: ILendingPool
// ──────────────────────────────────────────────

/// Core lending pool interface.
#[ink::trait_definition]
pub trait ILendingPool {
    /// Deposit collateral tokens.
    #[ink(message)]
    fn deposit(&mut self, amount: u128) -> Result<(), LiquiFiError>;

    /// Withdraw collateral (must maintain healthy position).
    #[ink(message)]
    fn withdraw(&mut self, amount: u128) -> Result<(), LiquiFiError>;

    /// Borrow debt tokens against deposited collateral.
    #[ink(message)]
    fn borrow(&mut self, amount: u128) -> Result<(), LiquiFiError>;

    /// Repay borrowed tokens.
    #[ink(message)]
    fn repay(&mut self, amount: u128) -> Result<(), LiquiFiError>;

    /// Liquidate an unhealthy position.
    #[ink(message)]
    fn liquidate(&mut self, borrower: AccountId, repay_amount: u128) -> Result<(), LiquiFiError>;

    /// Get the health factor of a user's position.
    #[ink(message)]
    fn get_health_factor(&self, user: AccountId) -> u128;

    /// Get full position data for a user.
    #[ink(message)]
    fn get_position(&self, user: AccountId) -> Position;

    /// Get total collateral deposited.
    #[ink(message)]
    fn get_total_deposits(&self) -> u128;

    /// Get total debt outstanding.
    #[ink(message)]
    fn get_total_borrows(&self) -> u128;

    /// Get utilization rate.
    #[ink(message)]
    fn get_utilization_rate(&self) -> u128;

    /// Get current borrow rate.
    #[ink(message)]
    fn get_borrow_rate(&self) -> u128;
}
