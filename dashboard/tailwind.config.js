/** Colors are CSS variables (src/index.css) so light/dark swap in one place. */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        surface: "var(--surface)",
        card: "var(--card)",
        line: "var(--line)",
        ink: "var(--text-primary)",
        muted: "var(--text-secondary)",
        faint: "var(--text-muted)",
        us: "var(--us)",
        them: "var(--them)",
        warn: "var(--warning)",
      },
      fontFamily: { sans: ["Inter", "system-ui", "sans-serif"] },
    },
  },
  plugins: [],
};
