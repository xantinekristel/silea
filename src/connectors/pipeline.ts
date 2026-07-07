import { Account, EngineInput, Ledger, SI } from "../engine/types";
import { Connectors } from "./types";
import { mockSapConnector } from "./sap";
import { mockNoahConnector } from "./noah";
import { mockSiConnector } from "./si";

/** The all-mock connector set used by the browser build. */
export const mockConnectors: Connectors = {
  sap: mockSapConnector,
  noah: mockNoahConnector,
  si: mockSiConnector,
};

export interface ExtractionProgress {
  phase: "sap" | "noah" | "si" | "done";
  message: string;
}

export interface ExtractionResult {
  input: EngineInput;
  warnings: string[];
}

/**
 * Chains SAP → NOAH → SI into a single EngineInput (mirrors the future Phase 6
 * orchestrator, SPEC §4/§11). Uses whatever connectors are passed — mocks in
 * the browser, real adapters on a local Windows build. The engine downstream
 * is identical either way, which is the whole point of the connector seam.
 */
export async function assembleInputViaConnectors(
  accounts: Account[],
  connectors: Connectors = mockConnectors,
  onProgress?: (p: ExtractionProgress) => void,
): Promise<ExtractionResult> {
  const warnings: string[] = [];

  // 1) SAP — cross-check the account list's contract numbers (SPEC §6.1.2).
  onProgress?.({ phase: "sap", message: `Cross-checking contracts via ${connectors.sap.name}…` });
  const sapRecords = await connectors.sap.fetchContracts(
    accounts.map((a) => a.account_id),
  );
  const sapById = new Map(sapRecords.map((r) => [r.account_id, r]));
  for (const a of accounts) {
    const rec = sapById.get(a.account_id);
    if (rec && rec.current_contract_no !== a.current_contract_no) {
      warnings.push(
        `${a.account_id}: SAP current contract ${rec.current_contract_no} ≠ account list ${a.current_contract_no}.`,
      );
    }
  }

  // 2) NOAH — pull a ledger for every contract number (SPEC §6.1.3).
  const ledgers: Ledger[] = [];
  for (const a of accounts) {
    const contractNos = [
      a.current_contract_no,
      a.previous_contract_no_1,
      a.previous_contract_no_2,
    ].filter((c): c is string => !!c && c.trim() !== "");
    for (const contract_no of contractNos) {
      onProgress?.({ phase: "noah", message: `NOAH: fetching ledger ${contract_no}…` });
      const res = await connectors.noah.fetchLedger({
        account_id: a.account_id,
        contract_no,
        expected: { project: a.project, unit: a.unit, client_name: a.client_name },
      });
      if (res.mismatch) {
        warnings.push(`${a.account_id} / ${contract_no}: ${res.mismatch} (skipped — never guess).`);
        continue;
      }
      if (res.found && res.ledger) {
        ledgers.push({ ...res.ledger, account_id: a.account_id });
      }
      // found=false → no ledger added → engine flags "Missing Ledger File".
    }
  }

  // 3) SI Retrieval App — retrieve SIs for every OR number we found (SPEC §6.1.4).
  const orNumbers = Array.from(
    new Set(
      ledgers.flatMap((l) =>
        l.payments.map((p) => p.or_number).filter((o): o is string => !!o),
      ),
    ),
  );
  onProgress?.({ phase: "si", message: `SI Retrieval App: ${orNumbers.length} OR number(s)…` });
  const sis: SI[] = orNumbers.length
    ? await connectors.si.retrieveSis(orNumbers)
    : [];

  onProgress?.({ phase: "done", message: "Extraction complete." });
  return { input: { accounts, ledgers, sis }, warnings };
}
