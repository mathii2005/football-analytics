"""
gates - integrity checks run before any number is shown (CODEBOOK §11).

    G1 schema 1.x, codebook version known, sha256 matches when the export
       carries one                                          -> blocks the report
    G2 goals from C presses = the score shown in the tagger (goals + manual
       corrections), and = meta.final_score when present    -> blocks
    G3 Veo link and kickoff offset for every tagged half, and the 3-moment
       check done                                           -> blocks clip links only
    G4 segments in order, no negative durations             -> blocks
    G5 US + THEM + DEAD + UNKNOWN time = half length +/- 3 min, per half
                                                            -> blocks
"""

from src.codebook import load_codebook, codebook_sha256

TOLERANCE_MS = 3 * 60 * 1000


def _gate(id_, ok, detail, blocking=True, scope="report"):
    return {"id": id_, "ok": bool(ok), "blocking": blocking, "scope": scope, "detail": detail}


def integrity_gates(raw: dict, tl) -> list[dict]:
    cb = load_codebook()
    meta = raw.get("meta") or {}
    out = []

    version = raw.get("codebook_version") or meta.get("codebook_version")
    sha = meta.get("codebook_sha256")
    ok1 = str(raw.get("schema_version", "")).startswith("1.") and str(version).split(".")[0] == cb["version"].split(".")[0] \
        and (sha is None or sha == codebook_sha256())
    out.append(_gate("G1", ok1, f"schéma {raw.get('schema_version')}, codebook {version}"))

    shown = {k: tl.score[k] + tl.score_fixes[k] for k in tl.score}
    final = meta.get("final_score")
    ok2 = shown == tl.score and (not final or (final.get("us"), final.get("them")) == (tl.score["US"], tl.score["THEM"]))
    out.append(_gate("G2", ok2, f"buts tagués {tl.score['US']}-{tl.score['THEM']}, score affiché {shown['US']}-{shown['THEM']}"))

    veo = meta.get("veo") or {}
    offsets = {1: veo.get("offset_h1_ms"), 2: veo.get("offset_h2_ms")}
    missing = [h for h in tl.halves if offsets.get(h) is None]
    ok3 = bool(veo.get("url")) and not missing and veo.get("checked")
    detail3 = "lien Veo manquant" if not veo.get("url") else f"décalage manquant MT{missing}" if missing else \
        "vérification des 3 moments à faire" if not veo.get("checked") else "ok"
    out.append(_gate("G3", ok3, detail3, scope="clips"))

    bad = [s for s in tl.states if s.end < s.start] + \
          [b for a, b in zip(tl.states, tl.states[1:]) if a.half == b.half and b.start < a.end]
    out.append(_gate("G4", not bad, f"{len(bad)} segment(s) incohérent(s)"))

    issues = []
    for half, (start, end) in tl.halves.items():
        covered = sum(s.end - s.start for s in tl.states if s.half == half)
        if abs(covered - (end - start)) > TOLERANCE_MS:
            issues.append(f"MT{half}: {covered / 60000:.1f} min sur {(end - start) / 60000:.1f}")
    out.append(_gate("G5", not issues, "; ".join(issues) or "ok"))
    return out


def blocked(gates: list[dict], scope="report") -> bool:
    return any(g["blocking"] and not g["ok"] and g["scope"] == scope for g in gates)
