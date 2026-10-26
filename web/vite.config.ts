import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  build: { outDir: "../nigrani/static/app", emptyOutDir: true, 
    rollupOptions: { output: { manualChunks(id: string) {
      if (!id.includes("node_modules")) return;
      if (/react-force-graph|force-graph|d3-|kapsule|canvas-color-tracker|bezier|float-tooltip/.test(id)) return "graph";
      if (/recharts|victory-vendor|decimal\.js|es-toolkit|redux|immer|reselect/.test(id)) return "charts";
      if (/[\\/](motion|framer-motion|motion-dom|motion-utils)[\\/]/.test(id)) return "motion";
      if (/@radix-ui|cmdk|sonner|lucide/.test(id)) return "ui";
      if (/[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id)) return "react";
    } } } },
  server: { fs: { allow: [".."] }, proxy: { "/v1": "http://localhost:8000" } },
});
