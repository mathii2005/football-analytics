export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#ffffff", "paper-2": "#f6f5f2", rule: "#e3e1dc",
        ink: "#141414", "ink-2": "#4a4a48", "ink-3": "#85847f",
        us: "#b8862e", "us-deep": "#8a6420", them: "#2a6aa8", dead: "#8a8a86", warn: "#c0281e",
      },
      fontFamily: { sans: ["system-ui", "-apple-system", "Segoe UI", "sans-serif"] },
    },
  },
  plugins: [],
};
