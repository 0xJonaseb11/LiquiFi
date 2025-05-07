#![cfg_attr(not(feature = "std"), no_std, no_main)]
#[ink::contract]
mod price_oracle {
    use ink::storage::Mapping;
    use liquifi_traits::LiquiFiError;
    const PRICE_PRECISION: u128 = 100_000_000;
    const MAX_PRICE_AGE_MS: u64 = 3_600_000;
    #[ink(event)]
    pub struct PriceSet {
        #[ink(topic)]
        asset: AccountId,
        price: u128,
        timestamp: u64,
    }
    #[ink(storage)]
    pub struct PriceOracle {
        prices: Mapping<AccountId, u128>,
        updated_at: Mapping<AccountId, u64>,
        owner: AccountId,
    }
    impl PriceOracle {
        #[ink(constructor)]
        pub fn new() -> Self {
            Self {
                prices: Mapping::default(),
                updated_at: Mapping::default(),
                owner: Self::env().caller(),
            }
        }
        #[ink(message)]
        pub fn set_price(&mut self, asset: AccountId, price: u128) -> Result<(), LiquiFiError> {
            self.ensure_owner()?;
            if price == 0 {
                return Err(LiquiFiError::ZeroPrice);
            }
            let now = self.env().block_timestamp();
            self.prices.insert(asset, &price);
            self.updated_at.insert(asset, &now);
            self.env().emit_event(PriceSet {
                asset,
                price,
                timestamp: now,
            });
            Ok(())
        }
        #[ink(message)]
        pub fn set_prices(
            &mut self,
            assets: ink::prelude::vec::Vec<AccountId>,
            prices: ink::prelude::vec::Vec<u128>,
        ) -> Result<(), LiquiFiError> {
            self.ensure_owner()?;
            let now = self.env().block_timestamp();
            for i in 0..assets.len() {
                if prices[i] == 0 {
                    return Err(LiquiFiError::ZeroPrice);
                }
                self.prices.insert(assets[i], &prices[i]);
                self.updated_at.insert(assets[i], &now);
                self.env().emit_event(PriceSet {
                    asset: assets[i],
                    price: prices[i],
                    timestamp: now,
                });
            }
            Ok(())
        }
        #[ink(message)]
        pub fn get_price(&self, asset: AccountId) -> Result<u128, LiquiFiError> {
            self.prices.get(asset).ok_or(LiquiFiError::PriceNotSet)
        }
        #[ink(message)]
        pub fn get_price_with_timestamp(
            &self,
            asset: AccountId,
        ) -> Result<(u128, u64), LiquiFiError> {
            let price = self.prices.get(asset).ok_or(LiquiFiError::PriceNotSet)?;
            let updated_at = self.updated_at.get(asset).unwrap_or(0);
            Ok((price, updated_at))
        }
        #[ink(message)]
        pub fn is_price_fresh(&self, asset: AccountId) -> bool {
            if let Some(updated_at) = self.updated_at.get(asset) {
                updated_at + MAX_PRICE_AGE_MS >= self.env().block_timestamp()
            } else {
                false
            }
        }
        #[ink(message)]
        pub fn price_precision(&self) -> u128 {
            PRICE_PRECISION
        }
        #[ink(message)]
        pub fn owner(&self) -> AccountId {
            self.owner
        }
        #[ink(message)]
        pub fn transfer_ownership(&mut self, new_owner: AccountId) -> Result<(), LiquiFiError> {
            self.ensure_owner()?;
            self.owner = new_owner;
            Ok(())
        }
        fn ensure_owner(&self) -> Result<(), LiquiFiError> {
            if self.env().caller() != self.owner {
                return Err(LiquiFiError::Unauthorized);
            }
            Ok(())
        }
    }
    #[cfg(test)]
    mod tests {
        use super::*;
        #[ink::test]
        fn set_and_get_price() {
            let mut oracle = PriceOracle::new();
            let accounts = ink::env::test::default_accounts::<ink::env::DefaultEnvironment>();
            let asset = accounts.bob;
            let price: u128 = 2000_00000000;
            assert!(oracle.set_price(asset, price).is_ok());
            assert_eq!(oracle.get_price(asset), Ok(price));
        }
        #[ink::test]
        fn price_not_set_returns_error() {
            let oracle = PriceOracle::new();
            let accounts = ink::env::test::default_accounts::<ink::env::DefaultEnvironment>();
            assert_eq!(
                oracle.get_price(accounts.bob),
                Err(LiquiFiError::PriceNotSet)
            );
        }
        #[ink::test]
        fn zero_price_rejected() {
            let mut oracle = PriceOracle::new();
            let accounts = ink::env::test::default_accounts::<ink::env::DefaultEnvironment>();
            assert_eq!(
                oracle.set_price(accounts.bob, 0),
                Err(LiquiFiError::ZeroPrice)
            );
        }
    }
}
