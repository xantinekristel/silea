# SILEA — SI Ledger Extraction & Automation Tool

A web app that automates the **Statement of Installment (SI) vs. customer
ledger reconciliation** DCMG staff perform before consultant submission. It
implements **Phase 1** (matching & exception engine) and **Phase 2** (staff UI)
of the functional spec in [`SPEC.md`](./SPEC.md).

Everything runs **client-side in the browser** — files you pick never leave the
page, there are no credentials, and there is no backend. That is what makes it
deployable as a plain static site on GitHub / Netlify and runnable in a cloud
sandbox today.

## What it does

Give it three things (or click **Load Sample Data** to try instantly):

1. **Account list** — Excel/CSV, one row per account (`SPEC §5.1`).
2. **Ledger files** — one Excel file per contract number (`SPEC §7`).
3. **SI folder / index** — Excel/CSV listing which OR numbers have a retrieved
   SI, or a folder of `{ORNumber}_SI.pdf` files.

Click **Start Processing** and SILEA:

- Resolves each account's contract numbers (current + up to 2 previous).
- Loads the matching ledgers and parses every payment row.
- Matches each payment's OR number against the SI index.
- Applies the plan-type rules (RF / 12MA implemented; LS stubbed → manual review).
- Rolls everything up into one status per account using the **exact** taxonomy
  from `SPEC §6.3`.

It **never guesses**: anything ambiguous is flagged, never silently marked
complete.

### Outputs (all downloadable, nothing sent externally)

- **Tracker** (`working_tracker_*.xlsx`) — one row per account with status,
  reason and file references.
- **Exceptions** (`exceptions_*.xlsx`) — non-complete accounts grouped by status.
- **Summary report** (`summary_report_*.xlsx`) — counts per status.
- **Audit log** (`audit_log_*.csv`) — `SPEC §9`.
- **Consultant submission** (`Consultant_Submission_*.zip`) — `Complete` accounts
  only, `Output/{Project}/{Unit}/` with a `manifest.json`. Requires an explicit
  confirmation click and is **never** sent for you.

## The five spec fixtures

`SPEC §12` defines five test accounts; the engine is written to produce exactly
these results, locked in by `src/engine/engine.test.ts`:

| Account | Expected status |
|---|---|
| A | Complete – Ready for Submission |
| B | Complete (no-OR first payment covered by previous ledger) |
| C | For B&C Validation |
| D | Missing Ledger File |
| E | Payment Count Mismatch |

## Run locally

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # engine fixture tests
npm run build    # type-check + production build to dist/
```

## Deploy

### Netlify (recommended — auto-deploy from GitHub)

1. Push this repo to GitHub (already done if you're reading this there).
2. In Netlify: **Add new site → Import an existing project → GitHub → `silea`**.
3. Netlify reads [`netlify.toml`](./netlify.toml) automatically:
   - Build command: `npm run build`
   - Publish directory: `dist`
4. Every push to the branch redeploys the site.

### GitHub Pages (alternative)

`vite.config.ts` uses `base: "./"` so the build works from any path. Build with
`npm run build` and publish the `dist/` folder (e.g. via a Pages action).

A CI workflow at [`.github/workflows/ci.yml`](./.github/workflows/ci.yml)
type-checks, builds and runs the tests on every push/PR.

## Architecture

```
src/
  engine/            Phase 1 — framework-agnostic, fully unit-tested
    types.ts         data model + exact status taxonomy (SPEC §5, §6.3)
    engine.ts        the matching / exception logic (SPEC §6.2)
    rules/           pluggable plan-type rules (rf, twelveMa, ls) — SPEC §6.5
    parse.ts         tolerant Excel/CSV readers (SPEC §6.1)
    outputs.ts       tracker / exceptions / summary / audit / submission zip
    fixtures.ts      the 5 dummy accounts (SPEC §12)
    status.ts        severity roll-up + UI tone map
  components/        Phase 2 — React UI (SPEC §8)
  App.tsx            main staff screen
```

### Not in scope (yet)

Phases 3–6 (SAP GUI scripting, NOAH browser automation, SI Retrieval App
connector, full orchestrator) are intentionally **not** built. Per `SPEC §10`
they require IT approval and a local Windows machine. The engine is structured
so those connectors can feed it later without changing the core.

## Business-rule assumptions

A couple of rules are inferred from `SPEC §6.2` where the spec flags them for
DCMG confirmation (`SPEC §14`). They're isolated so they're easy to adjust:

- **Account B** (no-OR first payment matched to a previous ledger) resolves to
  **Complete**. Change in `src/engine/engine.ts`.
- **RF and 12MA** currently share the same expected-count rule
  (`payments − carried-over first payments`). Adjust per plan type in
  `src/engine/rules/`.
- **LS** is deliberately unsupported → every LS account routes to
  **For Manual Review**.
