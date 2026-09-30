const nf1 = new Intl.NumberFormat("fr-CA", { maximumFractionDigits: 1, minimumFractionDigits: 1 });

export const pct = (x) => (x == null ? "–" : `${Math.round(x * 100)} %`);
export const dec = (x) => (x == null ? "–" : nf1.format(x));
export const secs = (ms) => (ms == null ? "–" : `${Math.round(ms / 1000)} s`);
export const signed = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "0");

export function clock(ms) {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function matchDate(iso) {
  if (!iso) return "";
  return new Date(`${iso}T12:00:00`).toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" });
}

export const VENUE = { home: "Domicile", away: "Extérieur" };

export const OUTCOME_LABELS = {
  goal: "But",
  shot: "Tir",
  box_entry: "Entrée dans la surface",
  cheap_loss: "Perte rapide (< 5 s)",
  loss_opp_half: "Perte dans leur moitié",
  loss_own_half: "Perte dans notre moitié",
  ball_out: "Sortie / relance adverse",
  unknown: "Fin non taguée",
};

export const START_LABELS = {
  recup: "récupération", set_piece: "coup de pied arrêté", kickoff: "engagement",
  restart: "reprise", half_start: "début de mi-temps", inferred: "non taguée",
};
export const END_LABELS = {
  recup: "récupération", perte: "perte", goal: "but", opp_goal: "but adverse",
  set_piece: "coup de pied arrêté", opp_set_piece: "relance adverse", stoppage: "arrêt de jeu",
  half_end: "fin de mi-temps", inferred: "non taguée",
};

export const ZONE_LABELS = { 1: "Zone 1", 2: "Zone 2", 3: "Zone 3", 4: "Zone 4", BOX: "Surface" };
export const COULOIR_LABELS = { left: "Gauche", center: "Axe", right: "Droite" };

// French plural: plural(2, "but") -> "2 buts"; custom plural form optional.
export const plural = (n, one, many = `${one}s`) => `${n} ${n > 1 ? many : one}`;
