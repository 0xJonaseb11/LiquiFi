#![cfg_attr(not(feature = "std"), no_std, no_main)]
#![allow(clippy::all)]
#[ink::contract]
#[allow(clippy::all)]
mod lending_pool {
    use ink::prelude::vec::Vec;
    use ink::storage::Mapping;
    use liquifi_traits::{LiquiFiError, Position};
    const PRECISION: u128 = 1_000_000_000_000_000_000;
    const ORACLE_PRECISION: u128 = 100_000_000;
    const COLLATERAL_DECIMALS: u32 = 18;
    const DEBT_DECIMALS: u32 = 6;
    #[ink(event)]
    pub struct Deposit {
        #[ink(topic)]
        user: AccountId,
        amount: u128,
    }
    #[ink(event)]
    pub struct Withdraw {
        #[ink(topic)]
        user: AccountId,
        amount: u128,
    }
    #[ink(event)]
    pub struct Borrow {
        #[ink(topic)]
        user: AccountId,
        amount: u128,
    }
    #[ink(event)]
    pub struct Repay {
        #[ink(topic)]
        user: AccountId,
        amount: u128,
    }
    #[ink(event)]
    pub struct Liquidation {
        #[ink(topic)]
        liquidator: AccountId,
        #[ink(topic)]
        borrower: AccountId,
        debt_repaid: u128,
        collateral_seized: u128,
    }
    #[ink(event)]
    pub struct LtvUpdated {
        old_ltv: u128,
        new_ltv: u128,
    }
    #[ink(event)]
    pub struct LiquidationParamsUpdated {
        close_factor: u128,
        liquidation_incentive: u128,
    }
    #[ink(event)]
    pub struct OracleUpdated {
        old_oracle: AccountId,
        new_oracle: AccountId,
    }
    #[ink(event)]
    pub struct LiquidationThresholdUpdated {
        old_threshold: u128,
        new_threshold: u128,
    }
    #[ink(storage)]
    pub struct LendingPool {
        collateral_token: AccountId,
        debt_token: AccountId,
        oracle: AccountId,
        interest_rate_model: AccountId,
        ltv: u128,
        close_factor: u128,
        liquidation_incentive: u128,
        liquidation_threshold: u128,
        total_deposits: u128,
        total_borrows: u128,
        borrow_index: u128,
        last_accrual_timestamp: u64,
        positions: Mapping<AccountId, Position>,
        user_borrow_index: Mapping<AccountId, u128>,
        borrower_list: Vec<AccountId>,
        is_borrower: Mapping<AccountId, bool>,
        owner: AccountId,
        paused: bool,
    }
    impl LendingPool {
        #[ink(constructor)]
        pub fn new(
            collateral_token: AccountId,
            debt_token: AccountId,
            oracle: AccountId,
            interest_rate_model: AccountId,
            ltv: u128,
            close_factor: u128,
            liquidation_incentive: u128,
        ) -> Self {
            assert!(ltv > 0 && ltv <= PRECISION, "Invalid LTV");
            assert!(
                close_factor > 0 && close_factor <= PRECISION,
                "Invalid close factor"
            );
            assert!(liquidation_incentive <= PRECISION, "Invalid incentive");
            Self {
                collateral_token,
                debt_token,
                oracle,
                interest_rate_model,
                ltv,
                close_factor,
                liquidation_incentive,
                liquidation_threshold: PRECISION,
                total_deposits: 0,
                total_borrows: 0,
                borrow_index: PRECISION,
                last_accrual_timestamp: Self::env().block_timestamp(),
                positions: Mapping::default(),
                user_borrow_index: Mapping::default(),
                borrower_list: Vec::new(),
                is_borrower: Mapping::default(),
                owner: Self::env().caller(),
                paused: false,
            }
        }
        #[ink(message)]
        pub fn deposit(&mut self, amount: u128) -> Result<(), LiquiFiError> {
            self.ensure_not_paused()?;
            if amount == 0 {
                return Err(LiquiFiError::ZeroAmount);
            }
            self.accrue_interest();
            let caller = self.env().caller();
            self.psp22_transfer_from(
                self.collateral_token,
                caller,
                self.env().account_id(),
                amount,
            )?;
            let mut pos = self.positions.get(caller).unwrap_or_default();
            pos.collateral_amount = pos.collateral_amount.saturating_add(amount);
            self.positions.insert(caller, &pos);
            self.total_deposits = self.total_deposits.saturating_add(amount);
            self.env().emit_event(Deposit {
                user: caller,
                amount,
            });
            Ok(())
        }
        #[ink(message)]
        pub fn withdraw(&mut self, amount: u128) -> Result<(), LiquiFiError> {
            self.ensure_not_paused()?;
            if amount == 0 {
                return Err(LiquiFiError::ZeroAmount);
            }
            let caller = self.env().caller();
            self.accrue_interest();
            self.apply_user_interest(caller);
            let mut pos = self.positions.get(caller).unwrap_or_default();
            if pos.collateral_amount < amount {
                return Err(LiquiFiError::InsufficientCollateral);
            }
            let remaining = pos.collateral_amount.saturating_sub(amount);
            if pos.debt_amount > 0 {
                let max_borrow = self.calculate_max_borrow(remaining);
                let current_debt = self.debt_in_usd(pos.debt_amount);
                if current_debt > max_borrow {
                    return Err(LiquiFiError::WithdrawWouldBreachLtv);
                }
            }
            pos.collateral_amount = remaining;
            self.positions.insert(caller, &pos);
            self.total_deposits = self.total_deposits.saturating_sub(amount);
            self.psp22_transfer(self.collateral_token, caller, amount)?;
            self.env().emit_event(Withdraw {
                user: caller,
                amount,
            });
            Ok(())
        }
        #[ink(message)]
        pub fn borrow(&mut self, amount: u128) -> Result<(), LiquiFiError> {
            self.ensure_not_paused()?;
            if amount == 0 {
                return Err(LiquiFiError::ZeroAmount);
            }
            let caller = self.env().caller();
            self.accrue_interest();
            self.apply_user_interest(caller);
            let mut pos = self.positions.get(caller).unwrap_or_default();
            let normalized = self.normalize_debt(amount);
            let new_debt = pos.debt_amount.saturating_add(normalized);
            let max_borrow = self.calculate_max_borrow(pos.collateral_amount);
            let new_debt_usd = self.debt_in_usd(new_debt);
            if new_debt_usd > max_borrow {
                return Err(LiquiFiError::BorrowExceedsLtv);
            }
            let pool_balance = self.psp22_balance_of(self.debt_token, self.env().account_id());
            if pool_balance < amount {
                return Err(LiquiFiError::InsufficientPoolLiquidity);
            }
            pos.debt_amount = new_debt;
            pos.last_update_timestamp = self.env().block_timestamp();
            self.positions.insert(caller, &pos);
            self.total_borrows = self.total_borrows.saturating_add(normalized);
            if !self.is_borrower.get(caller).unwrap_or(false) {
                self.is_borrower.insert(caller, &true);
                self.borrower_list.push(caller);
            }
            self.user_borrow_index.insert(caller, &self.borrow_index);
            self.psp22_transfer(self.debt_token, caller, amount)?;
            self.env().emit_event(Borrow {
                user: caller,
                amount,
            });
            Ok(())
        }
        #[ink(message)]
        pub fn repay(&mut self, amount: u128) -> Result<(), LiquiFiError> {
            self.ensure_not_paused()?;
            if amount == 0 {
                return Err(LiquiFiError::ZeroAmount);
            }
            let caller = self.env().caller();
            self.accrue_interest();
            self.apply_user_interest(caller);
            let mut pos = self.positions.get(caller).unwrap_or_default();
            let mut normalized = self.normalize_debt(amount);
            let mut actual_amount = amount;
            if normalized > pos.debt_amount {
                normalized = pos.debt_amount;
                actual_amount = self.denormalize_debt(normalized);
            }
            pos.debt_amount = pos.debt_amount.saturating_sub(normalized);
            self.positions.insert(caller, &pos);
            self.total_borrows = self.total_borrows.saturating_sub(normalized);
            self.user_borrow_index.insert(caller, &self.borrow_index);
            self.psp22_transfer_from(
                self.debt_token,
                caller,
                self.env().account_id(),
                actual_amount,
            )?;
            self.env().emit_event(Repay {
                user: caller,
                amount: actual_amount,
            });
            Ok(())
        }
        #[ink(message)]
        pub fn liquidate(
            &mut self,
            borrower: AccountId,
            repay_amount: u128,
        ) -> Result<(), LiquiFiError> {
            self.ensure_not_paused()?;
            if repay_amount == 0 {
                return Err(LiquiFiError::ZeroAmount);
            }
            let caller = self.env().caller();
            if borrower == caller {
                return Err(LiquiFiError::SelfLiquidation);
            }
            self.accrue_interest();
            self.apply_user_interest(borrower);
            let mut pos = self.positions.get(borrower).unwrap_or_default();
            let hf = self.calculate_health_factor(&pos);
            if hf >= self.liquidation_threshold {
                return Err(LiquiFiError::PositionHealthy);
            }
            let normalized_repay = self.normalize_debt(repay_amount);
            let max_repay = (pos.debt_amount.saturating_mul(self.close_factor)) / PRECISION;
            if normalized_repay > max_repay {
                return Err(LiquiFiError::ExceedsCloseFactor);
            }
            let debt_price = self.get_oracle_price(self.debt_token);
            let collateral_price = self.get_oracle_price(self.collateral_token);
            let repay_value_usd =
                (normalized_repay.saturating_mul(debt_price)) / (10u128.pow(COLLATERAL_DECIMALS));
            let seize_value_usd =
                (repay_value_usd.saturating_mul(PRECISION.saturating_add(self.liquidation_incentive))) / PRECISION;
            let mut collateral_seized =
                (seize_value_usd.saturating_mul(10u128.pow(COLLATERAL_DECIMALS))) / collateral_price;
            if collateral_seized > pos.collateral_amount {
                collateral_seized = pos.collateral_amount;
            }
            pos.debt_amount = pos.debt_amount.saturating_sub(normalized_repay);
            pos.collateral_amount = pos.collateral_amount.saturating_sub(collateral_seized);
            self.positions.insert(borrower, &pos);
            self.total_borrows = self.total_borrows.saturating_sub(normalized_repay);
            self.total_deposits = self.total_deposits.saturating_sub(collateral_seized);
            self.psp22_transfer_from(
                self.debt_token,
                caller,
                self.env().account_id(),
                repay_amount,
            )?;
            self.psp22_transfer(self.collateral_token, caller, collateral_seized)?;
            self.env().emit_event(Liquidation {
                liquidator: caller,
                borrower,
                debt_repaid: repay_amount,
                collateral_seized,
            });
            Ok(())
        }
        #[ink(message)]
        pub fn get_health_factor(&self, user: AccountId) -> u128 {
            let pos = self.positions.get(user).unwrap_or_default();
            self.calculate_health_factor(&pos)
        }
        #[ink(message)]
        pub fn get_position(&self, user: AccountId) -> Position {
            self.positions.get(user).unwrap_or_default()
        }
        #[ink(message)]
        pub fn get_total_deposits(&self) -> u128 {
            self.total_deposits
        }
        #[ink(message)]
        pub fn get_total_borrows(&self) -> u128 {
            self.total_borrows
        }
        #[ink(message)]
        pub fn get_utilization_rate(&self) -> u128 {
            if self.total_deposits == 0 {
                return 0;
            }
            (self.total_borrows.saturating_mul(PRECISION)) / self.total_deposits
        }
        #[ink(message)]
        pub fn get_borrow_rate(&self) -> u128 {
            self.query_borrow_rate()
        }
        #[ink(message)]
        pub fn get_borrower_count(&self) -> u32 {
            self.borrower_list.len() as u32
        }
        #[ink(message)]
        pub fn get_borrower_at(&self, index: u32) -> AccountId {
            self.borrower_list[index as usize]
        }
        #[ink(message)]
        pub fn get_borrow_index(&self) -> u128 {
            self.borrow_index
        }
        #[ink(message)]
        pub fn get_max_borrow(&self, user: AccountId) -> u128 {
            let pos = self.positions.get(user).unwrap_or_default();
            let max_borrow_usd = self.calculate_max_borrow(pos.collateral_amount);
            let current_usd = self.debt_in_usd(pos.debt_amount);
            if current_usd >= max_borrow_usd {
                return 0;
            }
            let remaining = max_borrow_usd.saturating_sub(current_usd);
            let debt_price = self.get_oracle_price(self.debt_token);
            (remaining.saturating_mul(10u128.pow(DEBT_DECIMALS))) / debt_price
        }
        #[ink(message)]
        pub fn get_liquidation_threshold(&self) -> u128 {
            self.liquidation_threshold
        }
        #[ink(message)]
        pub fn paused(&self) -> bool {
            self.paused
        }
        #[ink(message)]
        pub fn owner(&self) -> AccountId {
            self.owner
        }
        #[ink(message)]
        pub fn ltv(&self) -> u128 {
            self.ltv
        }
        #[ink(message)]
        pub fn close_factor(&self) -> u128 {
            self.close_factor
        }
        #[ink(message)]
        pub fn liquidation_incentive(&self) -> u128 {
            self.liquidation_incentive
        }
        #[ink(message)]
        pub fn oracle(&self) -> AccountId {
            self.oracle
        }
        #[ink(message)]
        pub fn set_ltv(&mut self, new_ltv: u128) -> Result<(), LiquiFiError> {
            self.ensure_owner()?;
            if new_ltv == 0 || new_ltv > PRECISION {
                return Err(LiquiFiError::InvalidLtv);
            }
            let old = self.ltv;
            self.ltv = new_ltv;
            self.env().emit_event(LtvUpdated {
                old_ltv: old,
                new_ltv,
            });
            Ok(())
        }
        #[ink(message)]
        pub fn set_liquidation_params(&mut self, cf: u128, li: u128) -> Result<(), LiquiFiError> {
            self.ensure_owner()?;
            if cf == 0 || cf > PRECISION {
                return Err(LiquiFiError::InvalidCloseFactor);
            }
            if li > PRECISION {
                return Err(LiquiFiError::InvalidLiquidationIncentive);
            }
            self.close_factor = cf;
            self.liquidation_incentive = li;
            self.env().emit_event(LiquidationParamsUpdated {
                close_factor: cf,
                liquidation_incentive: li,
            });
            Ok(())
        }
        #[ink(message)]
        pub fn set_oracle(&mut self, new_oracle: AccountId) -> Result<(), LiquiFiError> {
            self.ensure_owner()?;
            let old = self.oracle;
            self.oracle = new_oracle;
            self.env().emit_event(OracleUpdated {
                old_oracle: old,
                new_oracle,
            });
            Ok(())
        }
        #[ink(message)]
        pub fn set_liquidation_threshold(&mut self, t: u128) -> Result<(), LiquiFiError> {
            self.ensure_owner()?;
            if t < PRECISION {
                return Err(LiquiFiError::InvalidLtv);
            }
            let old = self.liquidation_threshold;
            self.liquidation_threshold = t;
            self.env().emit_event(LiquidationThresholdUpdated {
                old_threshold: old,
                new_threshold: t,
            });
            Ok(())
        }
        #[ink(message)]
        pub fn pause(&mut self) -> Result<(), LiquiFiError> {
            self.ensure_owner()?;
            self.paused = true;
            Ok(())
        }
        #[ink(message)]
        pub fn unpause(&mut self) -> Result<(), LiquiFiError> {
            self.ensure_owner()?;
            self.paused = false;
            Ok(())
        }
        #[ink(message)]
        pub fn seed_liquidity(&mut self, amount: u128) -> Result<(), LiquiFiError> {
            self.ensure_owner()?;
            let caller = self.env().caller();
            self.psp22_transfer_from(self.debt_token, caller, self.env().account_id(), amount)?;
            Ok(())
        }
        fn accrue_interest(&mut self) {
            let now = self.env().block_timestamp();
            let elapsed = now.saturating_sub(self.last_accrual_timestamp);
            if elapsed == 0 {
                return;
            }
            if self.total_borrows > 0 {
                let borrow_rate = self.query_borrow_rate();
                let elapsed_sec = (elapsed / 1000) as u128;
                let interest_factor = borrow_rate.saturating_multiply_ratio(elapsed_sec, PRECISION);
                self.borrow_index = self.borrow_index.saturating_add((self.borrow_index.saturating_mul(interest_factor)) / PRECISION);
            }
            self.last_accrual_timestamp = now;
        }
        fn apply_user_interest(&mut self, user: AccountId) {
            let mut pos = self.positions.get(user).unwrap_or_default();
            if pos.debt_amount == 0 {
                return;
            }
            let user_idx = self.user_borrow_index.get(user).unwrap_or(0);
            if user_idx == 0 {
                self.user_borrow_index.insert(user, &self.borrow_index);
                return;
            }
            let old_debt = pos.debt_amount;
            pos.debt_amount = (pos.debt_amount.saturating_mul(self.borrow_index)) / user_idx;
            self.total_borrows = self.total_borrows.saturating_add(pos.debt_amount).saturating_sub(old_debt);
            self.positions.insert(user, &pos);
            self.user_borrow_index.insert(user, &self.borrow_index);
        }
        fn calculate_health_factor(&self, pos: &Position) -> u128 {
            if pos.debt_amount == 0 {
                return u128::MAX;
            }
            let cp = self.get_oracle_price(self.collateral_token);
            let dp = self.get_oracle_price(self.debt_token);
            let col_usd = (pos.collateral_amount.saturating_mul(cp)) / (10u128.pow(COLLATERAL_DECIMALS));
            let adj = (col_usd.saturating_mul(self.ltv)) / PRECISION;
            let debt_usd = (pos.debt_amount.saturating_mul(dp)) / (10u128.pow(COLLATERAL_DECIMALS));
            if debt_usd == 0 {
                return u128::MAX;
            }
            (adj.saturating_mul(PRECISION)) / debt_usd
        }
        fn calculate_max_borrow(&self, collateral: u128) -> u128 {
            let cp = self.get_oracle_price(self.collateral_token);
            let col_usd = (collateral.saturating_mul(cp)) / (10u128.pow(COLLATERAL_DECIMALS));
            (col_usd.saturating_mul(self.ltv)) / PRECISION
        }
        fn debt_in_usd(&self, debt: u128) -> u128 {
            let dp = self.get_oracle_price(self.debt_token);
            (debt.saturating_mul(dp)) / (10u128.pow(COLLATERAL_DECIMALS))
        }
        fn normalize_debt(&self, amount: u128) -> u128 {
            amount.saturating_mul(10u128.pow(COLLATERAL_DECIMALS - DEBT_DECIMALS))
        }
        fn denormalize_debt(&self, amount: u128) -> u128 {
            amount / (10u128.pow(COLLATERAL_DECIMALS - DEBT_DECIMALS))
        }
        fn ensure_owner(&self) -> Result<(), LiquiFiError> {
            if self.env().caller() != self.owner {
                return Err(LiquiFiError::Unauthorized);
            }
            Ok(())
        }
        fn ensure_not_paused(&self) -> Result<(), LiquiFiError> {
            if self.paused {
                return Err(LiquiFiError::Unauthorized);
            }
            Ok(())
        }
        fn get_oracle_price(&self, asset: AccountId) -> u128 {
            use ink::env::call::{build_call, ExecutionInput, Selector};
            let result = build_call::<ink::env::DefaultEnvironment>()
                .call(self.oracle)
                .exec_input(
                    ExecutionInput::new(Selector::new(ink::selector_bytes!("get_price")))
                        .push_arg(asset),
                )
                .returns::<Result<u128, LiquiFiError>>()
                .invoke();
            result.unwrap_or(0)
        }
        fn query_borrow_rate(&self) -> u128 {
            use ink::env::call::{build_call, ExecutionInput, Selector};
            build_call::<ink::env::DefaultEnvironment>()
                .call(self.interest_rate_model)
                .exec_input(
                    ExecutionInput::new(Selector::new(ink::selector_bytes!("get_borrow_rate")))
                        .push_arg(self.total_deposits)
                        .push_arg(self.total_borrows),
                )
                .returns::<u128>()
                .invoke()
        }
        fn psp22_transfer(
            &self,
            token: AccountId,
            to: AccountId,
            amount: u128,
        ) -> Result<(), LiquiFiError> {
            use ink::env::call::{build_call, ExecutionInput, Selector};
            let data: Vec<u8> = Vec::new();
            build_call::<ink::env::DefaultEnvironment>()
                .call(token)
                .exec_input(
                    ExecutionInput::new(Selector::new(ink::selector_bytes!("PSP22::transfer")))
                        .push_arg(to)
                        .push_arg(amount)
                        .push_arg(data),
                )
                .returns::<Result<(), ink::primitives::LangError>>()
                .invoke()
                .map_err(|_| {
                    LiquiFiError::Psp22Error(liquifi_traits::Psp22ErrorKind::InsufficientBalance)
                })
        }
        fn psp22_transfer_from(
            &self,
            token: AccountId,
            from: AccountId,
            to: AccountId,
            amount: u128,
        ) -> Result<(), LiquiFiError> {
            use ink::env::call::{build_call, ExecutionInput, Selector};
            let data: Vec<u8> = Vec::new();
            build_call::<ink::env::DefaultEnvironment>()
                .call(token)
                .exec_input(
                    ExecutionInput::new(Selector::new(ink::selector_bytes!(
                        "PSP22::transfer_from"
                    )))
                    .push_arg(from)
                    .push_arg(to)
                    .push_arg(amount)
                    .push_arg(data),
                )
                .returns::<Result<(), ink::primitives::LangError>>()
                .invoke()
                .map_err(|_| {
                    LiquiFiError::Psp22Error(liquifi_traits::Psp22ErrorKind::InsufficientAllowance)
                })
        }
        fn psp22_balance_of(&self, token: AccountId, account: AccountId) -> u128 {
            use ink::env::call::{build_call, ExecutionInput, Selector};
            build_call::<ink::env::DefaultEnvironment>()
                .call(token)
                .exec_input(
                    ExecutionInput::new(Selector::new(ink::selector_bytes!("PSP22::balance_of")))
                        .push_arg(account),
                )
                .returns::<u128>()
                .invoke()
        }
    }
}
