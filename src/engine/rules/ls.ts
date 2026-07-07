import { PlanRule } from "./types";

/**
 * LS (Lump Sum) rules — NOT YET IMPLEMENTED (SPEC §6.5). The expected count
 * rule for LS has not been confirmed against DCMG procedure, so this stub is
 * marked unsupported: the engine routes every LS account to "For Manual
 * Review" rather than guessing. Fill in expectedSiCount and flip `supported`
 * to true once the rule is confirmed.
 */
export const lsRule: PlanRule = {
  planType: "LS",
  label: "LS — Lump Sum (not yet implemented)",
  supported: false,
  expectedSiCount(): number {
    // Never used while supported === false, but must satisfy the interface.
    throw new Error("LS rule not implemented yet");
  },
};
