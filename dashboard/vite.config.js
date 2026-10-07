import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// The dashboard never computes football logic: /api is proxied to the
// FastAPI server (src/api/app.py), which serves already-calculated results.
// `vite build --mode snapshot`: one self-contained HTML file (dist-snapshot/index.html)
// for the staff export (tools/export_snapshot.py fills in the match data).
export default defineConfig(({ mode }) => ({
  plugins: mode === "snapshot" ? [react(), viteSingleFile()] : [react()],
  build: mode === "snapshot" ? { outDir: "dist-snapshot" } : {},
  server: {
    port: 3000,
    proxy: {
      "/api": {
        target: process.env.FA_API_URL || "http://127.0.0.1:8000",
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
}));
