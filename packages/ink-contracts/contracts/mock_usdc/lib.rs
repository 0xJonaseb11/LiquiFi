#![cfg_attr(not(feature = "std"), no_std, no_main)]

#[ink::contract]
mod mock_usdc {
    use ink::prelude::string::String;
    use ink::prelude::vec::Vec;
    use ink::storage::Mapping;

    #[ink(storage)]
    pub struct MockUSDC {
        total_supply: Balance,
        balances: Mapping<AccountId, Balance>,
        allowances: Mapping<(AccountId, AccountId), Balance>,
    }

    #[ink(event)]
    pub struct Transfer {
        #[ink(topic)]
        from: Option<AccountId>,
        #[ink(topic)]
        to: Option<AccountId>,
        value: Balance,
    }

    #[ink(event)]
    pub struct Approval {
        #[ink(topic)]
        owner: AccountId,
        #[ink(topic)]
        spender: AccountId,
        value: Balance,
    }

    impl MockUSDC {
        #[ink(constructor)]
        pub fn new() -> Self {
            Self {
                total_supply: 0,
                balances: Mapping::default(),
                allowances: Mapping::default(),
            }
        }

        #[ink(message)]
        pub fn mint(&mut self, to: AccountId, amount: Balance) -> Result<(), ()> {
            let current_balance = self.balances.get(to).unwrap_or(0);
            self.balances.insert(to, &(current_balance + amount));
            self.total_supply += amount;
            self.env().emit_event(Transfer {
                from: None,
                to: Some(to),
                value: amount,
            });
            Ok(())
        }

        #[ink(message)]
        pub fn total_supply(&self) -> Balance {
            self.total_supply
        }

        #[ink(message)]
        pub fn balance_of(&self) -> Balance {
            self.balances.get(self.env().caller()).unwrap_or(0)
        }

        #[ink(message)]
        pub fn balance_of_account(&self, account: AccountId) -> Balance {
            self.balances.get(account).unwrap_or(0)
        }

        #[ink(message)]
        pub fn transfer(&mut self, to: AccountId, value: Balance, _data: Vec<u8>) -> Result<(), ()> {
            let from = self.env().caller();
            self.internal_transfer(from, to, value)
        }

        #[ink(message)]
        pub fn transfer_from(&mut self, from: AccountId, to: AccountId, value: Balance, _data: Vec<u8>) -> Result<(), ()> {
            let caller = self.env().caller();
            let allowance = self.allowances.get((from, caller)).unwrap_or(0);
            if allowance < value {
                return Err(());
            }
            self.allowances.insert((from, caller), &(allowance - value));
            self.internal_transfer(from, to, value)
        }

        #[ink(message)]
        pub fn approve(&mut self, spender: AccountId, value: Balance) -> Result<(), ()> {
            let owner = self.env().caller();
            self.allowances.insert((owner, spender), &value);
            self.env().emit_event(Approval {
                owner,
                spender,
                value,
            });
            Ok(())
        }

        #[ink(message)]
        pub fn allowance(&self, owner: AccountId, spender: AccountId) -> Balance {
            self.allowances.get((owner, spender)).unwrap_or(0)
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

        fn internal_transfer(&mut self, from: AccountId, to: AccountId, value: Balance) -> Result<(), ()> {
            let from_balance = self.balances.get(from).unwrap_or(0);
            if from_balance < value {
                return Err(());
            }
            self.balances.insert(from, &(from_balance - value));
            let to_balance = self.balances.get(to).unwrap_or(0);
            self.balances.insert(to, &(to_balance + value));
            self.env().emit_event(Transfer {
                from: Some(from),
                to: Some(to),
                value,
            });
            Ok(())
        }
    }
}
