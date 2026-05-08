#![cfg_attr(not(feature = "std"), no_std, no_main)]
#![allow(clippy::all)]
#[ink::contract]
#[allow(clippy::all)]
mod interest_rate_model {
    use liquifi_traits::LiquiFiError;
    const PRECISION: u128 = 1_000_000_000_000_000_000;
    const SECONDS_PER_YEAR: u128 = 31_557_600;
    #[ink(event)]
    pub struct RateParamsUpdated {
        base_rate: u128,
        slope1: u128,
        slope2: u128,
        optimal_utilization: u128,
    }
    #[ink(storage)]
    pub struct InterestRateModel {
        base_rate_per_year: u128,
        slope1: u128,
        slope2: u128,
        optimal_utilization: u128,
        reserve_factor: u128,
        owner: AccountId,
    }
    impl InterestRateModel {
        #[ink(constructor)]
        pub fn new(
            base_rate_per_year: u128,
            slope1: u128,
            slope2: u128,
            optimal_utilization: u128,
            reserve_factor: u128,
        ) -> Self {
            assert!(
                optimal_utilization > 0 && optimal_utilization <= PRECISION,
                "Invalid optimal utilization"
            );
            Self {
                base_rate_per_year,
                slope1,
                slope2,
                optimal_utilization,
                reserve_factor,
                owner: Self::env().caller(),
            }
        }
        #[ink(message)]
        pub fn get_utilization(&self, total_deposits: u128, total_borrows: u128) -> u128 {
            if total_deposits == 0 {
                return 0;
            }
            (total_borrows * PRECISION) / total_deposits
        }
        #[ink(message)]
        pub fn get_borrow_rate(&self, total_deposits: u128, total_borrows: u128) -> u128 {
            self.get_borrow_rate_per_second(total_deposits, total_borrows)
        }
        #[ink(message)]
        pub fn get_supply_rate(&self, total_deposits: u128, total_borrows: u128) -> u128 {
            let borrow_rate = self.get_borrow_rate_per_second(total_deposits, total_borrows);
            let utilization = self.get_utilization(total_deposits, total_borrows);
            (borrow_rate * utilization * (PRECISION.saturating_sub(self.reserve_factor)))
                / (PRECISION * PRECISION)
        }
        #[ink(message)]
        pub fn get_borrow_rate_apr(&self, total_deposits: u128, total_borrows: u128) -> u128 {
            self.get_borrow_rate_per_second(total_deposits, total_borrows) * SECONDS_PER_YEAR
        }
        #[ink(message)]
        pub fn get_params(&self) -> (u128, u128, u128, u128, u128) {
            (
                self.base_rate_per_year,
                self.slope1,
                self.slope2,
                self.optimal_utilization,
                self.reserve_factor,
            )
        }
        #[ink(message)]
        pub fn precision(&self) -> u128 {
            PRECISION
        }
        #[ink(message)]
        pub fn owner(&self) -> AccountId {
            self.owner
        }
        #[ink(message)]
        pub fn update_params(
            &mut self,
            base_rate_per_year: u128,
            slope1: u128,
            slope2: u128,
            optimal_utilization: u128,
        ) -> Result<(), LiquiFiError> {
            if self.env().caller() != self.owner {
                return Err(LiquiFiError::Unauthorized);
            }
            if optimal_utilization == 0 || optimal_utilization > PRECISION {
                return Err(LiquiFiError::InvalidOptimalUtilization);
            }
            self.base_rate_per_year = base_rate_per_year;
            self.slope1 = slope1;
            self.slope2 = slope2;
            self.optimal_utilization = optimal_utilization;
            self.env().emit_event(RateParamsUpdated {
                base_rate: base_rate_per_year,
                slope1,
                slope2,
                optimal_utilization,
            });
            Ok(())
        }
        fn get_borrow_rate_per_second(&self, total_deposits: u128, total_borrows: u128) -> u128 {
            let utilization = self.get_utilization(total_deposits, total_borrows);
            let annual_rate;
            if utilization <= self.optimal_utilization {
                annual_rate = self.base_rate_per_year
                    .saturating_add((utilization * self.slope1) / self.optimal_utilization);
            } else {
                let excess_utilization = utilization.saturating_sub(self.optimal_utilization);
                let remaining_utilization = PRECISION.saturating_sub(self.optimal_utilization);
                annual_rate = self.base_rate_per_year
                    .saturating_add(self.slope1)
                    .saturating_add((excess_utilization * self.slope2) / remaining_utilization);
            }
            annual_rate / SECONDS_PER_YEAR
        }
    }
    #[cfg(test)]
    mod tests {
        use super::*;
        fn default_model() -> InterestRateModel {
            InterestRateModel::new(
                20_000_000_000_000_000,
                100_000_000_000_000_000,
                1_000_000_000_000_000_000,
                800_000_000_000_000_000,
                100_000_000_000_000_000,
            )
        }
        #[ink::test]
        fn zero_utilization() {
            let model = default_model();
            let rate = model.get_borrow_rate(1000, 0);
            let expected = 20_000_000_000_000_000u128 / SECONDS_PER_YEAR;
            assert_eq!(rate, expected);
        }
        #[ink::test]
        fn utilization_at_optimal() {
            let model = default_model();
            let rate =
                model.get_borrow_rate(1_000_000_000_000_000_000_000, 800_000_000_000_000_000_000);
            assert!(rate > 0);
        }
        #[ink::test]
        fn utilization_above_optimal() {
            let model = default_model();
            let rate_90 = model.get_borrow_rate(1000 * PRECISION, 900 * PRECISION);
            let rate_50 = model.get_borrow_rate(1000 * PRECISION, 500 * PRECISION);
            assert!(rate_90 > rate_50);
        }
    }
}
