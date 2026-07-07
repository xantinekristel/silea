import { describe, it, expect } from "vitest";
import { assembleInputViaConnectors, mockConnectors } from "./pipeline";
import { processAll } from "../engine/engine";
import { sampleInput } from "../engine/fixtures";
import { STATUS } from "../engine/types";

describe("connector pipeline (mock SAP → NOAH → SI)", () => {
  it("reproduces the five SPEC §12 outcomes through the full orchestrated path", async () => {
    // Start from only the account list; NOAH + SI supply ledgers and SIs.
    const { input, warnings } = await assembleInputViaConnectors(
      sampleInput.accounts,
      mockConnectors,
    );
    const results = processAll(input);
    const byId = Object.fromEntries(results.map((r) => [r.account_id, r.status]));

    expect(byId["MAVEN-10A-JDC"]).toBe(STATUS.COMPLETE);
    expect(byId["SOLARA-05B-MRC"]).toBe(STATUS.COMPLETE);
    expect(byId["VERDE-22C-LPH"]).toBe(STATUS.FOR_BC);
    expect(byId["AURORA-14D-KTS"]).toBe(STATUS.MISSING_LEDGER);
    expect(byId["MAVEN-33E-RGL"]).toBe(STATUS.PAYMENT_COUNT_MISMATCH);

    // No cross-check mismatches on clean sample data.
    expect(warnings).toEqual([]);
  });

  it("attaches NOAH ledger links and SI links for clickable tracker output", async () => {
    const { input } = await assembleInputViaConnectors(sampleInput.accounts);
    const results = processAll(input);
    const a = results.find((r) => r.account_id === "MAVEN-10A-JDC")!;
    expect(a.ledger_files[0].url).toMatch(/noah\.example\.internal/);
    expect(a.si_files[0].url).toMatch(/si-retrieval\.example\.internal/);
  });
});
