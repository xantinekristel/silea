"""Shared data types for the SILEA local extractor.

These mirror the TypeScript engine's data model (see ../../src/engine/types.ts,
SPEC.md §5) so the files this extractor produces drop straight into the web /
engine pipeline.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Optional


@dataclass
class Account:
    account_id: str
    client_name: str
    project: str
    unit: str
    current_contract_no: str
    previous_contract_no_1: Optional[str] = None
    previous_contract_no_2: Optional[str] = None
    plan_type: str = "RF"  # RF | 12MA | LS

    def contract_numbers(self) -> List[str]:
        return [
            c
            for c in (
                self.current_contract_no,
                self.previous_contract_no_1,
                self.previous_contract_no_2,
            )
            if c and c.strip()
        ]


@dataclass
class LedgerExport:
    account_id: str
    contract_no: str
    file_path: str
    source_url: Optional[str] = None


@dataclass
class SIRecord:
    or_number: str
    si_file_path: Optional[str]
    retrieved: bool
    si_url: Optional[str] = None


@dataclass
class ExtractionResult:
    ledgers: List[LedgerExport] = field(default_factory=list)
    sis: List[SIRecord] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
