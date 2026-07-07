import { useMemo, useRef, useState } from "react";
import { AccountResult, EngineInput, Status } from "./engine/types";
import { ALL_STATUSES } from "./engine/status";
import { processAccount } from "./engine/engine";
import { sampleInput } from "./engine/fixtures";
import { parseAccountList, parseInputs } from "./engine/parse";
import { assembleInputViaConnectors, mockConnectors } from "./connectors/pipeline";
import {
  buildAuditCsv,
  buildExceptionsWorkbook,
  buildSampleInputsZip,
  buildSubmissionZip,
  buildSummaryWorkbook,
  buildTrackerWorkbook,
  summaryCounts,
} from "./engine/outputs";
import { downloadBlob, today } from "./util/download";
import { SummaryCards } from "./components/SummaryCards";
import { ResultsTable } from "./components/ResultsTable";

const USER = "web-user";
const CHECKPOINT_KEY = "silea:checkpoint";

type Source = "sample" | "upload" | "connectors" | null;
type Progress = { done: number; total: number; counts: Record<Status, number> };

const emptyCounts = () =>
  Object.fromEntries(ALL_STATUSES.map((s) => [s, 0])) as Record<Status, number>;

const isIndexFile = (name: string) => /\.(xlsx|xls|csv)$/i.test(name);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function App() {
  const [source, setSource] = useState<Source>(null);
  const [accountFile, setAccountFile] = useState<File | null>(null);
  const [ledgerFiles, setLedgerFiles] = useState<File[]>([]);
  const [siFiles, setSiFiles] = useState<File[]>([]);

  const [results, setResults] = useState<AccountResult[] | null>(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState<Progress>({
    done: 0,
    total: 0,
    counts: emptyCounts(),
  });
  const [tab, setTab] = useState<"all" | "exceptions">("all");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const accountInput = useRef<HTMLInputElement>(null);
  const ledgerInput = useRef<HTMLInputElement>(null);
  const siInput = useRef<HTMLInputElement>(null);

  const uploadReady = !!accountFile;
  const canProcess =
    source === "sample" ||
    source === "connectors" ||
    (source === "upload" && uploadReady);

  const fileBlobs = useMemo(() => {
    const map = new Map<string, Blob>();
    for (const f of ledgerFiles) map.set(f.name, f);
    for (const f of siFiles) map.set(f.name, f);
    return map;
  }, [ledgerFiles, siFiles]);

  function resetResults() {
    setResults(null);
    setMessage(null);
    setError(null);
    setWarnings([]);
    setProgress({ done: 0, total: 0, counts: emptyCounts() });
  }

  function loadSample() {
    setSource("sample");
    setAccountFile(null);
    setLedgerFiles([]);
    setSiFiles([]);
    resetResults();
    setMessage("Sample data loaded — 5 fictional accounts (SPEC §12). Click Start Processing.");
  }

  function pickUpload(setter: () => void) {
    setSource("upload");
    resetResults();
    setter();
  }

  function loadConnectors() {
    setSource("connectors");
    resetResults();
    setMessage(
      "Mock connector mode: SAP cross-checks contracts, NOAH supplies the ledgers, and the SI Retrieval App supplies the SIs — all canned. Click Start Processing to run the full SAP→NOAH→SI→match pipeline. (Real adapters plug in on a local Windows build; see the repo's local-extractor/.)",
    );
  }

  async function buildEngineInput(): Promise<EngineInput> {
    if (source === "sample") return sampleInput;
    if (source === "connectors") {
      const accounts = accountFile
        ? await parseAccountList(accountFile)
        : sampleInput.accounts;
      const { input, warnings: w } = await assembleInputViaConnectors(
        accounts,
        mockConnectors,
      );
      setWarnings(w);
      return input;
    }
    if (!accountFile) throw new Error("Select an account list first.");
    const indexFile = siFiles.find((f) => isIndexFile(f.name)) ?? null;
    const siPdfNames = siFiles
      .filter((f) => !isIndexFile(f.name))
      .map((f) => f.name);
    return parseInputs(accountFile, ledgerFiles, indexFile, siPdfNames);
  }

  function checkpointSignature(input: EngineInput): string {
    return JSON.stringify({
      source,
      ids: input.accounts.map((a) => a.account_id),
    });
  }

  async function startProcessing() {
    setProcessing(true);
    setError(null);
    setMessage(null);
    try {
      const input = await buildEngineInput();
      if (input.accounts.length === 0) {
        throw new Error("No accounts found in the account list.");
      }

      // Resumability (SPEC §9): resume from a matching checkpoint if present.
      const signature = checkpointSignature(input);
      let done: AccountResult[] = [];
      try {
        const saved = JSON.parse(localStorage.getItem(CHECKPOINT_KEY) || "null");
        if (saved && saved.signature === signature && Array.isArray(saved.results)) {
          done = saved.results as AccountResult[];
        }
      } catch {
        /* ignore malformed checkpoint */
      }

      const counts = emptyCounts();
      for (const r of done) counts[r.status] += 1;
      setProgress({ done: done.length, total: input.accounts.length, counts: { ...counts } });

      for (let i = done.length; i < input.accounts.length; i++) {
        const r = processAccount(input.accounts[i], input.ledgers, input.sis);
        done.push(r);
        counts[r.status] += 1;
        setProgress({
          done: done.length,
          total: input.accounts.length,
          counts: { ...counts },
        });
        localStorage.setItem(
          CHECKPOINT_KEY,
          JSON.stringify({ signature, results: done }),
        );
        // Small yield so staff see live progress rather than a frozen screen (SPEC §8).
        if (input.accounts.length <= 200) await sleep(120);
      }

      setResults([...done]);
      localStorage.removeItem(CHECKPOINT_KEY);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setProcessing(false);
    }
  }

  async function prepareSubmission() {
    if (!results) return;
    const completeCount = results.filter(
      (r) => r.status === "Complete – Ready for Submission",
    ).length;
    if (completeCount === 0) {
      setMessage("No accounts are Complete yet — nothing to submit.");
      return;
    }
    const ok = window.confirm(
      `Prepare a consultant submission package for ${completeCount} Complete account(s)?\n\n` +
        "This only builds a downloadable ZIP on your machine. Nothing is sent to the consultant automatically.",
    );
    if (!ok) return;
    const { blob } = await buildSubmissionZip(results, fileBlobs);
    downloadBlob(blob, `Consultant_Submission_${today()}.zip`);
    setMessage(
      `Submission package built for ${completeCount} account(s). Review it, then send it manually — SILEA never sends anything for you.`,
    );
  }

  const counts = results ? summaryCounts(results) : null;
  const completeCount = counts?.["Complete – Ready for Submission"] ?? 0;
  const exceptionCount = results ? results.length - completeCount : 0;
  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <h1>SILEA</h1>
          <p className="sub">SI Ledger Extraction &amp; Automation Tool · Phase 1 + 2</p>
        </div>
        <span className="badge">Runs fully in your browser — no data leaves this page</span>
      </header>

      <main>
        {/* Step 1 — inputs */}
        <section className="panel">
          <h2>1 · Choose your files</h2>
          <p className="muted">
            Provide the account list, the ledger files, and the SI index — or load the
            built-in sample data to try it instantly.
          </p>

          <div className="controls">
            <button className="btn" onClick={() => accountInput.current?.click()}>
              Select Account List
            </button>
            <input
              ref={accountInput}
              type="file"
              accept=".xlsx,.xls,.csv"
              hidden
              onChange={(e) =>
                pickUpload(() => setAccountFile(e.target.files?.[0] ?? null))
              }
            />

            <button className="btn" onClick={() => ledgerInput.current?.click()}>
              Select Ledger Folder
            </button>
            <input
              ref={ledgerInput}
              type="file"
              accept=".xlsx,.xls,.csv"
              multiple
              hidden
              onChange={(e) =>
                pickUpload(() => setLedgerFiles(Array.from(e.target.files ?? [])))
              }
            />

            <button className="btn" onClick={() => siInput.current?.click()}>
              Select SI Folder / Index
            </button>
            <input
              ref={siInput}
              type="file"
              accept=".xlsx,.xls,.csv,.pdf"
              multiple
              hidden
              onChange={(e) =>
                pickUpload(() => setSiFiles(Array.from(e.target.files ?? [])))
              }
            />

            <span className="spacer" />

            <button className="btn btn-ghost" onClick={loadSample}>
              Load Sample Data
            </button>
            <button className="btn btn-ghost" onClick={loadConnectors}>
              Auto-Extract (Mock SAP/NOAH)
            </button>
            <button
              className="btn btn-ghost"
              onClick={async () =>
                downloadBlob(
                  await buildSampleInputsZip(sampleInput),
                  "SILEA_sample_inputs.zip",
                )
              }
            >
              Download Sample Inputs
            </button>
          </div>

          <ul className="filelist">
            <li>
              <span
                className={
                  source === "sample" || source === "connectors" || accountFile
                    ? "ok"
                    : "muted"
                }
              >
                {source === "sample"
                  ? "Sample dataset (5 accounts)"
                  : source === "connectors"
                    ? `Mock connectors: SAP → NOAH → SI${accountFile ? ` (account list: ${accountFile.name})` : " (5 sample accounts)"}`
                    : accountFile
                      ? `Account list: ${accountFile.name}`
                      : "Account list: not selected"}
              </span>
            </li>
            {source === "upload" && (
              <>
                <li className={ledgerFiles.length ? "ok" : "muted"}>
                  Ledger files: {ledgerFiles.length || "none"}
                </li>
                <li className={siFiles.length ? "ok" : "muted"}>
                  SI files/index: {siFiles.length || "none"}
                </li>
              </>
            )}
          </ul>
        </section>

        {/* Step 2 — process */}
        <section className="panel">
          <h2>2 · Process</h2>
          <div className="controls">
            <button
              className="btn btn-primary"
              disabled={!canProcess || processing}
              onClick={startProcessing}
            >
              {processing ? "Processing…" : "Start Processing"}
            </button>
            {results && (
              <button
                className="btn"
                onClick={() => setTab(tab === "all" ? "exceptions" : "all")}
              >
                {tab === "all"
                  ? `Review Exceptions (${exceptionCount})`
                  : "Show All Accounts"}
              </button>
            )}
          </div>

          {(processing || progress.total > 0) && (
            <div className="progress">
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${pct}%` }} />
              </div>
              <div className="progress-meta">
                {progress.done} / {progress.total} accounts processed
              </div>
              <div className="progress-counts">
                {ALL_STATUSES.filter((s) => progress.counts[s] > 0).map((s) => (
                  <span key={s} className="count-pill">
                    {progress.counts[s]} · {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {error && <div className="alert alert-bad">⚠ {error}</div>}
          {message && <div className="alert alert-info">{message}</div>}
          {warnings.length > 0 && (
            <div className="alert alert-warn">
              <strong>Connector warnings ({warnings.length}):</strong>
              <ul className="warn-list">
                {warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* Step 3 — results */}
        {results && (
          <section className="panel">
            <h2>3 · Results</h2>
            <SummaryCards results={results} />

            <div className="controls">
              <button
                className="btn"
                onClick={() =>
                  downloadBlob(
                    buildTrackerWorkbook(results),
                    `working_tracker_${today()}.xlsx`,
                  )
                }
              >
                Download Tracker
              </button>
              <button
                className="btn"
                onClick={() =>
                  downloadBlob(
                    buildExceptionsWorkbook(results),
                    `exceptions_${today()}.xlsx`,
                  )
                }
              >
                Download Exceptions
              </button>
              <button
                className="btn"
                onClick={() =>
                  downloadBlob(
                    buildSummaryWorkbook(results),
                    `summary_report_${today()}.xlsx`,
                  )
                }
              >
                Download Summary Report
              </button>
              <button
                className="btn"
                onClick={() =>
                  downloadBlob(
                    buildAuditCsv(results, USER),
                    `audit_log_${today()}.csv`,
                  )
                }
              >
                Download Audit Log
              </button>
              <span className="spacer" />
              <button
                className="btn btn-primary"
                disabled={completeCount === 0}
                onClick={prepareSubmission}
              >
                Prepare Consultant Submission ({completeCount})
              </button>
            </div>

            <ResultsTable results={results} exceptionsOnly={tab === "exceptions"} />
          </section>
        )}

        <footer className="foot">
          <p>
            Phase 1 (matching &amp; exception engine) + Phase 2 (UI) per the SILEA
            functional spec. SAP, NOAH and the SI Retrieval App connectors (Phases 3–6)
            are intentionally out of scope and stubbed. The program never guesses:
            ambiguous cases are flagged <em>For Manual Review</em>, never marked complete.
          </p>
        </footer>
      </main>
    </div>
  );
}
