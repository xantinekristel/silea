import { SapConnector, SapContractRecord } from "../types";
import { sampleInput } from "../../engine/fixtures";

/**
 * Mock SAP connector (SPEC §11). Returns canned ZRGCSTAT-style contract
 * records so the full pipeline is testable with no live SAP. Swap for a real
 * SAP GUI Scripting adapter on a local Windows build.
 */
export const mockSapConnector: SapConnector = {
  name: "Mock SAP (ZRGCSTAT, canned)",
  live: false,
  async fetchContracts(accountIds: string[]): Promise<SapContractRecord[]> {
    const wanted = new Set(accountIds);
    return sampleInput.accounts
      .filter((a) => wanted.has(a.account_id))
      .map((a) => ({
        account_id: a.account_id,
        current_contract_no: a.current_contract_no,
        previous_contract_no_1: a.previous_contract_no_1,
        previous_contract_no_2: a.previous_contract_no_2,
      }));
  },
};
