// Loads the built site in a real browser and exits non-zero if it does not render.
// deploy.yml runs this between the build and the upload, so a broken page is never published.
//     npm run build && npm run smoke
// Uses the Chrome already on the machine (GitHub's runners have it); set SMOKE_CHANNEL=msedge to use Edge.
import { preview } from "vite";
import { chromium } from "playwright-core";

const PORT = 4173;
const URL = `http://localhost:${PORT}/`;
const SECTIONS = 9; // h2 headings on the page; change it when a section is added or removed
const failures = [];
const check = (ok, message) => { if (!ok) failures.push(message); };

const server = await preview({ preview: { port: PORT, strictPort: true } });
const browser = await chromium.launch({ channel: process.env.SMOKE_CHANNEL || "chrome" });
try {
  for (const [name, viewport] of [["desktop", { width: 1200, height: 900 }], ["phone", { width: 375, height: 812 }]]) {
    const page = await browser.newPage({ viewport });
    page.on("pageerror", (e) => failures.push(`${name}: page error: ${e.message}`));
    page.on("console", (m) => { if (m.type() === "error") failures.push(`${name}: console error: ${m.text()}`); });

    await page.goto(URL, { waitUntil: "networkidle" });
    await page.waitForSelector(".stat-num", { timeout: 15000 });
    const seen = await page.evaluate(() => ({
      failed: !!document.querySelector(".load-error"),
      stats: [...document.querySelectorAll(".stat-num")].map((e) => e.textContent.trim()),
      headings: document.querySelectorAll("h2").length,
      lines: document.querySelectorAll(".chart svg path.line").length,
      areas: document.querySelectorAll(".chart svg path.area").length,
      cards: document.querySelectorAll(".card").length,
      rows: document.querySelectorAll(".roster tbody tr").length,
      overflow: document.documentElement.scrollWidth - window.innerWidth,
    }));
    check(!seen.failed, `${name}: the page shows its load-error message`);
    check(seen.stats.length === 4 && seen.stats.every((s) => /\d/.test(s)), `${name}: stat strip reads ${JSON.stringify(seen.stats)}`);
    check(seen.headings === SECTIONS, `${name}: ${seen.headings} sections, expected ${SECTIONS}`);
    check(seen.lines >= 7, `${name}: only ${seen.lines} chart lines drawn`);
    check(seen.areas === 4, `${name}: ${seen.areas} stacked areas, expected 4`);
    check(seen.cards >= 1, `${name}: no close-to-home cards`);
    check(seen.rows >= 30, `${name}: only ${seen.rows} facility rows`);
    check(seen.overflow <= 1, `${name}: page is ${seen.overflow}px wider than the screen`);

    // A shared link opens its facility, on the right tab, with its history drawn.
    await page.goto(`${URL}#facility=lincoln-hills`, { waitUntil: "networkidle" });
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector("tr.detail .chart svg path.line", { timeout: 15000 }).catch(() => {});
    const opened = await page.evaluate(() => ({
      name: document.querySelector("tr.open .name")?.textContent,
      chart: !!document.querySelector("tr.detail .chart svg path.line"),
      overflow: document.documentElement.scrollWidth - window.innerWidth,
    }));
    check(opened.name === "Lincoln Hills School" && opened.chart, `${name}: #facility=lincoln-hills opened ${JSON.stringify(opened)}`);
    check(opened.overflow <= 1, `${name}: with a facility open the page is ${opened.overflow}px wider than the screen`);
    await page.close();
  }
} finally {
  await browser.close();
  await new Promise((done) => server.httpServer.close(done));
}

if (failures.length) {
  console.error(`Smoke test failed:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}
console.log("Smoke test passed: desktop and phone render, a facility link opens.");
