// NOAH connector (Phase 4). Only the mock is available in the browser build.
// A live Playwright adapter lives in the local Windows extractor
// (see local-extractor/silea_extractor/noah_connector.py) and would be wired
// in here on a machine with network access to NOAH once IT approves (SPEC §10).
export { mockNoahConnector } from "./mockNoahConnector";
export type {
  NoahConnector,
  NoahLedgerRequest,
  NoahLedgerResult,
} from "../types";
