# SI Ledger Extraction & Automation Tool (SILEA)
### Functional Specification — v1.0
### For: OCLP — Documentation & Contracts Management Group (DCMG)
### Build target: Claude Code (agentic build), phased delivery

---

## 0. How to use this document

This is a single, complete functional spec meant to be dropped into a Claude Code
project folder as `SPEC.md` (or split per phase, see §11). It is written so Claude
Code can:

1. Scaffold the repo.
2. Build Phase 1 fully, end to end, using only sample/dummy files (no live SAP,
   no live NOAH, no live SI Retrieval App — this phase runs in any sandbox,
   including an online/cloud Claude Code environment).
3. Stub Phases 2–4 behind clean interfaces so they can be wired to real systems
   later, on a machine with SAP GUI and network access to NOAH, once IT approves.

**Do not let Claude Code skip straight to SAP/NOAH scripting.** Phase 1 is the
part that delivers immediate time savings and can be demoed with zero IT
dependencies. Everything else is additive.

---

## 1. Problem statement

DCMG staff currently perform the following manually, per account, for the
Statement of Installment (SI) vs. Ledger reconciliation used before consultant
submission:

1. Prepare the account list.
2. Obtain contract numbers from SAP (ZRGCSTAT report, Buyers Only).
3. Identify current vs. previous contract numbers per account.
4. Download the customer ledger from NOAH for every contract number.
5. Save and link the ledger files to the account.
6. Extract OR (Official Receipt) numbers from the ledger's payment rows.
7. Enter OR numbers into the SI Retrieval App.
8. Check whether each SI was successfully retrieved.
9. Compare retrieved SIs against ledger payments.
10. Identify missing SIs / missing OR numbers / mismatches.
11. Package the completed, validated files for consultant submission.

This is repetitive, error-prone at volume, and ties up staff time that should be
spent on actual exceptions, not mechanical checking.

## 2. Goal

Build a Windows-usable tool (desktop app first; web-hosted dashboard optional
later) that automates steps 4–11 completely, and steps 2–3 once IT approves
SAP scripting, so staff only:

- Provide the account list.
- Click **Start Processing**.
- Review a short exceptions queue.
- Approve the consultant submission package.

## 3. Non-goals (explicitly out of scope for v1)

- Replacing SAP, NOAH, or the SI Retrieval App.
- Modifying any source system's data.
- Auto-approving or auto-submitting to the consultant without a human click.
- Handling account types outside RF, 12 MA, and LS installment structures
  (extendable later — see §6.6).

---

## 4. Phasing (build order — do not reorder)

| Phase | Name | What it does | Needs live SAP/NOAH? | Runs in cloud sandbox? |
|---|---|---|---|---|
| **1** | Matching & Exception Engine | Reads account list + SAP export + ledger files + SI files (all provided as sample Excel/CSV) → matches, validates, flags exceptions, builds tracker + submission package | No | **Yes — build & fully test this first** |
| **2** | Desktop Shell / UI | Wraps Phase 1 in the simple staff-facing screen (§8) | No | Yes |
| **3** | SAP GUI Scripting connector | Automates ZRGCSTAT extraction from an already-logged-in SAP session | Yes (local Windows + SAP GUI) | No — requires local machine |
| **4** | NOAH browser automation connector | Automates ledger search/export from an already-logged-in NOAH session | Yes (network access to NOAH) | No — requires local machine + IT approval |
| **5** | SI Retrieval App connector | Automates OR entry + SI retrieval, if the app supports scripted input | Yes | Depends on app |
| **6** | Full Orchestrator | Chains Phases 3→4→5→1 into one click-through run | Yes | No |

Claude Code should treat Phases 1–2 as the deliverable for this sprint. Phases
3–6 get their own spec files later (§11), written only after IT confirms SAP
GUI Scripting and NOAH's browser-compatibility (see §10 — Questions for IT).

---

## 5. Data model

### 5.1 Account
| Field | Type | Notes |
|---|---|---|
| account_id | string | Primary key, e.g. `MAVEN-10A-JDC` |
| client_name | string | |
| project | string | e.g. `Maven` |
| unit | string | e.g. `10-A` |
| current_contract_no | string | SAP contract number |
| previous_contract_no_1 | string \| null | |
| previous_contract_no_2 | string \| null | Max 2 previous contracts supported in v1 |
| plan_type | enum | `RF` \| `12MA` \| `LS` |

### 5.2 Ledger
| Field | Type | Notes |
|---|---|---|
| ledger_id | string | |
| account_id | string | FK → Account |
| contract_no | string | which contract this ledger belongs to |
| file_path | string | local path to the ledger Excel file |
| payments | Payment[] | parsed rows |

### 5.3 Payment (row inside a ledger)
| Field | Type | Notes |
|---|---|---|
| payment_date | date | |
| amount | number | |
| or_number | string \| null | null = missing OR, a known exception case |
| source_contract_no | string | which ledger this payment came from |

### 5.4 SI (Statement of Installment record retrieved from SI Retrieval App)
| Field | Type | Notes |
|---|---|---|
| or_number | string | join key back to Payment |
| si_file_path | string \| null | null = SI not retrieved |
| retrieved | boolean | |

### 5.5 AccountResult (computed)
| Field | Type | Notes |
|---|---|---|
| account_id | string | |
| status | enum | see §6.3 status taxonomy |
| reason | string | human-readable explanation |
| missing_or_numbers | Payment[] | |
| missing_sis | string[] | OR numbers with no SI |
| payment_count | number | |
| si_count | number | |

---

## 6. Functional requirements — Phase 1 (Matching & Exception Engine)

### 6.1 Inputs
1. **Account list** (Excel/CSV) — one row per account, columns matching §5.1.
2. **SAP export** (ZRGCSTAT-style Excel) — used to cross-check contract numbers
   found in the account list (sample file, PII removed, provided by user).
3. **Ledger files** — one Excel file per contract number, following the naming
   convention in §7.
4. **SI files / SI index** — a folder or index file listing which OR numbers
   have a retrieved SI file, and the path to each.

### 6.2 Processing steps (per account)
1. Load the account record.
2. Resolve the full list of contract numbers for the account (current +
   previous 1 + previous 2, skipping nulls).
3. Load each corresponding ledger file. If a ledger file is missing for a
   contract number that the account list says should exist → flag
   `Missing Ledger File`.
4. Parse all payment rows from all ledgers belonging to the account.
5. For each payment:
   - If it has an OR number, look it up in the SI index.
     - Found + file exists → mark `SI Present`.
     - Found in index but `retrieved = false` or file missing → `Missing SI`.
     - Not found at all → `Missing SI`.
   - If it has **no** OR number:
     - If this is the **first payment** and there is a previous-contract
       ledger available → check the previous ledger for a matching entry
       before flagging.
     - If this is the first payment and there is **no** previous contract
       ledger → flag `For B&C Validation` (per current manual procedure).
     - Otherwise → flag `Missing OR Number`.
6. Compare total payment count vs. total SI count for the account.
   - Mismatch (and not otherwise explained by 6.5's OR/SI flags) →
     `Payment Count Mismatch`.
7. Roll up all flags for the account into one `AccountResult` with a single
   top-level status (§6.3), keeping the full detail list for the exceptions
   screen.

### 6.3 Status taxonomy (exact strings — used in UI and reports)

| Status | Meaning |
|---|---|
| `Complete – Ready for Submission` | Ledger and required SIs are complete |
| `Missing SI` | OR exists, but the corresponding SI was not retrieved |
| `Missing OR Number` | Payment appears in the ledger without an OR number |
| `For B&C Validation` | B&C must provide or confirm missing information |
| `For Treasury Certification` | Missing SI must be covered by certification |
| `Payment Count Mismatch` | Number of payments and number of SIs do not agree |
| `Missing Ledger File` | Expected ledger file for a contract was not found |
| `Account Not Found in NOAH` | (Phase 4+ only, reserved) |
| `For Manual Review` | Program cannot safely determine the correct result |

**Rule: the program never guesses.** Any ambiguous case defaults to
`For Manual Review` rather than being auto-marked complete.

### 6.4 Outputs
1. **Updated Excel tracker** — one row per account, with:
   - Status column (from §6.3)
   - Hyperlinks to each ledger file
   - Hyperlinks to each retrieved SI file
   - A short reason string for any non-complete status
2. **Exceptions report** — filtered view containing only non-`Complete`
   accounts, grouped by status, for staff review.
3. **Consultant submission folder** — auto-created per account
   (`Output/{Project}/{Unit}/`) containing only accounts marked
   `Complete – Ready for Submission`, with ledgers + SIs copied in and a
   manifest file listing contents. **Never auto-sends anything externally —
   staff must click "Prepare Consultant Submission" to generate this folder,
   and a separate explicit action to mark it as sent.**

### 6.5 Plan-type rules (RF / 12MA / LS)
Claude Code should implement this as a **pluggable rules module**
(`rules/rf.py`, `rules/twelve_ma.py`, `rules/ls.py`) rather than hardcoding
logic inline, since the exact expected-payment-count and SI-count rules per
plan type need to be confirmed against DCMG's actual procedure before being
finalized. Ship v1 with RF and 12MA rules matching the manual procedure
described in §6.2; stub LS with a `NotImplementedYet` result that always
routes to `For Manual Review` until confirmed.

### 6.6 Extensibility
- New plan types: add a new rules module, register it, no core changes.
- Third previous contract: schema supports extending to N previous contracts
  later; v1 UI supports 2.

---

## 7. File & folder conventions

```
Project/
  Unit/
    Ledgers/
      {Project}_{Unit}_{Client}_{ContractNumber}_Ledger.xlsx
    SIs/
      {ORNumber}_SI.pdf
Output/
  {Project}/
    {Unit}/
      manifest.json
      (copied ledger + SI files for Complete accounts)
Tracker/
  working_tracker.xlsx   <- the live, updated Excel tracker
Logs/
  audit_log_{date}.csv
  errors/
    {account_id}_{timestamp}.png   <- screenshot on error (Phase 3+ only)
```

File names must not contain spaces (use underscores) or special characters.

---

## 8. UI / Screens (Phase 2)

Simple, non-technical staff-facing screen. No jargon, no visible code.

**Main screen buttons:**
1. **Select Account List** — file picker for the Excel/CSV account list.
2. **Select Ledger Folder** — file picker for the folder containing ledger files.
3. **Select SI Folder / Index** — file picker.
4. **Start Processing** — runs Phase 1 engine end to end.
5. **Review Exceptions** — opens filtered exceptions table with status,
   account, reason, and quick links to open the relevant ledger/SI file.
6. **Prepare Consultant Submission** — builds the Output folder for
   `Complete` accounts only; requires explicit confirmation click.
7. **Download Summary Report** — exports a one-page status summary (counts
   per status).

Progress should show: accounts processed / total, and a live count per
status as it runs, so staff aren't staring at a blank screen.

---

## 9. Non-functional requirements

- **Never guess.** Ambiguous cases → `For Manual Review`, never silently
  marked complete.
- **Resumability.** If interrupted, re-running should skip accounts already
  fully processed and resume from the next one (checkpoint file per run).
- **No overwriting.** Never overwrite an existing valid ledger or SI file.
- **Audit log.** Every run logs: date, user, account, status, and any file
  actions taken, to `Logs/audit_log_{date}.csv`.
- **No credentials in code.** Phase 1–2 need none. Phases 3+ must never store
  SAP/NOAH passwords in source, config, or Excel — see §10.
- **Human approval gate.** Consultant submission package is never sent
  automatically; a person must click to generate it and a separate action to
  mark it "sent."
- **Dummy data first.** All testing in Phase 1–2 uses fictional accounts
  (see §12) before any real client data is loaded.

---

## 10. Phase 3–4 preview: SAP & NOAH automation (build later, not now)

These phases are **not part of this build sprint**, but are documented here
so Claude Code understands where Phase 1's interfaces need to plug in later.

- **SAP (Phase 3):** via SAP GUI Scripting, attaching to an already
  logged-in SAP session (staff logs in manually; the program never stores or
  enters the SAP password). Runs `ZRGCSTAT`, sets Role Category to
  `Buyers Only`, exports to Excel, confirms the file exists.
- **NOAH (Phase 4):** via Playwright browser automation, attaching to an
  already logged-in NOAH session. Searches each contract number, verifies
  displayed project/unit/client match the expected account before accepting
  the ledger (mismatch → stop and flag, never guess), exports to Excel,
  renames per §7's convention.
- **Fallback for both:** Power Automate Desktop, if SAP GUI Scripting or
  Playwright prove incompatible with the actual NOAH webpage (e.g. if NOAH
  only works in legacy IE-compatibility mode).

**Before any of Phase 3–4 work starts, DCMG needs written answers from IT to:**
1. Is SAP GUI Scripting enabled, or can it be enabled for designated users?
2. May ZRGCSTAT specifically be automated?
3. Is exporting SAP reports to Excel permitted for this use case?
4. Is a dedicated automation account required, or can it attach to the
   staff member's own authenticated session?
5. Is NOAH accessible via a modern Chromium/Edge browser, and can Playwright
   see its page elements — or does it require IE-compatibility/remote desktop?
6. Does the SI Retrieval App accept any form of scripted/batch input?

Do not begin Phase 3–4 coding until these are answered.

---

## 11. Suggested repo structure (for Claude Code)

```
silea/
  README.md                 <- points to this SPEC.md
  SPEC.md                   <- this file
  src/
    engine/                 <- Phase 1 matching/exception logic
    rules/                  <- pluggable plan-type rules (rf.py, twelve_ma.py, ls.py)
    io/                      <- Excel/CSV readers-writers, file conventions
    ui/                      <- Phase 2 desktop shell
    connectors/
      sap/                   <- Phase 3, stubbed with a mock adapter for now
      noah/                  <- Phase 4, stubbed with a mock adapter for now
      si_retrieval/          <- Phase 5, stubbed
    orchestrator/            <- Phase 6, stubbed
  tests/
    fixtures/                <- dummy account lists, ledgers, SI index (see §12)
    test_engine.py
  Logs/
  Output/
  Tracker/
```

Mock adapters for `connectors/sap` and `connectors/noah` should return
canned sample data so the full Phase 1 pipeline can be tested end to end
without any live system — this is what makes it runnable in a cloud sandbox
today.

---

## 12. Test plan — dummy accounts (build these fixtures first)

Build fixture data for exactly these five cases before writing engine logic,
then write the engine to make all five pass:

1. **Account A** — one current contract only, all payments have OR numbers,
   all SIs retrieved → expect `Complete – Ready for Submission`.
2. **Account B** — current + one previous contract; first payment (on
   current contract) has no OR number, but a matching entry exists on the
   previous ledger → expect `Complete – Ready for Submission` (or the correct
   status per confirmed business rule — flag for confirmation if unclear).
3. **Account C** — current + two previous contracts; one payment has no OR
   number and no previous ledger covers it → expect `For B&C Validation`.
4. **Account D** — ledger file for the previous contract is missing entirely
   → expect `Missing Ledger File`.
5. **Account E** — payment count and SI count don't match, with no other
   explanatory flag → expect `Payment Count Mismatch`.

Only after all five pass on fixture data should real (but still
non-production, IT-approved) test accounts be tried.

---

## 13. Build instructions to paste into Claude Code

```
Build SILEA (SI Ledger Extraction & Automation Tool), Phase 1 + Phase 2 only,
per SPEC.md in this repo.

Rules:
- Build the matching/exception engine (src/engine, src/rules, src/io) first,
  driven entirely by the five dummy fixtures in tests/fixtures (see SPEC.md §12).
  Do not touch SAP or NOAH yet.
- Stub src/connectors/sap and src/connectors/noah with mock adapters that
  return canned sample data, so the pipeline is fully testable without any
  live system.
- Implement the status taxonomy in SPEC.md §6.3 exactly as written — no
  additional statuses without asking.
- The engine must never silently mark an ambiguous case as Complete. Default
  to "For Manual Review" when uncertain.
- After the engine passes all five fixture tests, build the Phase 2 desktop
  UI per SPEC.md §8.
- Do not implement Phase 3 (SAP), Phase 4 (NOAH), Phase 5 (SI Retrieval App),
  or Phase 6 (orchestrator) yet — leave clean stub interfaces only.
- No credentials anywhere in code, config, or Excel.
- Confirm with me before finalizing any business rule you're inferring
  rather than reading directly from SPEC.md.
```

---

## 14. Open items requiring your confirmation before/while building

- [ ] Exact 12MA and LS expected-payment-count / expected-SI-count rules
      (v1 ships RF + 12MA only, per §6.5).
- [ ] Whether Account B's scenario (missing OR covered by a previous ledger)
      should resolve to `Complete` or a different status — confirm against
      actual DCMG procedure.
- [ ] Preferred tech stack: Python (pandas + openpyxl + a lightweight desktop
      UI like PySide/Tkinter) vs. something else — Python is recommended
      given SAP GUI Scripting and Playwright both have mature Python
      libraries, keeping Phase 3–4 in the same language later.
- [ ] Whether you want a web-hosted version of the Phase 2 UI in addition to
      the desktop app (useful if multiple staff need access without a shared
      machine) — this is a straightforward variation once Phase 1 is solid.
