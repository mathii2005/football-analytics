/** Colors are CSS variables (src/index.css). */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        paper: "var(--paper)", "paper-2": "var(--paper-2)", rule: "var(--rule)",
        ink: "var(--ink)", "ink-2": "var(--ink-2)", "ink-3": "var(--ink-3)",
        gold: "var(--gold)", "gold-deep": "var(--gold-deep)", "gold-tint": "var(--gold-tint)",
        band: "var(--band)", "band-2": "var(--band-2)", "band-rule": "var(--band-rule)", "band-ink-2": "var(--band-ink-2)",
        them: "var(--them)", "gold-lift": "var(--gold-lift)",
      },
      fontFamily: {
        sans: ["Barlow", "system-ui", "sans-serif"],
        display: ["Barlow Condensed", "Barlow", "sans-serif"],
      },
    },
  },
  plugins: [],
};
