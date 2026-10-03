import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// One self-contained offline HTML file (dist/index.html) for match day.
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  server: { port: 3100, fs: { allow: [".."] } },
});
