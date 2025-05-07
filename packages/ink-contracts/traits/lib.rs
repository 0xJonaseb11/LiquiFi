#![cfg_attr(not(feature = "std"), no_std, no_main)]
use ink::prelude::vec::Vec;
use ink::primitives::AccountId;
#[derive(Debug, PartialEq, Eq, scale::Encode, scale::Decode)]
#[cfg_attr(feature = "std", derive(scale_info::TypeInfo))]
pub enum LiquiFiError {
    ZeroAmount,
    Unauthorized,
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
    PriceNotSet,
    ZeroPrice,
    ZeroAddress,
    InvalidOptimalUtilization,
    InvalidBaseRate,
    InvalidSlope,
    Psp22Error(Psp22ErrorKind),
    InvalidState,
    RequestNotFound,
    RequestExpired,
    InsufficientBridgedFunds,
    MaxRetriesExceeded,
}
#[derive(Debug, PartialEq, Eq, scale::Encode, scale::Decode)]
#[cfg_attr(feature = "std", derive(scale_info::TypeInfo))]
pub enum Psp22ErrorKind {
    InsufficientBalance,
    InsufficientAllowance,
    ZeroRecipientAddress,
    ZeroSenderAddress,
    Custom(Vec<u8>),
}
#[derive(Debug, Default, Clone, PartialEq, Eq, scale::Encode, scale::Decode)]
#[cfg_attr(feature = "std", derive(scale_info::TypeInfo))]
pub struct Position {
    pub collateral_amount: u128,
    pub debt_amount: u128,
    pub last_update_timestamp: u64,
}
#[ink::trait_definition]
pub trait IPriceOracle {
    #[ink(message)]
    fn get_price(&self, asset: AccountId) -> Result<u128, LiquiFiError>;
    #[ink(message)]
    fn get_price_with_timestamp(&self, asset: AccountId) -> Result<(u128, u64), LiquiFiError>;
}
#[ink::trait_definition]
pub trait IInterestRateModel {
    #[ink(message)]
    fn get_borrow_rate(&self, total_deposits: u128, total_borrows: u128) -> u128;
    #[ink(message)]
    fn get_supply_rate(&self, total_deposits: u128, total_borrows: u128) -> u128;
    #[ink(message)]
    fn get_utilization(&self, total_deposits: u128, total_borrows: u128) -> u128;
}
#[ink::trait_definition]
pub trait ILendingPool {
    #[ink(message)]
    fn deposit(&mut self, amount: u128) -> Result<(), LiquiFiError>;
    #[ink(message)]
    fn withdraw(&mut self, amount: u128) -> Result<(), LiquiFiError>;
    #[ink(message)]
    fn borrow(&mut self, amount: u128) -> Result<(), LiquiFiError>;
    #[ink(message)]
    fn repay(&mut self, amount: u128) -> Result<(), LiquiFiError>;
    #[ink(message)]
    fn liquidate(&mut self, borrower: AccountId, repay_amount: u128) -> Result<(), LiquiFiError>;
    #[ink(message)]
    fn get_health_factor(&self, user: AccountId) -> u128;
    #[ink(message)]
    fn get_position(&self, user: AccountId) -> Position;
    #[ink(message)]
    fn get_total_deposits(&self) -> u128;
    #[ink(message)]
    fn get_total_borrows(&self) -> u128;
    #[ink(message)]
    fn get_utilization_rate(&self) -> u128;
    #[ink(message)]
    fn get_borrow_rate(&self) -> u128;
}
