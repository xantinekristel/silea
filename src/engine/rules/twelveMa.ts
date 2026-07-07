import { CountContext, PlanRule } from "./types";

/**
 * 12 MA (12-Month Amortization) rules. Ships v1 matching the same manual
 * procedure as RF (SPEC §6.2). The exact expected-payment / expected-SI count
 * rule specific to 12MA is flagged for DCMG confirmation in SPEC §14; when
 * confirmed, adjust expectedSiCount here without touching the core engine.
 */
export const twelveMaRule: PlanRule = {
  planType: "12MA",
  label: "12MA — 12-Month Amortization",
  supported: true,
  expectedSiCount(ctx: CountContext): number {
    return ctx.paymentCount - ctx.resolvedCarryOvers;
  },
};
