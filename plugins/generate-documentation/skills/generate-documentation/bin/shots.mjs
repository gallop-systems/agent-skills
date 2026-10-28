/**
 * Screenshot helpers for /generate-documentation.
 *
 * Import this from a per-job capture script (see capture-example.mjs). Playwright
 * is resolved from the APP repo (the current working directory), not from this
 * skill, so nothing needs installing here:
 *
 *   cd <app repo> && node <scratch>/capture.mjs <out-dir> [only-step]
 *
 * Every helper works on one page that is already signed in. Captures are 2x,
 * light theme, reduced motion, with dev chrome (Nuxt devtools, loading bar,
 * scrollbars) hidden, so re-running a step gives the same picture.
 */
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";

const require = createRequire(path.join(process.cwd(), "package.json"));
const { chromium } = require("playwright");

export const STILL_CSS = `
  *, *::before, *::after { transition: none !important; animation: none !important; caret-color: transparent !important; }
  nuxt-devtools-frame, nuxt-devtools-inspect-panel, #nuxt-devtools-container, #nuxt-devtools-anchor,
  [id^="nuxt-devtools"], #vue-tracer-overlay, vite-error-overlay, .nuxt-loading-indicator { display: none !important; }
  ::-webkit-scrollbar { display: none; }
  .gd-mark { outline: 3px solid #e4572e !important; outline-offset: 3px; border-radius: 6px; }
`;

/**
 * Open a browser signed in to `base`.
 * `login` is a path that signs in on GET (a dev/preview login route), or an
 * async function `(page) => {}` that signs in some other way.
 */
export async function open({ base, login, width = 1440, height = 900, timeZone = "America/New_York" }) {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 2,
    colorScheme: "light",
    reducedMotion: "reduce",
    timezoneId: timeZone,
  });
  // esbuild's keepNames helper, which some dev bundles reference before defining.
  await context.addInitScript("globalThis.__name = (fn) => fn;");
  const page = await context.newPage();
  if (typeof login === "string") await page.goto(new URL(login, base).href);
  else if (login) await login(page);
  return { browser, page, kit: kit(page, base) };
}

function kit(page, base) {
  let outDir = ".";
  const k = {
    page,
    /** Where `shot`/`full`/`element` write. */
    out(dir) {
      outDir = dir;
      fs.mkdirSync(dir, { recursive: true });
    },
    /** Go to a path and wait for it to be still. */
    async go(p) {
      await page.goto(new URL(p, base).href);
      await k.settle();
    },
    /** Wait for the network, fonts and a beat for skeletons; re-apply the still CSS. */
    async settle(ms = 700) {
      await page.waitForLoadState("networkidle").catch(() => {});
      await page.addStyleTag({ content: STILL_CSS });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(ms);
    },
    /** Ring the given elements (call `unmark` after the shot). */
    async mark(...locators) {
      for (const l of locators) await l.evaluate((el) => el.classList.add("gd-mark"));
    },
    async unmark() {
      await page.evaluate(() =>
        document.querySelectorAll(".gd-mark").forEach((el) => el.classList.remove("gd-mark")),
      );
    },
    /**
     * Screenshot the box that covers every locator, padded. Use two locators to
     * frame a region (a heading and the last thing under it).
     */
    async shot(name, locators, pad = 14) {
      for (const l of locators) await l.scrollIntoViewIfNeeded().catch(() => {});
      const boxes = [];
      for (const l of locators) {
        const box = await l.boundingBox();
        if (!box) throw new Error(`shot ${name}: a locator is not visible`);
        boxes.push(box);
      }
      const vw = page.viewportSize().width;
      const x = Math.max(0, Math.min(...boxes.map((b) => b.x)) - pad);
      const y = Math.max(0, Math.min(...boxes.map((b) => b.y)) - pad);
      const right = Math.min(vw, Math.max(...boxes.map((b) => b.x + b.width)) + pad);
      const bottom = Math.max(...boxes.map((b) => b.y + b.height)) + pad;
      await page.screenshot({
        path: path.join(outDir, `${name}.png`),
        clip: { x, y, width: right - x, height: bottom - y },
      });
      console.log("shot", name);
    },
    /** One element exactly (a dialog, a drawer). */
    async element(name, locator) {
      await locator.screenshot({ path: path.join(outDir, `${name}.png`) });
      console.log("shot", name);
    },
    /** The whole viewport. */
    async full(name) {
      await page.screenshot({ path: path.join(outDir, `${name}.png`) });
      console.log("shot", name);
    },
  };
  return k;
}

/**
 * Run the named steps in order, or just `only`. Each step is an async function
 * taking the kit. Steps should reset the demo data they change (with `sql`) so
 * any one of them can be re-run alone.
 */
export async function run(steps, { only } = {}) {
  for (const [name, step] of Object.entries(steps)) {
    if (only && only !== name) continue;
    await step();
  }
}

/** Run SQL against a SCRATCH database (never a real-data one). */
export function sql(databaseUrl, query) {
  if (!/demo|docs|scratch|fixture|seed|test/i.test(databaseUrl)) {
    throw new Error(
      `refusing to write to ${databaseUrl}: name it as a demo/docs/scratch database, or edit this guard deliberately`,
    );
  }
  return execFileSync("psql", [databaseUrl, "-qAtc", query], { encoding: "utf8" });
}
