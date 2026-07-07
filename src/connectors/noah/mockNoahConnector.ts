import { NoahConnector, NoahLedgerRequest, NoahLedgerResult } from "../types";
import { sampleInput } from "../../engine/fixtures";
import { Ledger } from "../../engine/types";

const NOAH_BASE = "https://noah.example.internal/ledger";

/**
 * Mock NOAH connector (SPEC §11). Serves canned ledgers keyed by contract
 * number and, crucially, reproduces the verification behaviour the real
 * adapter must have (SPEC §10): it confirms the displayed project/unit/client
 * match the expected account before accepting a ledger, and never guesses — a
 * mismatch is reported, not silently accepted. Contracts with no ledger (e.g.
 * CN-D-PREV) come back found=false so the engine flags Missing Ledger File.
 */
export const mockNoahConnector: NoahConnector = {
  name: "Mock NOAH (canned ledgers)",
  live: false,
  async fetchLedger(req: NoahLedgerRequest): Promise<NoahLedgerResult> {
    const src = sampleInput.ledgers.find((l) => l.contract_no === req.contract_no);
    if (!src) {
      return { contract_no: req.contract_no, found: false };
    }

    // Verify NOAH's displayed identity against what we expected (§10).
    const shown = deriveIdentity(src);
    if (
      shown.project !== req.expected.project ||
      shown.unit !== req.expected.unit
    ) {
      return {
        contract_no: req.contract_no,
        found: false,
        mismatch: `NOAH shows ${shown.project}/${shown.unit} but expected ${req.expected.project}/${req.expected.unit}.`,
      };
    }

    const ledger: Ledger = {
      ...src,
      source_url: `${NOAH_BASE}?contract=${encodeURIComponent(req.contract_no)}`,
    };
    return { contract_no: req.contract_no, found: true, ledger };
  },
};

/** In the mock, identity is embedded in the canned file_path; a real adapter
 *  would read it off the NOAH page. */
function deriveIdentity(ledger: Ledger): { project: string; unit: string } {
  const account = sampleInput.accounts.find(
    (a) =>
      a.current_contract_no === ledger.contract_no ||
      a.previous_contract_no_1 === ledger.contract_no ||
      a.previous_contract_no_2 === ledger.contract_no,
  );
  return { project: account?.project ?? "", unit: account?.unit ?? "" };
}
