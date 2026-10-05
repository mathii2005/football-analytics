import { useCallback, useRef, useState } from "react";

// Serialised saves with revision checking: one save at a time, each from the
// latest state, refused (conflict) if the stored match moved on elsewhere.
export function useSaver(store, initialRev) {
  const rev = useRef(initialRev);
  const queue = useRef(Promise.resolve());
  const [conflict, setConflict] = useState(false);
  const [saved, setSaved] = useState(store.ok);
  const save = useCallback((getArgs) => {
    queue.current = queue.current.then(async () => {
      if (conflict) return;
      const [meta, ops, reviewed, clock] = getArgs();
      const r = await store.saveMatch(meta, ops, reviewed, clock, rev.current);
      if (r?.conflict) setConflict(true);
      else if (r?.rev !== undefined) rev.current = r.rev;
      setSaved(store.ok);
    }).catch(() => setSaved(false));
    return queue.current;
  }, [store, conflict]);
  return { save, conflict, saved };
}
