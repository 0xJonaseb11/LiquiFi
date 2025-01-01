//! # MockWDOT — PSP22 Wrapped DOT for Testing
//!
//! A PSP22-compliant token with public mint for local development.
//! Equivalent to MockWETH.sol in the EVM version.
//! Uses 18 decimals (Polkadot standard).

#![cfg_attr(not(feature = "std"), no_std, no_main)]

#[ink::contract]
mod mock_wdot {
    use ink::prelude::string::String;
    use pendzl::contracts::psp22::*;

    /// Mock wrapped DOT token for testing.
    #[ink(storage)]
    #[derive(Default, pendzl::traits::StorageFieldGetter)]
    pub struct MockWDOT {
        #[storage_field]
        psp22: PSP22Data,
        /// Contract owner (deployer).
        owner: AccountId,
    }

    impl PSP22 for MockWDOT {}

    impl MockWDOT {
        /// Constructor — sets deployer as owner.
        #[ink(constructor)]
        pub fn new() -> Self {
            let caller = Self::env().caller();
            Self {
                psp22: PSP22Data::default(),
                owner: caller,
            }
        }

        /// Mint tokens for testing — public for testnet.
        #[ink(message)]
        pub fn mint(&mut self, to: AccountId, amount: Balance) -> Result<(), PSP22Error> {
            self.psp22._mint_to(&to, &amount)?;
            Ok(())
        }

        /// Returns token name.
        #[ink(message)]
        pub fn token_name(&self) -> String {
            String::from("Wrapped DOT")
        }

        /// Returns token symbol.
        #[ink(message)]
        pub fn token_symbol(&self) -> String {
            String::from("wDOT")
        }

        /// Returns 18 decimals (standard).
        #[ink(message)]
        pub fn token_decimals(&self) -> u8 {
            18
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
            let mut contract = MockWDOT::new();
            let accounts = ink::env::test::default_accounts::<ink::env::DefaultEnvironment>();

            // Mint 100 tokens
            let amount: Balance = 100 * 10u128.pow(18);
            assert!(contract.mint(accounts.alice, amount).is_ok());
            assert_eq!(contract.balance_of(accounts.alice), amount);
        }

        #[ink::test]
        fn metadata_correct() {
            let contract = MockWDOT::new();
            assert_eq!(contract.token_name(), "Wrapped DOT");
            assert_eq!(contract.token_symbol(), "wDOT");
            assert_eq!(contract.token_decimals(), 18);
        }

        #[ink::test]
        fn transfer_works() {
            let mut contract = MockWDOT::new();
            let accounts = ink::env::test::default_accounts::<ink::env::DefaultEnvironment>();

            let amount: Balance = 50 * 10u128.pow(18);
            contract.mint(accounts.alice, amount).unwrap();

            // Set caller to alice
            ink::env::test::set_caller::<ink::env::DefaultEnvironment>(accounts.alice);

            let transfer_amount = 20 * 10u128.pow(18);
            assert!(contract.transfer(accounts.bob, transfer_amount, vec![]).is_ok());
            assert_eq!(contract.balance_of(accounts.alice), amount - transfer_amount);
            assert_eq!(contract.balance_of(accounts.bob), transfer_amount);
        }
    }
}
