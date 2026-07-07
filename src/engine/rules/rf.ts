import { CountContext, PlanRule } from "./types";

/**
 * RF (Regular Financing) rules — matches the manual procedure in SPEC §6.2.
 * A clean account is expected to have one retrieved SI per payment that
 * requires its own OR; no-OR first payments carried over from a previous
 * contract do not require their own SI.
 */
export const rfRule: PlanRule = {
  planType: "RF",
  label: "RF — Regular Financing",
  supported: true,
  expectedSiCount(ctx: CountContext): number {
    return ctx.paymentCount - ctx.resolvedCarryOvers;
  },
};
