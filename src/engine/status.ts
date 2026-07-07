import { STATUS, Status } from "./types";

/**
 * Severity order for rolling up multiple findings into one top-level account
 * status (SPEC §6.2 step 7). Higher number = takes precedence. The engine
 * never silently marks an ambiguous account Complete (SPEC §6.3 / §9): any
 * finding at all outranks Complete, and genuinely undetermined cases route to
 * "For Manual Review".
 */
const SEVERITY: Record<Status, number> = {
  [STATUS.COMPLETE]: 0,
  [STATUS.FOR_TREASURY]: 10,
  [STATUS.PAYMENT_COUNT_MISMATCH]: 20,
  [STATUS.FOR_BC]: 30,
  [STATUS.MISSING_SI]: 40,
  [STATUS.MISSING_OR]: 50,
  [STATUS.MISSING_LEDGER]: 60,
  [STATUS.NOT_FOUND_NOAH]: 70,
  [STATUS.MANUAL_REVIEW]: 80,
};

export function worstStatus(statuses: Status[]): Status {
  if (statuses.length === 0) return STATUS.COMPLETE;
  return statuses.reduce((worst, s) =>
    SEVERITY[s] > SEVERITY[worst] ? s : worst,
  );
}

/** Ordered list of every status, for building summary reports / legends. */
export const ALL_STATUSES: Status[] = [
  STATUS.COMPLETE,
  STATUS.MISSING_SI,
  STATUS.MISSING_OR,
  STATUS.FOR_BC,
  STATUS.FOR_TREASURY,
  STATUS.PAYMENT_COUNT_MISMATCH,
  STATUS.MISSING_LEDGER,
  STATUS.NOT_FOUND_NOAH,
  STATUS.MANUAL_REVIEW,
];

/** Colour hint per status for the UI (kept engine-side so it's centralised). */
export const STATUS_TONE: Record<Status, "ok" | "warn" | "bad" | "info"> = {
  [STATUS.COMPLETE]: "ok",
  [STATUS.MISSING_SI]: "bad",
  [STATUS.MISSING_OR]: "bad",
  [STATUS.FOR_BC]: "warn",
  [STATUS.FOR_TREASURY]: "warn",
  [STATUS.PAYMENT_COUNT_MISMATCH]: "warn",
  [STATUS.MISSING_LEDGER]: "bad",
  [STATUS.NOT_FOUND_NOAH]: "bad",
  [STATUS.MANUAL_REVIEW]: "info",
};
