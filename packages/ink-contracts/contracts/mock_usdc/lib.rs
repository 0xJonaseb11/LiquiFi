#![cfg_attr(not(feature = "std"), no_std, no_main)]
#[ink::contract]
mod mock_usdc {
    use ink::prelude::string::String;
    use pendzl::contracts::psp22::*;
    #[ink(storage)]
    #[derive(Default, pendzl::traits::StorageFieldGetter)]
    pub struct MockUSDC {
        #[storage_field]
        psp22: PSP22Data,
        owner: AccountId,
    }
    impl PSP22 for MockUSDC {}
    impl MockUSDC {
        #[ink(constructor)]
        pub fn new() -> Self {
            let caller = Self::env().caller();
            Self {
                psp22: PSP22Data::default(),
                owner: caller,
            }
        }
        #[ink(message)]
        pub fn mint(&mut self, to: AccountId, amount: Balance) -> Result<(), PSP22Error> {
            self.psp22._mint_to(&to, &amount)?;
            Ok(())
        }
        #[ink(message)]
        pub fn token_name(&self) -> String {
            String::from("USD Coin")
        }
        #[ink(message)]
        pub fn token_symbol(&self) -> String {
            String::from("USDC")
        }
        #[ink(message)]
        pub fn token_decimals(&self) -> u8 {
            6
        }
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
            let amount: Balance = 100_000 * 10u128.pow(6);
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
