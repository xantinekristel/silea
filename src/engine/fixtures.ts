import { Account, EngineInput, Ledger, Payment, SI } from "./types";

// Dummy / fictional test data (SPEC §12). Five accounts, one per expected
// status outcome. All names, contracts and OR numbers are invented — no real
// client data. This is what makes SILEA runnable in a cloud sandbox with zero
// uploads: "Load Sample Data" feeds these straight into the engine.

function payment(
  date: string,
  amount: number,
  or_number: string | null,
  contract_no: string,
): Payment {
  return { payment_date: date, amount, or_number, source_contract_no: contract_no };
}

function ledger(
  account_id: string,
  contract_no: string,
  project: string,
  unit: string,
  client: string,
  payments: Payment[],
): Ledger {
  return {
    ledger_id: `${account_id}::${contract_no}`,
    account_id,
    contract_no,
    file_path: `${project}/${unit}/Ledgers/${project}_${unit}_${client}_${contract_no}_Ledger.xlsx`,
    payments,
  };
}

function si(or_number: string, retrieved: boolean): SI {
  return {
    or_number,
    retrieved,
    si_file_path: retrieved ? `SIs/${or_number}_SI.pdf` : null,
  };
}

const accounts: Account[] = [
  // A — one current contract, all ORs + SIs present → Complete.
  {
    account_id: "MAVEN-10A-JDC",
    client_name: "Juan Dela Cruz",
    project: "Maven",
    unit: "10-A",
    current_contract_no: "CN-A-CUR",
    previous_contract_no_1: null,
    previous_contract_no_2: null,
    plan_type: "RF",
  },
  // B — first current payment has no OR but is covered by the previous ledger → Complete.
  {
    account_id: "SOLARA-05B-MRC",
    client_name: "Maria Reyes Cruz",
    project: "Solara",
    unit: "05-B",
    current_contract_no: "CN-B-CUR",
    previous_contract_no_1: "CN-B-PREV",
    previous_contract_no_2: null,
    plan_type: "RF",
  },
  // C — no-OR payment not covered by either previous ledger → For B&C Validation.
  {
    account_id: "VERDE-22C-LPH",
    client_name: "Luis Perez Hernandez",
    project: "Verde",
    unit: "22-C",
    current_contract_no: "CN-C-CUR",
    previous_contract_no_1: "CN-C-PREV1",
    previous_contract_no_2: "CN-C-PREV2",
    plan_type: "RF",
  },
  // D — previous contract ledger file is missing → Missing Ledger File.
  {
    account_id: "AURORA-14D-KTS",
    client_name: "Katrina Santos",
    project: "Aurora",
    unit: "14-D",
    current_contract_no: "CN-D-CUR",
    previous_contract_no_1: "CN-D-PREV",
    previous_contract_no_2: null,
    plan_type: "12MA",
  },
  // E — 4 payments but one OR is consolidated, so SI count (3) ≠ payments → Payment Count Mismatch.
  {
    account_id: "MAVEN-33E-RGL",
    client_name: "Ramon Garcia Lim",
    project: "Maven",
    unit: "33-E",
    current_contract_no: "CN-E-CUR",
    previous_contract_no_1: null,
    previous_contract_no_2: null,
    plan_type: "RF",
  },
];

const ledgers: Ledger[] = [
  // A
  ledger("MAVEN-10A-JDC", "CN-A-CUR", "Maven", "10-A", "JDC", [
    payment("2024-01-15", 50000, "OR-A1", "CN-A-CUR"),
    payment("2024-02-15", 50000, "OR-A2", "CN-A-CUR"),
    payment("2024-03-15", 50000, "OR-A3", "CN-A-CUR"),
  ]),
  // B — previous ledger holds the matching entry for the no-OR first payment.
  ledger("SOLARA-05B-MRC", "CN-B-PREV", "Solara", "05-B", "MRC", [
    payment("2023-11-10", 30000, "OR-B0", "CN-B-PREV"),
  ]),
  ledger("SOLARA-05B-MRC", "CN-B-CUR", "Solara", "05-B", "MRC", [
    payment("2024-01-10", 30000, null, "CN-B-CUR"), // no OR → covered by CN-B-PREV
    payment("2024-02-10", 30000, "OR-B1", "CN-B-CUR"),
    payment("2024-03-10", 30000, "OR-B2", "CN-B-CUR"),
  ]),
  // C — two previous ledgers, neither matches the no-OR payment's amount.
  ledger("VERDE-22C-LPH", "CN-C-PREV1", "Verde", "22-C", "LPH", [
    payment("2023-06-01", 40000, "OR-C-P1", "CN-C-PREV1"),
  ]),
  ledger("VERDE-22C-LPH", "CN-C-PREV2", "Verde", "22-C", "LPH", [
    payment("2023-09-01", 45000, "OR-C-P2", "CN-C-PREV2"),
  ]),
  ledger("VERDE-22C-LPH", "CN-C-CUR", "Verde", "22-C", "LPH", [
    payment("2024-01-05", 99999, null, "CN-C-CUR"), // no OR, unmatched → For B&C
    payment("2024-02-05", 40000, "OR-C1", "CN-C-CUR"),
  ]),
  // D — only the current ledger is provided; CN-D-PREV file is absent.
  ledger("AURORA-14D-KTS", "CN-D-CUR", "Aurora", "14-D", "KTS", [
    payment("2024-01-20", 60000, "OR-D1", "CN-D-CUR"),
    payment("2024-02-20", 60000, "OR-D2", "CN-D-CUR"),
  ]),
  // E — OR-E2 is shared across two payment rows (consolidated receipt).
  ledger("MAVEN-33E-RGL", "CN-E-CUR", "Maven", "33-E", "RGL", [
    payment("2024-01-08", 25000, "OR-E1", "CN-E-CUR"),
    payment("2024-02-08", 25000, "OR-E2", "CN-E-CUR"),
    payment("2024-03-08", 25000, "OR-E2", "CN-E-CUR"),
    payment("2024-04-08", 25000, "OR-E3", "CN-E-CUR"),
  ]),
];

const sis: SI[] = [
  si("OR-A1", true),
  si("OR-A2", true),
  si("OR-A3", true),
  si("OR-B0", true),
  si("OR-B1", true),
  si("OR-B2", true),
  si("OR-C-P1", true),
  si("OR-C-P2", true),
  si("OR-C1", true),
  si("OR-D1", true),
  si("OR-D2", true),
  si("OR-E1", true),
  si("OR-E2", true),
  si("OR-E3", true),
];

export const sampleInput: EngineInput = { accounts, ledgers, sis };
