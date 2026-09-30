import { Play, VideoOff } from "lucide-react";

// One review moment: when, what, why it was chosen, and the Veo link
// (opens 8 s before the tag, to cover the tagging delay).
export default function ClipRow({ clip, showCategory = true }) {
  return (
    <li className="grid grid-cols-[3.75rem_1fr_auto] items-start gap-3 border-t border-rule py-3 first:border-t-0 sm:gap-4">
      <div className="pt-0.5">
        <div className="display text-xl font-semibold leading-none text-ink tabular">{clip.at}</div>
        <div className="mt-1 text-[11px] uppercase tracking-wider text-ink-3">MT{clip.half} · {clip.score}</div>
      </div>
      <div className="min-w-0">
        <div className="font-medium text-ink">{clip.title}</div>
        <div className="mt-0.5 text-sm text-ink-2">{clip.reason}</div>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {showCategory && <span className="rounded-sm bg-ink px-1.5 py-0.5 text-[11px] font-medium text-paper">{clip.category_label}</span>}
          {(clip.also ?? []).map((l) => <span key={l} className="rounded-sm border border-rule bg-paper-2 px-1.5 py-0.5 text-[11px] font-medium text-ink">{l}</span>)}
          {clip.context.map((t) => (
            <span key={t} className="rounded-sm border border-rule px-1.5 py-0.5 text-[11px] text-ink-2">{t}</span>
          ))}
        </div>
      </div>
      {clip.video_url ? (
        <a href={clip.video_url} target="_blank" rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded bg-gold px-3 py-2 text-sm font-semibold text-ink transition-colors hover:bg-gold-lift focus-visible:bg-gold-lift">
          <Play size={14} strokeWidth={2.5} aria-hidden="true" /> <span className="hidden sm:inline">Voir</span>
          <span className="sr-only sm:hidden">Voir dans Veo</span>
        </a>
      ) : (
        <span className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-ink-3" title="Vidéo non liée">
          <VideoOff size={14} aria-hidden="true" />
        </span>
      )}
    </li>
  );
}
