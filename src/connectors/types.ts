import { Account, Ledger, SI } from "../engine/types";

// Clean connector interfaces (SPEC §10, §11). Phase 1 runs entirely on
// files/mocks; these interfaces are where the Phase 3–5 live-system adapters
// plug in later WITHOUT changing the engine. A local Windows build supplies
// real implementations (SAP GUI Scripting, Playwright/NOAH, SI Retrieval App);
// the browser build only ever uses the mock adapters in this folder.

/** SPEC §6.1(2) — ZRGCSTAT "Buyers Only" contract numbers per account. */
export interface SapContractRecord {
  account_id: string;
  current_contract_no: string;
  previous_contract_no_1: string | null;
  previous_contract_no_2: string | null;
}

/**
 * SAP connector (Phase 3). Real adapter attaches to an already-logged-in SAP
 * GUI session and runs ZRGCSTAT — it never stores or enters a password.
 */
export interface SapConnector {
  readonly name: string;
  readonly live: boolean; // false = mock/canned data
  fetchContracts(accountIds: string[]): Promise<SapContractRecord[]>;
}

export interface NoahLedgerRequest {
  account_id: string;
  contract_no: string;
  /** Expected identity — the connector must confirm NOAH shows a match. */
  expected: { project: string; unit: string; client_name: string };
}

export interface NoahLedgerResult {
  contract_no: string;
  found: boolean;
  ledger?: Ledger;
  /** Set when displayed project/unit/client did not match — never guess (§10). */
  mismatch?: string;
}

/**
 * NOAH connector (Phase 4). Real adapter attaches to an already-logged-in NOAH
 * browser session, searches each contract, verifies the displayed
 * project/unit/client before accepting the ledger (mismatch → stop and flag),
 * exports to Excel and renames per SPEC §7.
 */
export interface NoahConnector {
  readonly name: string;
  readonly live: boolean;
  fetchLedger(req: NoahLedgerRequest): Promise<NoahLedgerResult>;
}

/**
 * SI Retrieval App connector (Phase 5). Real adapter enters OR numbers and
 * reports which SIs were retrieved.
 */
export interface SiConnector {
  readonly name: string;
  readonly live: boolean;
  retrieveSis(orNumbers: string[]): Promise<SI[]>;
}

export interface Connectors {
  sap: SapConnector;
  noah: NoahConnector;
  si: SiConnector;
}

export type { Account };
