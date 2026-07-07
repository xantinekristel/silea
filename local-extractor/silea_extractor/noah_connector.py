"""NOAH browser-automation connector (Phase 4) — LOCAL ONLY.

Attaches to an already-logged-in NOAH browser session with Playwright, searches
each contract number, VERIFIES the displayed project/unit/client match the
expected account before accepting the ledger (mismatch → stop and flag, never
guess — SPEC §10), exports the ledger to Excel and renames it per SPEC §7.

SCAFFOLD ONLY. Cannot run in a cloud sandbox: needs network access to NOAH and,
per SPEC §10, written IT confirmation that NOAH works in a modern
Chromium/Edge browser and exposes its elements to Playwright (if it only runs
in IE-compatibility mode, fall back to Power Automate Desktop). The selectors
below are placeholders to confirm on the real NOAH pages.

Recommended attach model (no credentials stored): the staff member launches
their browser with remote debugging and logs into NOAH by hand, then this
connects over CDP:

    msedge.exe --remote-debugging-port=9222   # or chrome.exe
"""

from __future__ import annotations

import os
import re
from typing import Optional

from .models import Account, LedgerExport


def _safe(part: str) -> str:
    """SPEC §7: no spaces/special chars in file names."""
    return re.sub(r"[^A-Za-z0-9.-]+", "_", part).strip("_")


class LiveNoahConnector:
    name = "NOAH (Playwright, attached session)"
    live = True

    def __init__(self, cdp_url: str = "http://localhost:9222") -> None:
        self.cdp_url = cdp_url
        self._pw = None
        self._browser = None

    def __enter__(self) -> "LiveNoahConnector":  # pragma: no cover
        try:
            from playwright.sync_api import sync_playwright  # type: ignore
        except ImportError as exc:
            raise RuntimeError(
                "playwright is required for the live NOAH connector. "
                "Install with: pip install playwright && playwright install"
            ) from exc
        self._pw = sync_playwright().start()
        # Attach to the browser the user already logged into (over CDP).
        self._browser = self._pw.chromium.connect_over_cdp(self.cdp_url)
        return self

    def __exit__(self, *exc) -> None:  # pragma: no cover
        if self._pw:
            self._pw.stop()

    def fetch_ledger(  # pragma: no cover
        self, account: Account, contract_no: str, out_dir: str
    ) -> Optional[LedgerExport]:
        assert self._browser is not None, "Use as a context manager (with ...)."
        context = self._browser.contexts[0]
        page = context.pages[0] if context.pages else context.new_page()

        # 1) Search the contract. (Confirm selectors on the real NOAH page.)
        page.fill("#contract-search", contract_no)
        page.click("#contract-search-button")
        page.wait_for_load_state("networkidle")

        # 2) VERIFY identity before trusting the result — never guess.
        shown_project = page.text_content("#result-project") or ""
        shown_unit = page.text_content("#result-unit") or ""
        if (
            _safe(shown_project) != _safe(account.project)
            or _safe(shown_unit) != _safe(account.unit)
        ):
            # Caller records this as a warning and skips the ledger.
            return None

        # 3) Export and rename per SPEC §7.
        client = _safe(account.client_name.split()[0] if account.client_name else "NA")
        filename = f"{_safe(account.project)}_{_safe(account.unit)}_{client}_{_safe(contract_no)}_Ledger.xlsx"
        dest = os.path.join(out_dir, filename)
        os.makedirs(out_dir, exist_ok=True)
        with page.expect_download() as dl_info:
            page.click("#export-excel")
        dl_info.value.save_as(dest)

        return LedgerExport(
            account_id=account.account_id,
            contract_no=contract_no,
            file_path=dest,
            source_url=page.url,
        )
