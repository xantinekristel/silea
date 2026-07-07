import { PlanType } from "../types";

/** Context the engine hands each rule for the count reconciliation (SPEC §6.2 step 6). */
export interface CountContext {
  /** Total payment rows parsed across all of the account's ledgers. */
  paymentCount: number;
  /** No-OR first payments that were matched to a previous-contract ledger. */
  resolvedCarryOvers: number;
  /** Payments that carry an OR number. */
  orPaymentCount: number;
}

/**
 * A pluggable plan-type rule (SPEC §6.5). Add a new plan type by adding a
 * module and registering it in ./index.ts — no core engine changes needed.
 */
export interface PlanRule {
  planType: PlanType;
  /** Human-readable label for the UI. */
  label: string;
  /**
   * false = not yet confirmed against DCMG procedure. The engine routes any
   * account on an unsupported plan straight to "For Manual Review" and never
   * guesses a Complete result (SPEC §6.5 / §9).
   */
  supported: boolean;
  /** Expected number of distinct retrieved SIs for a clean account. */
  expectedSiCount(ctx: CountContext): number;
}
