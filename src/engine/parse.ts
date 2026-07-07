import * as XLSX from "xlsx";
import { Account, EngineInput, Ledger, Payment, PlanType, SI } from "./types";

// Readers for the staff-provided files (SPEC §6.1). Accept .xlsx / .xls / .csv.
// Header matching is tolerant: case-insensitive, spaces/underscores ignored.

function normKey(k: string): string {
  return k.toLowerCase().replace(/[\s_-]+/g, "");
}

/** Build a lookup of normalised header → original value for one row. */
function rowLookup(row: Record<string, unknown>): (...names: string[]) => unknown {
  const map = new Map<string, unknown>();
  for (const [k, v] of Object.entries(row)) map.set(normKey(k), v);
  return (...names: string[]) => {
    for (const n of names) {
      const v = map.get(normKey(n));
      if (v !== undefined && v !== null && String(v).trim() !== "") return v;
    }
    return undefined;
  };
}

function str(v: unknown): string {
  return v === undefined || v === null ? "" : String(v).trim();
}

function strOrNull(v: unknown): string | null {
  const s = str(v);
  return s === "" ? null : s;
}

function num(v: unknown): number {
  if (typeof v === "number") return v;
  const cleaned = str(v).replace(/[₱,\s]/g, "");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function toIsoDate(v: unknown): string {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number") {
    // Excel serial date.
    const d = XLSX.SSF ? new Date(Math.round((v - 25569) * 86400 * 1000)) : null;
    if (d && !isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  const s = str(v);
  const d = new Date(s);
  return isNaN(d.getTime()) ? s : d.toISOString().slice(0, 10);
}

async function readSheet(file: File): Promise<Record<string, unknown>[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const first = wb.SheetNames[0];
  if (!first) return [];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[first], {
    defval: "",
    raw: false,
  });
}

function toPlanType(v: unknown): PlanType {
  const s = normKey(str(v));
  if (s === "12ma" || s === "12monthamortization") return "12MA";
  if (s === "ls" || s === "lumpsum") return "LS";
  return "RF";
}

/** Account list (SPEC §5.1). */
export async function parseAccountList(file: File): Promise<Account[]> {
  const rows = await readSheet(file);
  const accounts: Account[] = [];
  for (const row of rows) {
    const g = rowLookup(row);
    const account_id = str(g("account_id", "accountid", "account"));
    if (!account_id) continue;
    accounts.push({
      account_id,
      client_name: str(g("client_name", "client", "name")),
      project: str(g("project")),
      unit: str(g("unit")),
      current_contract_no: str(
        g("current_contract_no", "current_contract", "currentcontract"),
      ),
      previous_contract_no_1: strOrNull(
        g("previous_contract_no_1", "previous_contract_1", "prev_contract_1"),
      ),
      previous_contract_no_2: strOrNull(
        g("previous_contract_no_2", "previous_contract_2", "prev_contract_2"),
      ),
      plan_type: toPlanType(g("plan_type", "plan")),
    });
  }
  return accounts;
}

/** Derive a contract number from the SPEC §7 file-name convention. */
export function contractNoFromFileName(name: string): string {
  const base = name.replace(/\.[^.]+$/, "");
  const parts = base.split("_");
  const last = parts[parts.length - 1]?.toLowerCase();
  if (last === "ledger" && parts.length >= 2) return parts[parts.length - 2];
  return base;
}

/** One ledger file = one contract's payment rows (SPEC §5.2 / §5.3). */
export async function parseLedgerFile(file: File): Promise<Ledger> {
  const rows = await readSheet(file);
  let contract_no = "";
  const payments: Payment[] = [];
  for (const row of rows) {
    const g = rowLookup(row);
    const rowContract = str(g("contract_no", "contractno", "contract"));
    if (rowContract && !contract_no) contract_no = rowContract;
    const dateRaw = g("payment_date", "date", "paymentdate");
    const amountRaw = g("amount", "payment", "paymentamount");
    if (dateRaw === undefined && amountRaw === undefined) continue;
    payments.push({
      payment_date: toIsoDate(dateRaw),
      amount: num(amountRaw),
      or_number: strOrNull(g("or_number", "ornumber", "or", "or_no")),
      source_contract_no: rowContract || contractNoFromFileName(file.name),
    });
  }
  if (!contract_no) contract_no = contractNoFromFileName(file.name);
  for (const p of payments) if (!p.source_contract_no) p.source_contract_no = contract_no;
  return {
    ledger_id: file.name,
    account_id: "",
    contract_no,
    file_path: file.name,
    payments,
  };
}

/** SI index / folder listing (SPEC §5.4). */
export async function parseSiIndex(file: File): Promise<SI[]> {
  const rows = await readSheet(file);
  const sis: SI[] = [];
  for (const row of rows) {
    const g = rowLookup(row);
    const or_number = str(g("or_number", "ornumber", "or", "or_no"));
    if (!or_number) continue;
    const si_file_path = strOrNull(
      g("si_file_path", "si_path", "file_path", "path", "sifile"),
    );
    const retrievedRaw = g("retrieved", "found", "status");
    let retrieved: boolean;
    if (retrievedRaw === undefined) {
      retrieved = !!si_file_path;
    } else {
      const s = normKey(str(retrievedRaw));
      retrieved = ["true", "yes", "y", "1", "retrieved", "present", "found"].includes(s);
    }
    sis.push({ or_number, si_file_path, retrieved });
  }
  return sis;
}

/** Parse a full upload set into a single EngineInput. */
export async function parseInputs(
  accountFile: File,
  ledgerFiles: File[],
  siIndexFile: File | null,
  siFileNames: string[] = [],
): Promise<EngineInput> {
  const accounts = await parseAccountList(accountFile);
  const ledgers = await Promise.all(ledgerFiles.map(parseLedgerFile));
  let sis: SI[] = [];
  if (siIndexFile) {
    sis = await parseSiIndex(siIndexFile);
  }
  // If a folder of SI files was supplied without an index, synthesise the
  // index from file names ({ORNumber}_SI.pdf per SPEC §7).
  if (siFileNames.length) {
    const known = new Set(sis.map((s) => s.or_number));
    for (const name of siFileNames) {
      const or = name.replace(/\.[^.]+$/, "").replace(/_si$/i, "");
      if (!known.has(or)) {
        sis.push({ or_number: or, si_file_path: name, retrieved: true });
        known.add(or);
      }
    }
  }
  return { accounts, ledgers, sis };
}
