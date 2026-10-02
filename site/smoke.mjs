// Loads the built site in a real browser and exits non-zero if it does not render.
// deploy.yml runs this between the build and the upload, so a broken page is never published.
//     npm run build && npm run smoke
// Uses the Chrome already on the machine (GitHub's runners have it); set SMOKE_CHANNEL=msedge to use Edge.
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
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
  for (const [name, viewport] of [["desktop", { width: 1200, height: 900 }], ["phone", { width: 375, height: 812 }], ["small phone", { width: 320, height: 640 }]]) {
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
      local: document.querySelectorAll(".local tbody tr").length,
      rows: document.querySelectorAll(".facilities .roster tbody tr").length,
      jumps: document.querySelectorAll(".section-nav a").length,
      meter: !!document.querySelector(".hero-bar"),
      clipped: [...document.querySelectorAll(".chart-frame")].filter((frame) =>
        [...frame.querySelectorAll("svg text")].some((t) => {
          const box = t.getBoundingClientRect(), outer = frame.getBoundingClientRect();
          return box.left < outer.left - 0.5 || box.right > outer.right + 0.5;
        })).length,
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      sideways: [...document.querySelectorAll(".table-wrap")].filter((e) => e.scrollWidth > e.clientWidth + 1).length,
    }));
    check(!seen.failed, `${name}: the page shows its load-error message`);
    check(seen.stats.length === 4 && seen.stats.every((s) => /\d/.test(s)), `${name}: stat strip reads ${JSON.stringify(seen.stats)}`);
    check(seen.headings === SECTIONS, `${name}: ${seen.headings} sections, expected ${SECTIONS}`);
    check(seen.lines >= 7, `${name}: only ${seen.lines} chart lines drawn`);
    check(seen.areas === 4, `${name}: ${seen.areas} stacked areas, expected 4`);
    check(seen.local >= 1, `${name}: the close-to-home list is empty`);
    check(seen.rows === 10, `${name}: ${seen.rows} facility rows before "Show all", expected 10`);
    check(seen.jumps === 5, `${name}: ${seen.jumps} jump links, expected 5`);
    check(seen.meter, `${name}: the system-wide capacity bar is missing`);
    check(seen.sideways === 0, `${name}: ${seen.sideways} table(s) run off the side of the screen`);
    check(seen.clipped === 0, `${name}: ${seen.clipped} chart(s) have a label running outside the frame`);

    // The facility list: "Show all" reveals the rest, and the search box finds a jail by county.
    await page.click(".facilities > .more");
    const allRows = await page.locator(".facilities .roster tbody tr").count();
    check(allRows >= 30, `${name}: only ${allRows} facility rows after "Show all"`);
    await page.fill(".find input", "lincoln");
    const found = await page.locator(".facilities .roster .name").allTextContents();
    check(found.includes("Lincoln County Jail") && found.includes("Lincoln Hills School"),
      `${name}: searching "lincoln" found ${JSON.stringify(found)}`);
    check(seen.overflow <= 1, `${name}: page is ${seen.overflow}px wider than the screen`);

    // On a phone each row is a small grid: in every group, nothing may sit on top of a facility's name.
    for (const tab of await page.locator(".tabs button").all()) {
      await tab.click();
      const more = page.locator(".facilities > .more");
      if (await more.count()) await more.click();
      const collisions = await page.evaluate(() =>
        [...document.querySelectorAll(".facilities .roster tbody tr:not(.detail)")].filter((tr) => {
          const a = tr.querySelector(".name").getBoundingClientRect(), b = tr.querySelector("td.change").getBoundingClientRect();
          const slack = 2; // the name's tap padding may touch the line below it; two pixels is not a collision
          return a.left < b.right - slack && b.left < a.right - slack && a.top < b.bottom - slack && b.top < a.bottom - slack;
        }).map((tr) => tr.querySelector(".name").textContent));
      check(collisions.length === 0, `${name}: the year's change sits on top of the name for ${JSON.stringify(collisions)}`);
    }

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

    // A link to a section lands on it, though the section does not exist until the data arrives.
    await page.goto(`${URL}#counties`, { waitUntil: "networkidle" });
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector("#counties", { timeout: 15000 });
    await page.waitForTimeout(1500);
    const landed = await page.evaluate(() => Math.round(document.getElementById("counties").getBoundingClientRect().top));
    check(Math.abs(landed) < 80, `${name}: #counties left that section ${landed}px from the top of the screen`);
    await page.close();
  }

  // The embed code as shipped in public/embed.txt, in a stand-in article: the frame must grow to the
  // tool's full height, and a jump link inside it must scroll the article to the right place.
  const optionB = readFileSync("public/embed.txt", "utf8").split("OPTION B")[1].split("OPTION C")[0];
  const snippet = optionB.slice(optionB.indexOf("<iframe"), optionB.lastIndexOf("</script>") + 9)
    .replaceAll("https://rowanflynnpilot.github.io/wpr-custody-ledger/", URL).replace('loading="lazy"', "");
  const host = await browser.newPage({ viewport: { width: 1000, height: 800 }, reducedMotion: "reduce" });
  await host.setContent(`<!doctype html><body style="margin:0"><div style="height:600px">An article.</div>${snippet}<div style="height:600px"></div></body>`);
  const tool = host.frameLocator("#custody-ledger");
  await tool.locator(".stat-num").first().waitFor({ timeout: 15000 });
  await host.waitForTimeout(1800);
  const frame = await host.evaluate(() => {
    const f = document.getElementById("custody-ledger");
    return { height: f.offsetHeight, top: f.getBoundingClientRect().top + window.scrollY };
  });
  check(frame.height > 3000, `embed: the frame is ${frame.height}px tall; it did not grow to the tool's height`);
  const target = await tool.locator("#facilities").evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
  await tool.locator(".section-nav a", { hasText: "Find a facility" }).click();
  await host.waitForTimeout(800);
  const scrolled = await host.evaluate(() => window.scrollY);
  check(Math.abs(scrolled - (frame.top + target - 16)) < 40,
    `embed: "Find a facility" scrolled the article to ${scrolled}px, expected about ${Math.round(frame.top + target - 16)}px`);
  await host.close();

  // A shared article link: the embed code passes the article's own #hash into the frame. That needs
  // an article with a real address, so serve the stand-in from a local port.
  const article = createServer((_, res) => {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(`<!doctype html><body style="margin:0"><div style="height:600px">An article.</div>${snippet}<div style="height:600px"></div></body>`);
  }).listen(PORT + 1, "127.0.0.1");
  try {
    // One try at one link. Returns whether it landed and, if not, what the frame held.
    const follow = async (hash, selector, what) => {
      const shared = await browser.newPage({ viewport: { width: 1000, height: 800 }, reducedMotion: "reduce" });
      const heard = [];
      shared.on("pageerror", (e) => heard.push(`page error: ${e.message}`));
      shared.on("console", (m) => { if (m.type() === "error") heard.push(`console error: ${m.text()}`); });
      await shared.goto(`http://127.0.0.1:${PORT + 1}/${hash}`);
      const inside = shared.frameLocator("#custody-ledger");
      const found = await inside.locator(selector).first().waitFor({ timeout: 15000 }).then(() => true, () => false);
      await shared.waitForTimeout(2000);
      const at = await shared.evaluate(() => ({ y: window.scrollY, top: document.getElementById("custody-ledger").getBoundingClientRect().top + window.scrollY }));
      const want = await inside.locator(selector).first().evaluate((el) => el.getBoundingClientRect().top + window.scrollY, null, { timeout: 5000 }).catch(() => null);
      const ok = want != null && Math.abs(at.y - (at.top + want - 16)) < 40;
      // What the frame held when the check failed: enough to tell a page fault from a slow runner.
      const state = ok ? "" : await inside.locator("body").evaluate(() => JSON.stringify({
        hash: window.location.hash,
        open: [...document.querySelectorAll("tr.open .name")].map((e) => e.textContent),
        expanded: [...document.querySelectorAll('.name[aria-expanded="true"]')].map((e) => e.textContent),
        group: document.querySelector('.tabs button[aria-pressed="true"]')?.textContent,
        row: document.getElementById("facility-lincoln-hills")?.className ?? "no such row",
        failed: !!document.querySelector(".load-error"),
      }), null, { timeout: 5000 }).catch((e) => `frame unreadable: ${e.message.split("\n")[0]}`);
      const message = `embed: an article link ending ${hash} scrolled to ${at.y}px, expected ${want == null ? `${what} to exist` : `about ${Math.round(at.top + want - 16)}px`}` +
        ` (seen at first: ${found}; frames: ${shared.frames().map((f) => f.url()).join(" , ")}; frame state: ${state}; ${heard.join(" | ") || "no errors"})`;
      await shared.close();
      return { ok, message };
    };
    // This check failed once on a runner on Oct. 1, 2026 and passed on the next five runs of the same
    // commit; it has never failed off the runner. Until the cause is known, one miss is a warning that
    // says what the frame held, and only two in a row stop the deploy.
    for (const link of [["#counties", "#counties", "the county section"], ["#facility=lincoln-hills", "tr.open", "the open facility"]]) {
      const first = await follow(...link);
      if (first.ok) continue;
      console.log(`::warning title=Embed link check needed a second try::${first.message}`);
      const second = await follow(...link);
      check(second.ok, `${second.message} (twice in a row)`);
    }
  } finally {
    await new Promise((done) => article.close(done));
  }
} finally {
  await browser.close();
  await new Promise((done) => server.httpServer.close(done));
}

if (failures.length) {
  console.error(`Smoke test failed:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}
console.log("Smoke test passed: three widths render, facility and section links land, the embed resizes, scrolls and follows the article's link.");
