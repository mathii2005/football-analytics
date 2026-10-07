import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Pencil } from "lucide-react";
import Tile from "../charts/Tile.jsx";

// Storytelling layer: every staff tile is titled with a finding written from the
// data (/matches/{id}/texts: templates, or Claude when a key is set). The analyst
// can rewrite any sentence in place; an empty sentence goes back to the generated one.
export const TextsContext = createContext({ texts: {}, edit: null });

export function useSaid(key, fallback = "") {
  const { texts } = useContext(TextsContext);
  return (texts && texts[key]) || fallback;
}

export function EditableText({ k, fallback = "", className = "", as: Tag = "span" }) {
  const { texts, edit } = useContext(TextsContext);
  const text = (texts && texts[k]) || fallback;
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(text);
  const box = useRef(null);
  useEffect(() => { if (open) { setDraft(text); setTimeout(() => box.current?.focus(), 0); } }, [open]);   // eslint-disable-line react-hooks/exhaustive-deps
  if (!text && !open) return null;
  if (open) {
    const save = async () => { await edit?.(k, draft); setOpen(false); };
    return (
      <span className="flex w-full items-start gap-2">
        <textarea ref={box} value={draft} onChange={(e) => setDraft(e.target.value)} rows={2}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); save(); } if (e.key === "Escape") setOpen(false); }}
          className="min-w-0 flex-1 rounded-sm border border-rule bg-paper p-1.5 text-[13px] font-normal text-ink" />
        <button type="button" onClick={save} className="rounded bg-ink px-2 py-1 text-[11px] font-semibold text-paper">OK</button>
      </span>
    );
  }
  return (
    <Tag className={`group/edit ${className}`}>
      {text}
      {edit && (
        <button type="button" aria-label="Modifier la phrase" onClick={() => setOpen(true)}
          className="ml-1.5 inline-flex align-middle text-ink-3 opacity-0 transition-opacity hover:text-ink focus:opacity-100 group-hover/edit:opacity-100">
          <Pencil size={12} />
        </button>
      )}
    </Tag>
  );
}

// A tile whose title is the finding (k) and whose grey line is the question it answers.
export function StoryTile({ k, fallback, question, note, children, className = "", aside }) {
  const said = useSaid(k, fallback || question);
  return (
    <Tile className={className} aside={aside}
      title={<EditableText k={k} fallback={fallback || question} />}
      note={[said !== question ? question : null, note].filter(Boolean).join(" · ") || undefined}>
      {children}
    </Tile>
  );
}
