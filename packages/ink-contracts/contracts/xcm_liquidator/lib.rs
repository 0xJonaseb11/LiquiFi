#![cfg_attr(not(feature = "std"), no_std, no_main)]
#![allow(clippy::all)]
#[ink::contract]
#[allow(clippy::all)]
mod xcm_liquidator {
    use ink::prelude::vec::Vec;
    use liquifi_traits::LiquiFiError;
    #[ink(event)]
    pub struct XcmRequestSent {
        #[ink(topic)]
        borrower: AccountId,
        amount: u128,
        #[ink(topic)]
        destination_para_id: u32,
    }
    #[ink(event)]
    pub struct XcmLiquidityReceived {
        #[ink(topic)]
        borrower: AccountId,
        amount: u128,
    }
    #[ink(storage)]
    pub struct XCMLiquidator {
        lending_pool: AccountId,
        owner: AccountId,
        is_authorized: ink::storage::Mapping<AccountId, bool>,
    }
    impl XCMLiquidator {
        #[ink(constructor)]
        pub fn new(lending_pool: AccountId) -> Self {
            let caller = Self::env().caller();
            let mut is_authorized = ink::storage::Mapping::default();
            is_authorized.insert(caller, &true);
            Self {
                lending_pool,
                owner: caller,
                is_authorized,
            }
        }
        #[ink(message)]
        pub fn request_xcm_liquidation(
            &mut self,
            borrower: AccountId,
            amount: u128,
            para_id: u32,
        ) -> Result<(), LiquiFiError> {
            self.ensure_authorized()?;
            self.env().emit_event(XcmRequestSent {
                borrower,
                amount,
                destination_para_id: para_id,
            });
            Ok(())
        }
        #[ink(message)]
        pub fn process_xcm_response(
            &mut self,
            borrower: AccountId,
            amount: u128,
        ) -> Result<(), LiquiFiError> {
            self.ensure_authorized()?;
            self.env()
                .emit_event(XcmLiquidityReceived { borrower, amount });
            Ok(())
        }
        #[ink(message)]
        pub fn set_authorized(
            &mut self,
            account: AccountId,
            authorized: bool,
        ) -> Result<(), LiquiFiError> {
            self.ensure_owner()?;
            self.is_authorized.insert(account, &authorized);
            Ok(())
        }
        fn ensure_owner(&self) -> Result<(), LiquiFiError> {
            if self.env().caller() != self.owner {
                return Err(LiquiFiError::Unauthorized);
            }
            Ok(())
        }
        fn ensure_authorized(&self) -> Result<(), LiquiFiError> {
            if !self.is_authorized.get(self.env().caller()).unwrap_or(false) {
                return Err(LiquiFiError::Unauthorized);
            }
            Ok(())
        }
    }
}
