"""SILEA local extractor — orchestrator entry point (Phase 6 skeleton).

Two modes:

  --demo   Cross-platform. Writes canned input files (account list, ledgers,
           SI index as CSV) into --out, matching SPEC §12. No SAP/NOAH needed.
           Feed the result to the web app to reproduce the five statuses.

  (live)   Windows only, IT-approved. Reads a real account list, runs
           SAP (ZRGCSTAT) → NOAH (ledger export) → SI Retrieval App, and writes
           the same file layout. Requires SAP GUI + Playwright + network access
           to NOAH and cannot run in a cloud sandbox (SPEC §4, §10).

Both modes emit the SPEC §7 folder layout so the output plugs straight into the
matching engine / web UI.
"""

from __future__ import annotations

import argparse
import csv
import os
import sys
from typing import List

from . import demo_data
from .models import Account


def _safe(part: str) -> str:
    import re

    return re.sub(r"[^A-Za-z0-9.-]+", "_", part).strip("_")


def _ledger_filename(project: str, unit: str, client_initials: str, contract_no: str) -> str:
    return f"{_safe(project)}_{_safe(unit)}_{_safe(client_initials)}_{_safe(contract_no)}_Ledger.csv"


def write_demo_output(out_dir: str) -> None:
    ledger_dir = os.path.join(out_dir, "Ledgers")
    os.makedirs(ledger_dir, exist_ok=True)

    # Account list.
    with open(os.path.join(out_dir, "account_list.csv"), "w", newline="") as f:
        w = csv.writer(f)
        w.writerow([
            "account_id", "client_name", "project", "unit",
            "current_contract_no", "previous_contract_no_1",
            "previous_contract_no_2", "plan_type",
        ])
        w.writerows(demo_data.ACCOUNTS)

    # One ledger CSV per contract (SPEC §7 naming).
    for contract_no, (project, unit, initials, rows) in demo_data.LEDGERS.items():
        name = _ledger_filename(project, unit, initials, contract_no)
        with open(os.path.join(ledger_dir, name), "w", newline="") as f:
            w = csv.writer(f)
            w.writerow(["contract_no", "payment_date", "amount", "or_number"])
            for date, amount, orn in rows:
                w.writerow([contract_no, date, amount, orn])

    # SI index.
    with open(os.path.join(out_dir, "si_index.csv"), "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["or_number", "si_file_path", "retrieved"])
        for orn, retrieved in demo_data.SIS.items():
            w.writerow([orn, f"SIs/{orn}_SI.pdf" if retrieved else "", retrieved])

    print(f"Demo input files written to: {os.path.abspath(out_dir)}")
    print("  account_list.csv, Ledgers/*.csv, si_index.csv")
    print("Upload these to the SILEA web app (Select Account List / Ledger Folder /")
    print("SI Folder-Index) to reproduce the five SPEC §12 statuses.")


def read_account_list(path: str) -> List[Account]:
    accounts: List[Account] = []
    with open(path, newline="") as f:
        for row in csv.DictReader(f):
            norm = {k.strip().lower().replace(" ", "_"): (v or "").strip() for k, v in row.items()}
            if not norm.get("account_id"):
                continue
            accounts.append(
                Account(
                    account_id=norm["account_id"],
                    client_name=norm.get("client_name", ""),
                    project=norm.get("project", ""),
                    unit=norm.get("unit", ""),
                    current_contract_no=norm.get("current_contract_no", ""),
                    previous_contract_no_1=norm.get("previous_contract_no_1") or None,
                    previous_contract_no_2=norm.get("previous_contract_no_2") or None,
                    plan_type=norm.get("plan_type", "RF") or "RF",
                )
            )
    return accounts


def run_live(args: argparse.Namespace) -> int:  # pragma: no cover - Windows/IT only
    from .noah_connector import LiveNoahConnector
    from .si_connector import build_si_index_from_folder

    if not args.accounts:
        print("Live mode requires --accounts <account_list.csv>", file=sys.stderr)
        return 2

    accounts = read_account_list(args.accounts)
    ledger_dir = os.path.join(args.out, "Ledgers")
    os.makedirs(ledger_dir, exist_ok=True)
    warnings: List[str] = []

    with LiveNoahConnector(cdp_url=args.cdp) as noah:
        for account in accounts:
            for contract_no in account.contract_numbers():
                export = noah.fetch_ledger(account, contract_no, ledger_dir)
                if export is None:
                    warnings.append(
                        f"{account.account_id} / {contract_no}: NOAH identity mismatch "
                        "or not found — skipped (never guess)."
                    )

    # SI index from a manually populated SIs/ folder (until §10 Q6 is answered).
    si_dir = os.path.join(args.out, "SIs")
    sis = build_si_index_from_folder(si_dir) if os.path.isdir(si_dir) else []
    with open(os.path.join(args.out, "si_index.csv"), "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["or_number", "si_file_path", "retrieved"])
        for s in sis:
            w.writerow([s.or_number, s.si_file_path or "", s.retrieved])

    for msg in warnings:
        print("WARNING:", msg)
    print(f"Live extraction wrote ledgers + si_index.csv to {os.path.abspath(args.out)}")
    return 0


def main(argv: List[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="silea-extract", description=__doc__)
    parser.add_argument("--demo", action="store_true", help="write canned demo input files (any OS)")
    parser.add_argument("--accounts", help="path to account list CSV (live mode)")
    parser.add_argument("--out", default="extractor_output", help="output directory")
    parser.add_argument("--cdp", default="http://localhost:9222", help="NOAH browser CDP URL (live mode)")
    args = parser.parse_args(argv)

    os.makedirs(args.out, exist_ok=True)
    if args.demo:
        write_demo_output(args.out)
        return 0
    return run_live(args)


if __name__ == "__main__":
    raise SystemExit(main())
