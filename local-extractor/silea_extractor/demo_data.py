"""Canned demo dataset — mirrors the 5 fixtures in ../../src/engine/fixtures.ts
(SPEC §12). Used by ``cli.py --demo`` to emit real input files (CSV) with zero
SAP/NOAH access, so the local extractor's output shape can be exercised on any
OS and fed straight into the web app to reproduce the five statuses.
"""

from __future__ import annotations

from typing import Dict, List, Tuple

# account rows: (account_id, client, project, unit, current, prev1, prev2, plan)
ACCOUNTS: List[Tuple] = [
    ("MAVEN-10A-JDC", "Juan Dela Cruz", "Maven", "10-A", "CN-A-CUR", "", "", "RF"),
    ("SOLARA-05B-MRC", "Maria Reyes Cruz", "Solara", "05-B", "CN-B-CUR", "CN-B-PREV", "", "RF"),
    ("VERDE-22C-LPH", "Luis Perez Hernandez", "Verde", "22-C", "CN-C-CUR", "CN-C-PREV1", "CN-C-PREV2", "RF"),
    ("AURORA-14D-KTS", "Katrina Santos", "Aurora", "14-D", "CN-D-CUR", "CN-D-PREV", "", "12MA"),
    ("MAVEN-33E-RGL", "Ramon Garcia Lim", "Maven", "33-E", "CN-E-CUR", "", "", "RF"),
]

# contract_no -> (project, unit, client_initials, [ (date, amount, or_number), ... ])
# NB: CN-D-PREV is intentionally absent → engine flags "Missing Ledger File".
LEDGERS: Dict[str, Tuple] = {
    "CN-A-CUR": ("Maven", "10-A", "JDC", [
        ("2024-01-15", 50000, "OR-A1"),
        ("2024-02-15", 50000, "OR-A2"),
        ("2024-03-15", 50000, "OR-A3"),
    ]),
    "CN-B-PREV": ("Solara", "05-B", "MRC", [("2023-11-10", 30000, "OR-B0")]),
    "CN-B-CUR": ("Solara", "05-B", "MRC", [
        ("2024-01-10", 30000, ""),
        ("2024-02-10", 30000, "OR-B1"),
        ("2024-03-10", 30000, "OR-B2"),
    ]),
    "CN-C-PREV1": ("Verde", "22-C", "LPH", [("2023-06-01", 40000, "OR-C-P1")]),
    "CN-C-PREV2": ("Verde", "22-C", "LPH", [("2023-09-01", 45000, "OR-C-P2")]),
    "CN-C-CUR": ("Verde", "22-C", "LPH", [
        ("2024-01-05", 99999, ""),
        ("2024-02-05", 40000, "OR-C1"),
    ]),
    "CN-D-CUR": ("Aurora", "14-D", "KTS", [
        ("2024-01-20", 60000, "OR-D1"),
        ("2024-02-20", 60000, "OR-D2"),
    ]),
    "CN-E-CUR": ("Maven", "33-E", "RGL", [
        ("2024-01-08", 25000, "OR-E1"),
        ("2024-02-08", 25000, "OR-E2"),
        ("2024-03-08", 25000, "OR-E2"),
        ("2024-04-08", 25000, "OR-E3"),
    ]),
}

# or_number -> retrieved
SIS: Dict[str, bool] = {
    "OR-A1": True, "OR-A2": True, "OR-A3": True,
    "OR-B0": True, "OR-B1": True, "OR-B2": True,
    "OR-C-P1": True, "OR-C-P2": True, "OR-C1": True,
    "OR-D1": True, "OR-D2": True,
    "OR-E1": True, "OR-E2": True, "OR-E3": True,
}
