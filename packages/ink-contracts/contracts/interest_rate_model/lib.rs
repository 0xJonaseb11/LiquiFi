//! # InterestRateModel — Utilization-Based Jump Rate Model
//!
//! Equivalent to InterestRateModel.sol — follows the Compound/Aave pattern:
//! - Below optimal utilization: gentle linear slope (slope1)
//! - Above optimal utilization: steep linear slope (slope2) to incentivize deposits
//!
//! All rates use 1e18 precision internally.

#![cfg_attr(not(feature = "std"), no_std, no_main)]

#[ink::contract]
mod interest_rate_model {
    use liquifi_traits::LiquiFiError;

    /// Precision for rate calculations (100% = 1e18).
    const PRECISION: u128 = 1_000_000_000_000_000_000; // 1e18

    /// Seconds per year for APR → per-second conversion.
    const SECONDS_PER_YEAR: u128 = 31_557_600; // 365.25 days

    // ──────────────────────────────────────────────
    //  Events
    // ──────────────────────────────────────────────

    #[ink(event)]
    pub struct RateParamsUpdated {
        base_rate: u128,
        slope1: u128,
        slope2: u128,
        optimal_utilization: u128,
    }

    // ──────────────────────────────────────────────
    //  Storage
    // ──────────────────────────────────────────────

    #[ink(storage)]
    pub struct InterestRateModel {
        /// Base borrow rate per year (e.g., 2% = 0.02e18).
        base_rate_per_year: u128,
        /// Slope below optimal utilization.
        slope1: u128,
        /// Slope above optimal utilization (steep).
        slope2: u128,
        /// Optimal utilization rate (e.g., 80% = 0.80e18).
        optimal_utilization: u128,
        /// Reserve factor — portion of interest as protocol revenue.
        reserve_factor: u128,
        /// Contract owner.
        owner: AccountId,
    }

    impl InterestRateModel {
        /// Initialize the interest rate model.
        ///
        /// # Parameters
        /// - `base_rate_per_year`: Annual base rate (1e18 = 100%)
        /// - `slope1`: Rate slope below optimal utilization
        /// - `slope2`: Rate slope above optimal utilization (steep)
        /// - `optimal_utilization`: The kink point (e.g., 0.8e18 = 80%)
        /// - `reserve_factor`: Fraction of interest for protocol
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

        // ──────────────────────────────────────────────
        //  View Functions
        // ──────────────────────────────────────────────

        /// Get the current utilization rate.
        #[ink(message)]
        pub fn get_utilization(&self, total_deposits: u128, total_borrows: u128) -> u128 {
            if total_deposits == 0 {
                return 0;
            }
            (total_borrows * PRECISION) / total_deposits
        }

        /// Get the borrow rate per second (scaled by 1e18).
        #[ink(message)]
        pub fn get_borrow_rate(&self, total_deposits: u128, total_borrows: u128) -> u128 {
            self.get_borrow_rate_per_second(total_deposits, total_borrows)
        }

        /// Get the supply rate per second.
        #[ink(message)]
        pub fn get_supply_rate(&self, total_deposits: u128, total_borrows: u128) -> u128 {
            let borrow_rate = self.get_borrow_rate_per_second(total_deposits, total_borrows);
            let utilization = self.get_utilization(total_deposits, total_borrows);

            // Supply rate = borrow rate * utilization * (1 - reserveFactor)
            (borrow_rate * utilization * (PRECISION - self.reserve_factor))
                / (PRECISION * PRECISION)
        }

        /// Get the annualized borrow rate for display.
        #[ink(message)]
        pub fn get_borrow_rate_apr(&self, total_deposits: u128, total_borrows: u128) -> u128 {
            self.get_borrow_rate_per_second(total_deposits, total_borrows) * SECONDS_PER_YEAR
        }

        /// Get current parameters.
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

        /// Get precision constant.
        #[ink(message)]
        pub fn precision(&self) -> u128 {
            PRECISION
        }

        /// Get contract owner.
        #[ink(message)]
        pub fn owner(&self) -> AccountId {
            self.owner
        }

        // ──────────────────────────────────────────────
        //  Admin Functions
        // ──────────────────────────────────────────────

        /// Update rate model parameters.
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

        // ──────────────────────────────────────────────
        //  Internal
        // ──────────────────────────────────────────────

        /// Core rate calculation: jump rate model.
        fn get_borrow_rate_per_second(
            &self,
            total_deposits: u128,
            total_borrows: u128,
        ) -> u128 {
            let utilization = self.get_utilization(total_deposits, total_borrows);
            let annual_rate;

            if utilization <= self.optimal_utilization {
                // Linear ramp: base + proportional slope1
                annual_rate = self.base_rate_per_year
                    + (utilization * self.slope1) / self.optimal_utilization;
            } else {
                // Above kink: base + full slope1 + excess * slope2
                let excess_utilization = utilization - self.optimal_utilization;
                let remaining_utilization = PRECISION - self.optimal_utilization;
                annual_rate = self.base_rate_per_year
                    + self.slope1
                    + (excess_utilization * self.slope2) / remaining_utilization;
            }

            // Convert annual rate to per-second rate
            annual_rate / SECONDS_PER_YEAR
        }
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        fn default_model() -> InterestRateModel {
            InterestRateModel::new(
                20_000_000_000_000_000,      // 2% base rate
                100_000_000_000_000_000,     // 10% slope1
                1_000_000_000_000_000_000,   // 100% slope2
                800_000_000_000_000_000,     // 80% optimal
                100_000_000_000_000_000,     // 10% reserve
            )
        }

        #[ink::test]
        fn zero_utilization() {
            let model = default_model();
            let rate = model.get_borrow_rate(1000, 0);
            // At 0% utilization: rate = baseRate / SECONDS_PER_YEAR
            let expected = 20_000_000_000_000_000u128 / SECONDS_PER_YEAR;
            assert_eq!(rate, expected);
        }

        #[ink::test]
        fn utilization_at_optimal() {
            let model = default_model();
            // 80% utilization: deposits=1000, borrows=800
            let rate = model.get_borrow_rate(1_000_000_000_000_000_000_000, 800_000_000_000_000_000_000);
            // Should be base + slope1 per second
            assert!(rate > 0);
        }

        #[ink::test]
        fn utilization_above_optimal() {
            let model = default_model();
            // 90% utilization
            let rate_90 = model.get_borrow_rate(1000 * PRECISION, 900 * PRECISION);
            // 50% utilization
            let rate_50 = model.get_borrow_rate(1000 * PRECISION, 500 * PRECISION);
            // Rate should be higher at 90% than 50%
            assert!(rate_90 > rate_50);
        }
    }
}
