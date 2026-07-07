"""SI Retrieval App connector (Phase 5) — SCAFFOLD / LOCAL ONLY.

Enters OR numbers into the SI Retrieval App and reports which SIs were
retrieved. Whether this can be automated at all depends on IT's answer to
SPEC §10 question 6 ("Does the SI Retrieval App accept any form of
scripted/batch input?"). Until that's confirmed, the recommended interim flow
is manual: staff enter ORs and drop the retrieved SI PDFs into an ``SIs/``
folder named ``{ORNumber}_SI.pdf`` (SPEC §7); ``build_si_index_from_folder``
below turns that folder into the index the engine consumes.
"""

from __future__ import annotations

import glob
import os
from typing import List

from .models import SIRecord


def build_si_index_from_folder(si_dir: str) -> List[SIRecord]:
    """Turn a folder of ``{ORNumber}_SI.pdf`` files into SI records."""
    records: List[SIRecord] = []
    for path in glob.glob(os.path.join(si_dir, "*.pdf")):
        base = os.path.splitext(os.path.basename(path))[0]
        or_number = base[:-3] if base.lower().endswith("_si") else base
        records.append(
            SIRecord(or_number=or_number, si_file_path=path, retrieved=True)
        )
    return records


class LiveSiConnector:  # pragma: no cover - depends on IT confirmation
    name = "SI Retrieval App (scripted)"
    live = True

    def __init__(self, out_dir: str) -> None:
        self.out_dir = out_dir

    def retrieve_sis(self, or_numbers: List[str], out_dir: str) -> List[SIRecord]:
        raise NotImplementedError(
            "SI Retrieval App scripting is pending IT confirmation (SPEC §10 Q6). "
            "Use build_si_index_from_folder() with a manually populated SIs/ folder "
            "in the meantime."
        )
