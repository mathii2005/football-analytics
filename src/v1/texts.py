"""
texts - the sentences of the dashboard (PIPELINE §7, storytelling): the match
headline, one title per staff visual (written as a finding, not a question) and
one sentence per recap item.

    facts      build_facts() turns the engine's numbers into, per key, a small dict
               of ready-to-read strings ("13", "1,67", "31 %") and a template
               sentence built from them. A key is left out when its data is missing.
    templates  always available, deterministic.
    LLM        when a client is given (ANTHROPIC_API_KEY set), Claude rewrites every
               key in one structured call. A sentence is kept only if every number
               in it appears in that key's facts (numbers_ok); otherwise, and on a
               refusal or any API error, the template is used.
    store      TextStore caches the result per match (keyed by a hash of the facts,
               so it is regenerated only when the numbers change) and keeps the
               analyst's edits, which always win. Files live in data/texts/
               (git-ignored: they can contain player names).
"""

import hashlib
import json
import re
from pathlib import Path

from pydantic import BaseModel

MODEL = "claude-opus-5-5"
LANE_SIDE = {"L": "la gauche", "HS_L": "la gauche", "C": "l'axe", "HS_R": "la droite", "R": "la droite"}
ASSIST = {"THROUGH": "passes dans le dos", "CUTBACK": "remises en retrait", "CROSS": "centres", "HS_PASS": "passes dans l'intérieur",
          "SET_PIECE_DELIVERY": "coups de pied arrêtés", "REBOUND": "rebonds et 2e ballons", "SOLO": "actions individuelles",
          "REGAIN_DIRECT": "récupérations directes", "NONE": "frappes sans passe"}
PHASE = {"TRANSITION": "de la transition", "BUILD_UP": "de la construction", "SETTLED": "de l'attaque placée", "SET_PIECE": "des CPA"}
CAUSE = {"INTERCEPTED": "passes interceptées", "TACKLED": "ballons pris au porteur", "BAD_TOUCH": "mauvais contrôles",
         "OUT": "ballons sortis", "FOUL": "fautes"}
METHOD = {"PASS": "la passe", "CARRY": "la conduite", "CROSS": "le centre", "SET_PIECE": "les CPA", "LOOSE": "les ballons libres"}
BOX = ("SIX", "CENTRAL_BOX", "WIDE_BOX")


# ---------- formatting ----------

def n(x):
    return str(int(round(x)))


def dec(x, d=2):
    return f"{x:.{d}f}".replace(".", ",")


def pct(x):
    return f"{round(x * 100)} %"


def que(word):
    """« que Vanier » / « qu'Ahuntsic »."""
    return f"qu'{word}" if word[:1].lower() in "aeiouyhéèêàâîôû" else f"que {word}"


def plural(k, word):
    return word if str(k) in ("0", "1") else word + "s"


def first(name):
    return (name or "").split()[0] if name else None


def _top(counts):
    items = [(k, v) for k, v in (counts or {}).items() if k not in ("UNREVIEWED", "CANT_SEE") and v]
    return max(items, key=lambda kv: kv[1]) if items else (None, 0)


# ---------- facts ----------

def build_facts(metrics, details, recap, match):
    """key -> {"facts": {name: str}, "template": str} for every sentence the dashboard shows."""
    M, D, out = metrics, details or {}, {}

    def put(key, facts, template):
        out[key] = {"facts": facts, "template": template}

    def v(mid):
        m = M.get(mid)
        return m["value"] if m and m.get("value") is not None else None

    opp = match.get("opponent") or "l'adversaire"
    score = match.get("final_score") or {}
    gf, ga, xf, xa = score.get("us"), score.get("them"), v("xg_for"), v("xg_against")
    if None not in (gf, ga, xf, xa):
        result = "gagné" if gf > ga else "perdu" if gf < ga else "fait match nul"
        created = "créé plus" if xf > xa + 0.15 else "créé moins" if xf < xa - 0.15 else "créé autant"
        f = {"opponent": opp, "score": f"{gf}–{ga}", "xg_for": dec(xf), "xg_against": dec(xa),
             "shots_for": n(v("shots_for") or 0), "shots_against": n(v("shots_against") or 0)}
        put("recap.headline", f, f"On a {created} {que(opp)} ({f['xg_for']} xG contre {f['xg_against']}) et {result} {f['score']}.")

    shots = [s for s in D.get("shots", [])]
    us, them = [s for s in shots if s["team"] == "US"], [s for s in shots if s["team"] == "THEM"]
    if us:
        tu, ku = _top(D.get("shot_origin", {}).get("US"))
        tt, kt = _top(D.get("shot_origin", {}).get("THEM"))
        if tu:
            f = {"top_us": ASSIST.get(tu, tu), "n_us": n(ku), "shots_us": n(len(us))}
            text = f"Nos tirs naissent surtout de {f['top_us']} ({f['n_us']} sur {f['shots_us']})"
            if tt:
                f.update({"top_them": ASSIST.get(tt, tt), "n_them": n(kt), "shots_them": n(len(them))})
                text += f", les leurs de {f['top_them']} ({f['n_them']} sur {f['shots_them']})"
            put("attaque.creation", f, text + ".")
        inb, inb_t = sum(s.get("loc") in BOX for s in us), sum(s.get("loc") in BOX for s in them)
        f = {"in_box": n(inb), "shots": n(len(us)), "them_in_box": n(inb_t), "them_shots": n(len(them))}
        put("attaque.zones", f, f"{f['in_box']} de nos {f['shots']} tirs viennent de la surface (eux : {f['them_in_box']} sur {f['them_shots']}).")
    rates = {p: v(f"xg_rate_{p}") for p in PHASE if v(f"xg_rate_{p}") is not None}
    if rates and max(rates.values()) > 0:
        p = max(rates, key=rates.get)
        f = {"phase": PHASE[p], "rate": dec(rates[p])}
        put("attaque.phase", f, f"Notre danger vient surtout {f['phase']} ({f['rate']} xG par 10 min).")
    red, box, sh, go = (M.get(k, {}).get("n") for k in ("redzone_entries", "box_entries", "shots_for", "goals_for"))
    if red:
        f = {"red": n(red), "box": n(box or 0), "shots": n(sh or 0), "goals": n(go or 0)}
        put("attaque.funnel", f, f"{f['red']} entrées en zone rouge, {f['box']} dans la surface, {f['shots']} tirs, {f['goals']} buts.")

    det = (M.get("hs_entry_share") or {}).get("detail") or {}
    lanes = det.get("lanes") or {}
    if sum(lanes.values()):
        sides = {}
        for lane, k in lanes.items():
            sides[LANE_SIDE.get(lane, lane)] = sides.get(LANE_SIDE.get(lane, lane), 0) + k
        side, k = max(sides.items(), key=lambda kv: kv[1])
        total = sum(lanes.values())
        f = {"side": side, "n": n(k), "total": n(total)}
        put("couloirs.grid", f, f"{f['n']} de nos {f['total']} entrées (zone 4 et surface) passent par {f['side']}.")
    tm, km = _top(det.get("methods"))
    if tm:
        f = {"method": METHOD.get(tm, tm), "n": n(km), "total": n(sum((det.get("methods") or {}).values()))}
        put("couloirs.method", f, f"On entre surtout par {f['method']} ({f['n']} sur {f['total']}).")
    eo = D.get("entry_outcomes") or {}
    if sum(eo.values()):
        f = {"total": n(sum(eo.values())), "shot": n(eo.get("SHOT", 0)), "lost": n(eo.get("LOST", 0))}
        put("couloirs.outcomes", f, f"Sur {f['total']} entrées, {f['shot']} finissent par un tir et {f['lost']} par une perte.")

    cl = D.get("closing") or {}
    if sum(cl.values()):
        f = {"total": n(sum(cl.values())), "zero": n(cl.get("0", 0)), "one": n(cl.get("1", 0))}
        put("intensite.closing", f, f"Sur {f['total']} pertes dans leur moitié, personne ne presse {f['zero']} fois et un seul joueur {f['one']} fois.")
    causes = ((M.get("counterpress_5s") or {}).get("detail") or {}).get("causes") or {}
    tc, kc = _top(causes)
    if tc:
        f = {"cause": CAUSE.get(tc, tc), "n": n(kc), "total": n(sum(causes.values()))}
        put("intensite.losses", f, f"{f['n']} de nos {f['total']} pertes revues sont des {f['cause']}.")
    ls = D.get("losses_to_shots") or {}
    if ls.get("n_shots"):
        goals = sum(m.get("shot_v") == "GOAL" for m in ls.get("moments", []))
        f = {"k": n(ls["n_shots"]), "goals": n(goals)}
        put("intensite.losses_to_shots", f, f"{f['k']} de nos pertes mènent à un tir adverse en 20 s, dont {f['goals']} {plural(f['goals'], 'but')}.")

    if them:
        tt, kt = _top(D.get("shot_origin", {}).get("THEM"))
        if tt:
            f = {"top": ASSIST.get(tt, tt), "n": n(kt), "total": n(len(them))}
            put("defense.creation", f, f"Leurs tirs naissent surtout de {f['top']} ({f['n']} sur {f['total']}).")
        f = {"in_box": n(sum(s.get("loc") in BOX for s in them)), "total": n(len(them))}
        put("defense.zones", f, f"{f['in_box']} de leurs {f['total']} tirs viennent de notre surface.")
    rt = {p: v(f"xg_rate_{p}_against") for p in PHASE if v(f"xg_rate_{p}_against") is not None}
    if rt and max(rt.values()) > 0:
        p = max(rt, key=rt.get)
        f = {"phase": PHASE[p], "rate": dec(rt[p])}
        put("defense.phase", f, f"Leur danger vient surtout {f['phase']} ({f['rate']} xG par 10 min).")

    sp, spa = M.get("setpiece_shot_rate"), M.get("setpiece_shot_rate_against")
    if sp and sp.get("value") is not None and sp.get("n"):
        f = {"hits": n(sp["value"] * sp["n"]), "n": n(sp["n"]), "pct": pct(sp["value"])}
        text = f"{f['hits']} de nos {f['n']} CPA dans leur moitié mènent à un tir en 20 s ({f['pct']})"
        if spa and spa.get("value") is not None and spa.get("n"):
            f.update({"them_hits": n(spa["value"] * spa["n"]), "them_n": n(spa["n"])})
            text += f" ; eux {f['them_hits']} sur {f['them_n']}"
        put("cpa.ours", f, text + ".")

    players = D.get("players") or []
    movers = sorted(players, key=lambda p: -(p["entries"] + p["shots"] + p["assists"]))[:2]
    if len(movers) == 2 and movers[0]["entries"] + movers[0]["shots"]:
        a, b = movers
        f = {"p1": first(a["name"]) or f"#{a['num']}", "p2": first(b["name"]) or f"#{b['num']}",
             "e1": n(a["entries"]), "e2": n(b["entries"]), "s1": n(a["shots"]), "s2": n(b["shots"])}
        put("joueurs.scatter", f, f"{f['p1']} et {f['p2']} portent l'attaque : {f['e1']} et {f['e2']} entrées en zone rouge, {f['s1']} et {f['s2']} tirs.")
    names = {p["num"]: first(p["name"]) or f"#{p['num']}" for p in players}
    duos = D.get("duos") or []
    if duos:
        d = duos[0]
        f = {"a": names.get(d["from"], f"#{d['from']}"), "b": names.get(d["to"], f"#{d['to']}"), "xg": dec(d["xg"]),
             "shots": n(d["shots"]), "goals": n(d["goals"])}
        put("joueurs.duos", f, f"Le duo le plus dangereux : {f['a']} pour {f['b']} ({f['shots']} {plural(f['shots'], 'tir')}, {f['xg']} xG, {f['goals']} {plural(f['goals'], 'but')}).")

    # the week's focus: the first "to work on" item, or an empty slot the analyst fills (hidden while empty)
    worst = (recap or {}).get("worst") or []
    if worst:
        w = worst[0]
        put("recap.focus", {"label": w["label_fr"]}, f"Cette semaine : {w['label_fr'].lower()}.")
    else:
        put("recap.focus", {}, "")
    for side, items in (("best", (recap or {}).get("best") or []), ("worst", (recap or {}).get("worst") or [])):
        for it in items:
            us_v, them_v = it["value"], it["compare"]["value"]
            fmt = pct if it.get("unit") == "%" else (lambda x: dec(x)) if str(it.get("unit", "")).startswith("xG") else n
            f = {"label": it["label_fr"], "us": fmt(us_v), "them": fmt(them_v), "who": it["compare"]["label"]}
            put(f"recap.{side}.{it['id']}", f, f"{f['label']} : {f['us']} pour nous, {f['them']} pour {opp}.")
    return out


# ---------- guard ----------

NUM = re.compile(r"\d+(?:[.,]\d+)?")


def _numbers(s):
    return {x.replace(",", ".").rstrip("0").rstrip(".") if "." in x.replace(",", ".") else x for x in NUM.findall(s or "")}


def numbers_ok(text, facts):
    """Every number written must come from the facts (or the fixed windows 3 s, 5 s, 10 s, 15 s, 20 s)."""
    allowed = set().union(*(_numbers(str(x)) for x in facts.values())) | {"3", "5", "10", "15", "20"}
    return _numbers(text) <= allowed


# ---------- generation ----------

class _Item(BaseModel):
    key: str
    text: str


class _Texts(BaseModel):
    items: list[_Item]


SYSTEM = (
    "Tu écris les phrases d'un tableau de bord de soccer collégial québécois (Lauréats) pour un entraîneur pressé. "
    "Pour chaque clé, écris UNE phrase en français, au plus 22 mots, qui énonce le constat (pas une question). "
    "Utilise seulement les nombres présents dans les faits de cette clé, écrits comme dans les faits ; n'invente "
    "aucun nombre ni aucun fait. Pas de jargon (xT, half-space, KPI) ; « xG » est permis. Ton factuel, sans "
    "exclamation ni jugement sur un joueur. Le brouillon est correct : améliore la clarté et le naturel."
)


def generate(facts, client=None, model=MODEL):
    """{"source": "llm" | "template", "texts": {key: sentence}, "llm_keys": [...]}."""
    texts = {k: f["template"] for k, f in facts.items()}
    if client is None or not facts:
        return {"source": "template", "texts": texts, "llm_keys": []}
    payload = [{"key": k, "faits": f["facts"], "brouillon": f["template"]} for k, f in facts.items()]
    try:
        resp = client.messages.parse(
            model=model, max_tokens=8000, system=SYSTEM, output_config={"effort": "low"},
            messages=[{"role": "user", "content": json.dumps(payload, ensure_ascii=False)}], output_format=_Texts)
    except Exception:      # noqa: BLE001 - any API failure: the templates are always there
        return {"source": "template", "texts": texts, "llm_keys": []}
    if getattr(resp, "stop_reason", None) == "refusal" or getattr(resp, "parsed_output", None) is None:
        return {"source": "template", "texts": texts, "llm_keys": []}
    kept = []
    for item in resp.parsed_output.items:
        if item.key in facts and item.text.strip() and numbers_ok(item.text, facts[item.key]["facts"]):
            texts[item.key] = item.text.strip()
            kept.append(item.key)
    return {"source": "llm" if kept else "template", "texts": texts, "llm_keys": kept}


def facts_hash(facts):
    return hashlib.sha256(json.dumps(facts, sort_keys=True, ensure_ascii=False).encode()).hexdigest()[:16]


class TextStore:
    """data/texts/<match>.json: {"hash", "generated": {...}, "edits": {key: text}}."""

    def __init__(self, root):
        self.root = Path(root)

    def _path(self, match_id):
        return self.root / f"{match_id}.json"

    def _load(self, match_id):
        p = self._path(match_id)
        return json.loads(p.read_text()) if p.exists() else {}

    def _save(self, match_id, data):
        self.root.mkdir(parents=True, exist_ok=True)
        self._path(match_id).write_text(json.dumps(data, ensure_ascii=False, indent=2))

    def get_or_make(self, match_id, facts, client=None, regenerate=False):
        data = self._load(match_id)
        h = facts_hash(facts)
        if regenerate or data.get("hash") != h or not data.get("generated"):
            data = {"hash": h, "generated": generate(facts, client), "edits": data.get("edits", {})}
            self._save(match_id, data)
        gen = data["generated"]
        texts = {**gen["texts"], **{k: t for k, t in data.get("edits", {}).items() if k in gen["texts"]}}
        return {"source": gen["source"], "texts": texts, "llm_keys": gen.get("llm_keys", []), "edited": sorted(data.get("edits", {}))}

    def edit(self, match_id, key, text):
        data = self._load(match_id)
        edits = data.setdefault("edits", {})
        if text.strip():
            edits[key] = text.strip()
        else:
            edits.pop(key, None)
        self._save(match_id, data)
