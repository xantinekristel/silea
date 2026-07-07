import * as XLSX from "xlsx";
import JSZip from "jszip";
import { AccountResult, EngineInput, STATUS, Status } from "./types";
import { ALL_STATUSES } from "./status";

export type StatusCounts = Record<Status, number>;

export function summaryCounts(results: AccountResult[]): StatusCounts {
  const counts = Object.fromEntries(
    ALL_STATUSES.map((s) => [s, 0]),
  ) as StatusCounts;
  for (const r of results) counts[r.status] += 1;
  return counts;
}

function sheetToBlob(wb: XLSX.WorkBook): Blob {
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  return new Blob([out], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

/** SPEC §6.4(1) — the updated Excel tracker, one row per account, with
 *  hyperlinks to each ledger and SI when a source URL (e.g. NOAH) is known. */
export function buildTrackerWorkbook(results: AccountResult[]): Blob {
  const rows = results.map((r) => ({
    Account: r.account_id,
    Client: r.client_name,
    Project: r.project,
    Unit: r.unit,
    Plan: r.plan_type,
    Status: r.status,
    Reason: r.reason,
    Payments: r.payment_count,
    SIs: r.si_count,
    "Ledger Files": r.ledger_files.map((f) => f.file_path).join(" | "),
    "SI Files": r.si_files.map((f) => f.si_file_path).join(" | "),
    "Ledger Link": r.ledger_files.find((f) => f.url)?.url ?? "",
    "SI Link": r.si_files.find((f) => f.url)?.url ?? "",
  }));
  const ws = XLSX.utils.json_to_sheet(rows);

  // Turn the link columns into real clickable hyperlinks (SPEC §6.4 hyperlinks).
  const header = Object.keys(rows[0] ?? {});
  const ledgerCol = header.indexOf("Ledger Link");
  const siCol = header.indexOf("SI Link");
  rows.forEach((row, i) => {
    const r = i + 1; // data starts on sheet row 1 (row 0 is the header)
    setHyperlink(ws, r, ledgerCol, row["Ledger Link"]);
    setHyperlink(ws, r, siCol, row["SI Link"]);
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Tracker");
  return sheetToBlob(wb);
}

function setHyperlink(
  ws: XLSX.WorkSheet,
  row: number,
  col: number,
  url: string,
): void {
  if (!url || col < 0) return;
  const ref = XLSX.utils.encode_cell({ r: row, c: col });
  const cell = ws[ref];
  if (cell) cell.l = { Target: url, Tooltip: url };
}

/** SPEC §6.4(2) — exceptions report, non-Complete accounts grouped by status. */
export function buildExceptionsWorkbook(results: AccountResult[]): Blob {
  const rows: Record<string, unknown>[] = [];
  for (const status of ALL_STATUSES) {
    if (status === STATUS.COMPLETE) continue;
    for (const r of results.filter((x) => x.status === status)) {
      rows.push({
        Status: r.status,
        Account: r.account_id,
        Client: r.client_name,
        Project: r.project,
        Unit: r.unit,
        Reason: r.reason,
      });
    }
  }
  const ws = XLSX.utils.json_to_sheet(
    rows.length ? rows : [{ Status: "", Account: "No exceptions", Reason: "" }],
  );
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Exceptions");
  return sheetToBlob(wb);
}

/** SPEC §8(7) — one-page status summary (counts per status). */
export function buildSummaryWorkbook(results: AccountResult[]): Blob {
  const counts = summaryCounts(results);
  const rows: { Status: string; Count: number }[] = ALL_STATUSES.map((s) => ({
    Status: s as string,
    Count: counts[s],
  }));
  rows.push({ Status: "TOTAL", Count: results.length });
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Summary");
  return sheetToBlob(wb);
}

/** SPEC §9 — audit log CSV. */
export function buildAuditCsv(
  results: AccountResult[],
  user: string,
  runDate = new Date(),
): Blob {
  const date = runDate.toISOString();
  const esc = (v: unknown) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = ["date", "user", "account", "status", "reason", "file_actions"];
  const lines = [header.join(",")];
  for (const r of results) {
    const fileActions = `ledgers=${r.ledger_files.length};sis=${r.si_files.length}`;
    lines.push(
      [date, user, r.account_id, r.status, r.reason, fileActions]
        .map(esc)
        .join(","),
    );
  }
  return new Blob([lines.join("\n")], { type: "text/csv" });
}

/**
 * SPEC §6.4(3) — consultant submission package. ONLY accounts marked
 * "Complete – Ready for Submission" are included. Builds the Output/{Project}/
 * {Unit}/ folder tree with a manifest.json and the referenced ledger + SI
 * files. Real uploaded bytes are copied when available; otherwise a text
 * placeholder records the referenced path (sample-data mode). This never
 * sends anything externally — it only produces a ZIP the user downloads.
 */
export async function buildSubmissionZip(
  results: AccountResult[],
  fileBlobs: Map<string, Blob> = new Map(),
): Promise<{ blob: Blob; accountCount: number }> {
  const zip = new JSZip();
  const complete = results.filter((r) => r.status === STATUS.COMPLETE);

  for (const r of complete) {
    const dir = `Output/${sanitize(r.project)}/${sanitize(r.unit)}`;
    const manifest = {
      account_id: r.account_id,
      client_name: r.client_name,
      project: r.project,
      unit: r.unit,
      plan_type: r.plan_type,
      status: r.status,
      generated_at: new Date().toISOString(),
      ledgers: r.ledger_files,
      sis: r.si_files,
    };
    zip.file(`${dir}/manifest.json`, JSON.stringify(manifest, null, 2));

    for (const lf of r.ledger_files) {
      const base = basename(lf.file_path);
      const blob = fileBlobs.get(lf.file_path) ?? fileBlobs.get(base);
      zip.file(
        `${dir}/${base}`,
        blob ?? placeholder("ledger", lf.file_path),
      );
    }
    for (const sf of r.si_files) {
      const base = basename(sf.si_file_path);
      const blob = fileBlobs.get(sf.si_file_path) ?? fileBlobs.get(base);
      zip.file(`${dir}/${base}`, blob ?? placeholder("SI", sf.si_file_path));
    }
  }

  // Top-level manifest listing everything included.
  zip.file(
    "Output/manifest.json",
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        included_accounts: complete.map((r) => ({
          account_id: r.account_id,
          project: r.project,
          unit: r.unit,
        })),
        note: "Complete accounts only. Nothing has been sent externally.",
      },
      null,
      2,
    ),
  );

  const blob = await zip.generateAsync({ type: "blob" });
  return { blob, accountCount: complete.length };
}

/** Generate downloadable sample input workbooks so users can see the format. */
export async function buildSampleInputsZip(input: EngineInput): Promise<Blob> {
  const zip = new JSZip();

  // Account list.
  const accWs = XLSX.utils.json_to_sheet(
    input.accounts.map((a) => ({
      account_id: a.account_id,
      client_name: a.client_name,
      project: a.project,
      unit: a.unit,
      current_contract_no: a.current_contract_no,
      previous_contract_no_1: a.previous_contract_no_1 ?? "",
      previous_contract_no_2: a.previous_contract_no_2 ?? "",
      plan_type: a.plan_type,
    })),
  );
  const accWb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(accWb, accWs, "Accounts");
  zip.file(
    "account_list.xlsx",
    XLSX.write(accWb, { bookType: "xlsx", type: "array" }) as ArrayBuffer,
  );

  // One ledger file per contract.
  for (const l of input.ledgers) {
    const ws = XLSX.utils.json_to_sheet(
      l.payments.map((p) => ({
        contract_no: l.contract_no,
        payment_date: p.payment_date,
        amount: p.amount,
        or_number: p.or_number ?? "",
      })),
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ledger");
    zip.file(
      `Ledgers/${basename(l.file_path)}`,
      XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer,
    );
  }

  // SI index.
  const siWs = XLSX.utils.json_to_sheet(
    input.sis.map((s) => ({
      or_number: s.or_number,
      si_file_path: s.si_file_path ?? "",
      retrieved: s.retrieved,
    })),
  );
  const siWb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(siWb, siWs, "SI Index");
  zip.file(
    "si_index.xlsx",
    XLSX.write(siWb, { bookType: "xlsx", type: "array" }) as ArrayBuffer,
  );

  return zip.generateAsync({ type: "blob" });
}

function sanitize(s: string): string {
  return s.replace(/[^A-Za-z0-9._-]+/g, "_");
}

function basename(path: string): string {
  return path.split(/[\\/]/).pop() || path;
}

function placeholder(kind: string, path: string): string {
  return `Placeholder for ${kind} file.\nReferenced path: ${path}\n\nThis submission package was built from sample data, so the original file bytes are not present. When run on real uploaded files, the actual document is copied here instead.\n`;
}
