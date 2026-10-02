import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// One id per build, stamped onto every data request (see `define` below).
const BUILD_ID = Date.now().toString(36);
// The same five files App.jsx reads (FILES there). A line of script in the page head asks for them
// while the main script is still downloading, and App.jsx picks the answers up from window.__ledgerData.
// Not <link rel="preload" as="fetch">: Chrome and Firefox hand a preloaded response to fetch(), but
// Safari's engine does not, and downloaded every file twice (seen Oct. 1, 2026).
const DATA_FILES = ["statewide", "facilities", "latest", "changes", "counties"];
const earlyData = {
  name: "early-data",
  transformIndexHtml: () => [{
    tag: "script", injectTo: "head",
    // A failed request is kept as its error, so nothing goes unhandled before App.jsx is there to read it.
    children: `window.__ledgerData=Object.fromEntries(${JSON.stringify(DATA_FILES)}.map(function(n){` +
      `return[n,fetch("./data/"+n+".json?v=${BUILD_ID}").catch(function(e){return e})]}));`,
  }],
};

export default defineConfig({
  plugins: [react(), earlyData],
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
