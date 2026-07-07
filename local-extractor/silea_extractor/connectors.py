"""Connector interfaces for the local extractor (SPEC §10, §11).

Mirrors the TypeScript connector seam in ../../src/connectors. Real
implementations live in sap_connector.py / noah_connector.py / si_connector.py
and only work on a local Windows machine with the relevant access. Nothing here
stores credentials — every adapter attaches to a session the staff member has
already logged into by hand.
"""

from __future__ import annotations

from typing import List, Protocol

from .models import Account, LedgerExport, SIRecord


class SapConnector(Protocol):
    name: str
    live: bool

    def fetch_contracts(self, account_ids: List[str]) -> List[Account]:
        """Run ZRGCSTAT (Buyers Only) and return contract numbers per account."""
        ...


class NoahConnector(Protocol):
    name: str
    live: bool

    def fetch_ledger(
        self, account: Account, contract_no: str, out_dir: str
    ) -> LedgerExport | None:
        """Search a contract in NOAH, verify identity, export the ledger.

        MUST verify the displayed project/unit/client match ``account`` before
        accepting the ledger; on mismatch it returns ``None`` and records a
        warning rather than guessing (SPEC §10).
        """
        ...


class SiConnector(Protocol):
    name: str
    live: bool

    def retrieve_sis(self, or_numbers: List[str], out_dir: str) -> List[SIRecord]:
        """Enter OR numbers into the SI Retrieval App and report retrieval."""
        ...
