import HBars from "./HBars.jsx";
import { dec, pct } from "../format.js";

// Old staff tile: time from a recovery to the next dangerous action.
export default function TransitionSpeed({ t }) {
  return (
    <div>
      <dl className="grid grid-cols-2 gap-4">
        <div><dt className="text-xs text-ink-3">Médiane récup → action</dt>
          <dd className="display text-3xl font-semibold text-ink tabular">{t.median_s == null ? "–" : `${dec(t.median_s)} s`}</dd></div>
        <div><dt className="text-xs text-ink-3">Récup menant à une action</dt>
          <dd className="display text-3xl font-semibold text-ink tabular">{pct(t.pct_leading)}</dd></div>
      </dl>
      <div className="mt-4">
        <HBars rows={[
          { label: "Contre (< 5 s)", value: t.fast, highlight: true },
          { label: "Rapide (5–15 s)", value: t.mid },
          { label: "Construit (15–60 s)", value: t.slow },
        ]} />
      </div>
      <p className="mt-2 text-xs text-ink-3">n = {t.n} transitions propres ; écarts &gt; 60 s, pertes intermédiaires et arrêts exclus.</p>
    </div>
  );
}
