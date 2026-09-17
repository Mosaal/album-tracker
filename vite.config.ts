import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

import pkg from "./package.json" with { type: "json" };

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  // GitHub Pages serves this project site under /album-tracker/. Keyed on mode,
  // not command, so `vite preview` (command: "serve") also uses the prefix.
  base: mode === "production" ? "/album-tracker/" : "/",
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
}));
