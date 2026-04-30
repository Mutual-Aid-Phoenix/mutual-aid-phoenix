import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

// Builds the Decap CMS admin bundle: src/admin/custom-widgets.tsx →
// public/admin/custom-widgets.js. Loaded by public/admin/index.html as a
// classic <script>, after Decap and React are already on `window`. We
// externalize React/ReactDOM (UMD globals provided by index.html) and
// bundle Zod inline so we can validate entries against the same schema
// the Astro build uses (src/lib/schema.ts).

export default defineConfig({
  // Classic JSX runtime so JSX compiles to `React.createElement(...)` calls
  // — which resolve against the externalized `react` global at runtime
  // (window.React, loaded as a UMD by public/admin/index.html). The
  // automatic runtime would import `react/jsx-runtime`, a sub-path that's
  // not part of the UMD bundle.
  plugins: [react({ jsxRuntime: "classic" })],
  // We're not using Vite's static-asset pipeline — we only want it as a
  // bundler for one entry. Disabling publicDir avoids the warning that
  // outDir lives inside it.
  publicDir: false,
  build: {
    // Output directly into public/ so Astro picks it up unchanged.
    outDir: "public/admin",
    emptyOutDir: false, // Keep index.html and custom-widgets.css alongside.
    sourcemap: true,
    minify: true,
    target: "es2020",
    rollupOptions: {
      input: resolve(__dirname, "src/admin/custom-widgets.tsx"),
      external: ["react", "react-dom"],
      output: {
        format: "iife",
        entryFileNames: "custom-widgets.js",
        // Decap CMS: window.CMS is set by index.html (aliased from
        // DecapCmsApp). React: window.React. ReactDOM: window.ReactDOM.
        globals: {
          react: "React",
          "react-dom": "ReactDOM",
        },
        // Avoid the auto-generated assets/ folder for any non-JS chunks.
        assetFileNames: "[name][extname]",
      },
    },
  },
});
