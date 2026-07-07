// Data model — mirrors SPEC.md §5.

export type PlanType = "RF" | "12MA" | "LS";

/** SPEC §5.1 */
export interface Account {
  account_id: string;
  client_name: string;
  project: string;
  unit: string;
  current_contract_no: string;
  previous_contract_no_1: string | null;
  previous_contract_no_2: string | null;
  plan_type: PlanType;
}

/** SPEC §5.3 — a row inside a ledger. */
export interface Payment {
  payment_date: string; // ISO date string (YYYY-MM-DD)
  amount: number;
  or_number: string | null; // null = missing OR, a known exception case
  source_contract_no: string; // which ledger this payment came from
}

/** SPEC §5.2 */
export interface Ledger {
  ledger_id: string;
  account_id: string;
  contract_no: string;
  file_path: string;
  payments: Payment[];
}

/** SPEC §5.4 — SI record retrieved from the SI Retrieval App. */
export interface SI {
  or_number: string; // join key back to Payment
  si_file_path: string | null; // null = SI not retrieved
  retrieved: boolean;
}

/** The exact status strings from SPEC §6.3. Do not add statuses without asking. */
export const STATUS = {
  COMPLETE: "Complete – Ready for Submission",
  MISSING_SI: "Missing SI",
  MISSING_OR: "Missing OR Number",
  FOR_BC: "For B&C Validation",
  FOR_TREASURY: "For Treasury Certification",
  PAYMENT_COUNT_MISMATCH: "Payment Count Mismatch",
  MISSING_LEDGER: "Missing Ledger File",
  NOT_FOUND_NOAH: "Account Not Found in NOAH",
  MANUAL_REVIEW: "For Manual Review",
} as const;

export type Status = (typeof STATUS)[keyof typeof STATUS];

/** A single detail line kept for the exceptions screen. */
export interface Finding {
  status: Status;
  detail: string;
  or_number?: string | null;
  contract_no?: string;
  payment_date?: string;
  amount?: number;
}

/** SPEC §5.5 — computed. Extended with the detail list for the UI. */
export interface AccountResult {
  account_id: string;
  client_name: string;
  project: string;
  unit: string;
  plan_type: PlanType;
  status: Status;
  reason: string;
  missing_or_numbers: Payment[];
  missing_sis: string[]; // OR numbers with no SI
  payment_count: number;
  si_count: number;
  findings: Finding[];
  // File references for the tracker / submission package.
  ledger_files: { contract_no: string; file_path: string }[];
  si_files: { or_number: string; si_file_path: string }[];
}

/** The full parsed input set the engine operates on. */
export interface EngineInput {
  accounts: Account[];
  ledgers: Ledger[];
  sis: SI[];
}
