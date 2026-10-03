"""
codebook - loads shared/codebook.v1.json, the machine-readable copy of
docs/pipeline/CODEBOOK.md (tests/test_codebook_v1.py keeps the two equal).

Every definition, key, review question, threshold and metric the engine uses
comes from here; football constants are never hard-coded elsewhere.
"""

import hashlib
import json
from functools import lru_cache
from pathlib import Path

CODEBOOK_PATH = Path(__file__).resolve().parents[1] / "shared" / "codebook.v1.json"


@lru_cache(maxsize=1)
def load_codebook() -> dict:
    return json.loads(CODEBOOK_PATH.read_text(encoding="utf-8"))


def codebook_sha256() -> str:
    return hashlib.sha256(CODEBOOK_PATH.read_bytes()).hexdigest()
