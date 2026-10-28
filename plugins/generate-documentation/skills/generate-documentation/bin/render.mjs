/**
 * Render a guide's HTML to PDF, and make a contact sheet of its pages to review.
 * Run it from the app repo, so Playwright resolves from there:
 *
 *   cd <app repo> && node <skill-dir>/bin/render.mjs <guide.html> <out.pdf> [--footer "Product name"]
 *
 * Prints the page count and the path of `<out>.sheet.png` (every page side by
 * side). Look at the sheet before sending: it is how you catch a heading left at
 * the bottom of a page, a page holding one note, or a screenshot split from its
 * step. The sheet needs `pdftoppm` (poppler) and ImageMagick; without them it is
 * skipped and only the page count is printed.
 */
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const require = createRequire(path.join(process.cwd(), "package.json"));
const { chromium } = require("playwright");

const args = process.argv.slice(2);
const footerAt = args.indexOf("--footer");
const footer = footerAt >= 0 ? args.splice(footerAt, 2)[1] : "";
const [html, out] = args.map((p) => path.resolve(p));
if (!html || !out) {
  console.error("usage: render.mjs <guide.html> <out.pdf> [--footer text]");
  process.exit(1);
}

const escape = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`file://${html}`, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await page.pdf({
  path: out,
  format: "Letter",
  printBackground: true,
  preferCSSPageSize: true,
  displayHeaderFooter: true,
  headerTemplate: "<span></span>",
  footerTemplate: `<div style="font-size:7pt;color:#8a847b;width:100%;text-align:center;font-family:sans-serif">${
    footer ? `${escape(footer)} · ` : ""
  }<span class="pageNumber"></span> of <span class="totalPages"></span></div>`,
});
await browser.close();

const has = (bin) => {
  try {
    execFileSync("which", [bin], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
};

if (has("pdftoppm") && has("magick")) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gd-pages-"));
  execFileSync("pdftoppm", ["-r", "60", "-png", out, path.join(dir, "p")]);
  const pages = fs.readdirSync(dir).filter((f) => f.endsWith(".png")).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true }),
  );
  // A new name every run: an image viewer that caches by path would show the old sheet.
  const sheet = out.replace(/\.pdf$/i, `.sheet-${Date.now()}.png`);
  const cols = Math.min(5, pages.length);
  execFileSync("magick", [
    "montage",
    ...pages.map((p) => path.join(dir, p)),
    "-tile", `${cols}x`,
    "-geometry", "+6+6",
    "-background", "#999",
    sheet,
  ]);
  console.log(`${pages.length} pages`);
  console.log(`sheet: ${sheet}`);
  console.log(`pages: ${dir}`);
} else {
  const count = (fs.readFileSync(out, "latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;
  console.log(`${count} pages (install poppler and imagemagick for a contact sheet)`);
}
console.log(`pdf: ${out}`);
