/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

import pkg from "./package.json" with { type: "json" };

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    {
      // Fills in the version shown by the header copy in index.html.
      name: "app-version",
      transformIndexHtml: (html) =>
        html.replaceAll("%APP_VERSION%", pkg.version),
    },
    // Makes the built app installable and usable offline. Off in dev.
    VitePWA({
      registerType: "autoUpdate",
      // The registration script waits for the page to load anyway, so it
      // shouldn't hold up the first paint.
      injectRegister: "script-defer",
      manifest: {
        name: "Album Tracker",
        short_name: "Albums",
        description: "Keep track of the albums you own and the ones you want.",
        theme_color: "#1677ff",
        background_color: "#1677ff",
        display: "standalone",
        icons: [
          { src: "pwa-64x64.png", sizes: "64x64", type: "image/png" },
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
          {
            src: "maskable-icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico}"],
        runtimeCaching: [
          {
            // Covers come from other sites, so they're cached as they're
            // shown and stay visible offline.
            urlPattern: ({ request, sameOrigin }) =>
              request.destination === "image" && !sameOrigin,
            handler: "CacheFirst",
            options: {
              cacheName: "album-covers",
              expiration: { maxEntries: 300, purgeOnQuotaError: true },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  // GitHub Pages serves this project site under /album-tracker/. Keyed on mode,
  // not command, so `vite preview` (command: "serve") also uses the prefix.
  base: mode === "production" ? "/album-tracker/" : "/",
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
  },
}));
