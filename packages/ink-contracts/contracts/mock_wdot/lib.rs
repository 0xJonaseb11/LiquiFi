#![cfg_attr(not(feature = "std"), no_std, no_main)]
#[ink::contract]
mod mock_wdot {
    use ink::prelude::string::String;
    use pendzl::contracts::psp22::*;
    #[ink(storage)]
    #[derive(Default, pendzl::traits::StorageFieldGetter)]
    pub struct MockWDOT {
        #[storage_field]
        psp22: PSP22Data,
        owner: AccountId,
    }
    impl PSP22 for MockWDOT {}
    impl MockWDOT {
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
            String::from("Wrapped DOT")
        }
        #[ink(message)]
        pub fn token_symbol(&self) -> String {
            String::from("wDOT")
        }
        #[ink(message)]
        pub fn token_decimals(&self) -> u8 {
            18
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
            let mut contract = MockWDOT::new();
            let accounts = ink::env::test::default_accounts::<ink::env::DefaultEnvironment>();
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
            ink::env::test::set_caller::<ink::env::DefaultEnvironment>(accounts.alice);
            let transfer_amount = 20 * 10u128.pow(18);
            assert!(contract
                .transfer(accounts.bob, transfer_amount, vec![])
                .is_ok());
            assert_eq!(
                contract.balance_of(accounts.alice),
                amount - transfer_amount
            );
            assert_eq!(contract.balance_of(accounts.bob), transfer_amount);
        }
    }
}
