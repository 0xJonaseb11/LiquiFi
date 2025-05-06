//! # XCMLiquidator — Cross-chain Liquidation via Polkadot XCM
//!
//! Equivalent to CrossChainLiquidator.sol.
//! Instead of LayerZero, this uses Polkadot's native XCM (Cross-Consensus Messaging)
//! to request liquidity from other parachains or the relay chain.

#![cfg_attr(not(feature = "std"), no_std, no_main)]

#[ink::contract]
mod xcm_liquidator {
    use ink::prelude::vec::Vec;
    use liquifi_traits::LiquiFiError;

    #[ink(event)]
    pub struct XcmRequestSent {
        #[ink(topic)] borrower: AccountId,
        amount: u128,
        #[ink(topic)] destination_para_id: u32,
    }

    #[ink(event)]
    pub struct XcmLiquidityReceived {
        #[ink(topic)] borrower: AccountId,
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

        /// Request funds from another parachain via XCM.
        /// In a real implementation, this would construct an XCM message and call the `pallet-xcm`.
        #[ink(message)]
        pub fn request_xcm_liquidation(
            &mut self,
            borrower: AccountId,
            amount: u128,
            para_id: u32,
        ) -> Result<(), LiquiFiError> {
            self.ensure_authorized()?;

            // Emit event to be picked up by off-chain bridge/relayer or processed by pallet-xcm
            self.env().emit_event(XcmRequestSent {
                borrower,
                amount,
                destination_para_id: para_id,
            });

            // Logic for actual XCM call would go here
            // e.g. pallet_xcm::send(...)

            Ok(())
        }

        /// Callback for when XCM message returns with liquidity.
        #[ink(message)]
        pub fn process_xcm_response(&mut self, borrower: AccountId, amount: u128) -> Result<(), LiquiFiError> {
            // Only specialized relayer or pallet-xcm can call this
            self.ensure_authorized()?;

            // Transfer liquidity to the lending pool and trigger liquidation
            // For now, we just emit an event to signal success
            self.env().emit_event(XcmLiquidityReceived {
                borrower,
                amount,
            });

            Ok(())
        }

        #[ink(message)]
        pub fn set_authorized(&mut self, account: AccountId, authorized: bool) -> Result<(), LiquiFiError> {
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
