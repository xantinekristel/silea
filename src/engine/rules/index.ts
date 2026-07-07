import { PlanType } from "../types";
import { PlanRule } from "./types";
import { rfRule } from "./rf";
import { twelveMaRule } from "./twelveMa";
import { lsRule } from "./ls";

const REGISTRY: Record<PlanType, PlanRule> = {
  RF: rfRule,
  "12MA": twelveMaRule,
  LS: lsRule,
};

/** Look up the rule module for a plan type (SPEC §6.5 / §6.6 extensibility). */
export function getRule(planType: PlanType): PlanRule {
  return REGISTRY[planType];
}

export type { PlanRule, CountContext } from "./types";
