# SILEA Local Extractor (Phases 3–5)

The **data-acquisition** half of SILEA: the connectors that pull the source
files from **SAP**, **NOAH**, and the **SI Retrieval App**. Its output feeds the
matching engine / web UI in the parent repo.

> ⚠️ **This is a scaffold, and it is local-only by nature.** It cannot run on
> Netlify, in GitHub Actions, or in any cloud sandbox — a hosted web page
> physically cannot drive SAP GUI or reach NOAH on your internal network. Per
> `SPEC.md §4/§10`, the live connectors require a **Windows machine with SAP
> GUI**, **network access to NOAH**, and **written IT approval** before any of
> this is wired to real systems. The code here compiles and the `--demo` mode
> runs anywhere, but the live SAP/NOAH paths are unverified placeholders whose
> transaction IDs and page selectors must be confirmed on-site.

## Why it's separate from the web app

| | Web app (parent repo) | Local extractor (this folder) |
|---|---|---|
| Runs where | Any browser, Netlify, cloud | A staff Windows machine, on-network |
| Does | Match / validate / package (Phase 1–2) | Acquire files from SAP/NOAH/SI (Phase 3–5) |
| Needs IT approval | No | **Yes** (SPEC §10) |
| Handles credentials | None | **None** — attaches to sessions you log into by hand |

The two connect through files: the extractor writes the `SPEC §7` folder layout
(account list, `Ledgers/*.xlsx`, `si_index`), and the web app consumes it.

## Try it now (any OS, no SAP/NOAH)

```bash
cd local-extractor
python -m silea_extractor.cli --demo --out ./extractor_output
```

This writes `account_list.csv`, `Ledgers/*.csv`, and `si_index.csv` mirroring
the five `SPEC §12` fixtures. Upload those three into the web app
(**Select Account List / Ledger Folder / SI Folder-Index**) and you'll get the
same five statuses the engine tests assert.

## Live mode (Windows, after IT sign-off)

```bash
pip install -r requirements.txt
playwright install

# 1) Log in to SAP GUI by hand. Log in to NOAH in a browser started with:
#      msedge.exe --remote-debugging-port=9222
# 2) Run:
python -m silea_extractor.cli --accounts account_list.csv --out ./out --cdp http://localhost:9222
```

The connectors **attach to those already-authenticated sessions** — they never
store or type a password.

## Layout

```
silea_extractor/
  models.py          data types mirroring the engine (SPEC §5)
  connectors.py      Sap/Noah/Si connector Protocols (the seam)
  sap_connector.py   Phase 3 — SAP GUI Scripting (ZRGCSTAT, Buyers Only)
  noah_connector.py  Phase 4 — Playwright, verifies identity before accepting
  si_connector.py    Phase 5 — folder-based index now; scripted input pending
  demo_data.py       canned 5-account dataset (SPEC §12)
  cli.py             orchestrator: SAP → NOAH → SI → SPEC §7 output
```

## Before wiring live connectors — IT must answer (SPEC §10)

1. Is SAP GUI Scripting enabled, or can it be for designated users?
2. May **ZRGCSTAT** specifically be automated?
3. Is exporting SAP reports to Excel permitted for this use case?
4. Dedicated automation account, or attach to the staff member's own session?
5. Is NOAH reachable via modern Chromium/Edge and visible to Playwright — or
   does it need IE-compatibility / remote desktop (→ Power Automate Desktop
   fallback)?
6. Does the SI Retrieval App accept any scripted/batch input?

**Do not begin live wiring until these are answered in writing.**
