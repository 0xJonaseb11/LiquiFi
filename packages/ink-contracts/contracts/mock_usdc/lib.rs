//! # MockUSDC — PSP22 USD Coin for Testing
//!
//! A PSP22-compliant token with 6 decimals and public mint.
//! Equivalent to MockUSDC.sol in the EVM version.

#![cfg_attr(not(feature = "std"), no_std, no_main)]

#[ink::contract]
mod mock_usdc {
    use ink::prelude::string::String;
    use pendzl::contracts::psp22::*;

    /// Mock USDC token for testing.
    #[ink(storage)]
    #[derive(Default, pendzl::traits::StorageFieldGetter)]
    pub struct MockUSDC {
        #[storage_field]
        psp22: PSP22Data,
        /// Contract owner (deployer).
        owner: AccountId,
    }

    impl PSP22 for MockUSDC {}

    impl MockUSDC {
        /// Constructor — sets deployer as owner.
        #[ink(constructor)]
        pub fn new() -> Self {
            let caller = Self::env().caller();
            Self {
                psp22: PSP22Data::default(),
                owner: caller,
            }
        }

        /// Mint tokens for testing.
        #[ink(message)]
        pub fn mint(&mut self, to: AccountId, amount: Balance) -> Result<(), PSP22Error> {
            self.psp22._mint_to(&to, &amount)?;
            Ok(())
        }

        /// Returns token name.
        #[ink(message)]
        pub fn token_name(&self) -> String {
            String::from("USD Coin")
        }

        /// Returns token symbol.
        #[ink(message)]
        pub fn token_symbol(&self) -> String {
            String::from("USDC")
        }

        /// Returns 6 decimals (USDC standard).
        #[ink(message)]
        pub fn token_decimals(&self) -> u8 {
            6
        }

        /// Returns the contract owner.
        #[ink(message)]
        pub fn owner(&self) -> AccountId {
            self.owner
        }
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[ink::test]
        fn mint_works() {
            let mut contract = MockUSDC::new();
            let accounts = ink::env::test::default_accounts::<ink::env::DefaultEnvironment>();

            let amount: Balance = 100_000 * 10u128.pow(6); // 100,000 USDC
            assert!(contract.mint(accounts.alice, amount).is_ok());
            assert_eq!(contract.balance_of(accounts.alice), amount);
        }

        #[ink::test]
        fn decimals_correct() {
            let contract = MockUSDC::new();
            assert_eq!(contract.token_decimals(), 6);
            assert_eq!(contract.token_symbol(), "USDC");
        }
    }
}
