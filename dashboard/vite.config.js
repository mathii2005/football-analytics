import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The dashboard never computes football logic: /api is proxied to the
// FastAPI server (src/api/app.py), which serves already-calculated results.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      "/api": {
        target: process.env.FA_API_URL || "http://127.0.0.1:8000",
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
