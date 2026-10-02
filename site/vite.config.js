import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// One id per build, stamped onto every data request (see `define` below).
const BUILD_ID = Date.now().toString(36);
// The same five files App.jsx fetches (FILES there), at the same addresses. Listed in the page head
// so the browser fetches them while the script is still downloading, instead of after it has run.
const DATA_FILES = ["statewide", "facilities", "latest", "changes", "counties"];
const preloadData = {
  name: "preload-data",
  transformIndexHtml: () => DATA_FILES.map((name) => ({
    tag: "link", injectTo: "head",
    attrs: { rel: "preload", as: "fetch", crossorigin: "anonymous", href: `./data/${name}.json?v=${BUILD_ID}` },
  })),
};

export default defineConfig({
  plugins: [react(), preloadData],
  base: "./",
  // Vite 8's defaults assume 2023+ browsers, and its CSS minifier then rewrites every
  // `max-width: 560px` into range syntax (`width<=560px`), which Safari before 16.4 ignores:
  // on an older iPhone that silently disables the whole responsive layout. A news audience
  // includes those phones, so build for them.
  build: {
    target: ["es2020", "safari14", "chrome87", "firefox78", "edge88"],
    cssTarget: ["safari14", "chrome87", "firefox78", "edge88"],
  },
  // Stamped onto every data request: GitHub Pages lets browsers cache each JSON file on its
  // own clock, so after a deploy a reader could get this week's figures in one file and last
  // week's in another. A new build asks for a new URL, so the set is always consistent.
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
});
