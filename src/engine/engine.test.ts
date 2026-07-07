import { describe, it, expect } from "vitest";
import { processAll } from "./engine";
import { sampleInput } from "./fixtures";
import { STATUS } from "./types";

describe("SILEA matching & exception engine — SPEC §12 fixtures", () => {
  const results = processAll(sampleInput);
  const byId = Object.fromEntries(results.map((r) => [r.account_id, r]));

  it("Account A → Complete – Ready for Submission", () => {
    expect(byId["MAVEN-10A-JDC"].status).toBe(STATUS.COMPLETE);
  });

  it("Account B → Complete (no-OR first payment covered by previous ledger)", () => {
    expect(byId["SOLARA-05B-MRC"].status).toBe(STATUS.COMPLETE);
  });

  it("Account C → For B&C Validation (unmatched no-OR payment)", () => {
    expect(byId["VERDE-22C-LPH"].status).toBe(STATUS.FOR_BC);
  });

  it("Account D → Missing Ledger File (previous contract ledger absent)", () => {
    expect(byId["AURORA-14D-KTS"].status).toBe(STATUS.MISSING_LEDGER);
  });

  it("Account E → Payment Count Mismatch", () => {
    expect(byId["MAVEN-33E-RGL"].status).toBe(STATUS.PAYMENT_COUNT_MISMATCH);
  });

  it("never silently marks an exception account Complete", () => {
    const completes = results.filter((r) => r.status === STATUS.COMPLETE);
    expect(completes.map((r) => r.account_id).sort()).toEqual([
      "MAVEN-10A-JDC",
      "SOLARA-05B-MRC",
    ]);
  });

  it("LS plan type always routes to For Manual Review", () => {
    const lsResult = processAll({
      accounts: [
        {
          account_id: "LS-TEST",
          client_name: "LS Client",
          project: "Test",
          unit: "01",
          current_contract_no: "CN-LS",
          previous_contract_no_1: null,
          previous_contract_no_2: null,
          plan_type: "LS",
        },
      ],
      ledgers: [],
      sis: [],
    });
    expect(lsResult[0].status).toBe(STATUS.MANUAL_REVIEW);
  });
});
