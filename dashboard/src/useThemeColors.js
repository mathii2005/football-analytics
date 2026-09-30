import { useEffect, useState } from "react";

// SVG presentation attributes can't use var(), so charts read the
// resolved token values and re-read them when the color scheme changes.
const TOKENS = ["--us", "--them", "--line", "--text-secondary", "--text-muted", "--card"];

function read() {
  const style = getComputedStyle(document.documentElement);
  return Object.fromEntries(TOKENS.map((t) => [t.slice(2), style.getPropertyValue(t).trim()]));
}

export default function useThemeColors() {
  const [colors, setColors] = useState(read);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setColors(read());
    mq.addEventListener("change", update);
    const obs = new MutationObserver(update);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => { mq.removeEventListener("change", update); obs.disconnect(); };
  }, []);
  return colors;
}
