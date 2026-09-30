import { useState } from "react";

// SVG presentation attributes can't use var(), so charts read the resolved
// token values once (the dashboard is light-only by brand).
const TOKENS = ["ink", "ink-2", "ink-3", "rule", "paper", "gold", "gold-deep", "gold-tint", "them"];

export default function useThemeColors() {
  const [colors] = useState(() => {
    const style = getComputedStyle(document.documentElement);
    return Object.fromEntries(TOKENS.map((t) => [t, style.getPropertyValue(`--${t}`).trim()]));
  });
  return colors;
}
