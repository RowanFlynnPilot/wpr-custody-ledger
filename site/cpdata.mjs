// Copy the built data into the site so Vite serves and ships it. The committed truth stays in ../data.
import { cpSync, mkdirSync } from "node:fs";

mkdirSync("public/data", { recursive: true });
for (const f of ["statewide.json", "facilities.json", "latest.json", "changes.json"]) {
  cpSync(`../data/${f}`, `public/data/${f}`);
}
cpSync("../data/csv", "public/data/csv", { recursive: true });
