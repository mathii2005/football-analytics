"""
ingestion - this file is only for loading matches from raw json files

"""

import json
from pathlib import Path

RAW_JSON_DIR = Path("data/raw")

def find_match_file(match_id:str) -> Path:
    candidates = sorted(RAW_JSON_DIR.glob(f"*{match_id}*.json"))

    if not candidates:
        raise FileNotFoundError(f"File '{match_id}' does not exist in {RAW_JSON_DIR}")

    if len(candidates) > 1:
        raise ValueError(f"File '{match_id}' has multiple matches in {RAW_JSON_DIR}")

    return candidates[0]


def load_match(match_id:str) -> dict:
    file_path = find_match_file(match_id)
    with open(file_path, "r") as f:
        return json.load(f)


def get_events(match_data:dict) -> list[dict]:
    return match_data.get("events", [])



