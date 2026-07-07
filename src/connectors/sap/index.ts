// SAP connector (Phase 3). Only the mock is available in the browser build.
// A live SAP GUI Scripting adapter lives in the local Windows extractor
// (see local-extractor/silea_extractor/sap_connector.py) and would be wired
// in here on a machine with SAP GUI once IT approves (SPEC §10).
export { mockSapConnector } from "./mockSapConnector";
export type { SapConnector, SapContractRecord } from "../types";
