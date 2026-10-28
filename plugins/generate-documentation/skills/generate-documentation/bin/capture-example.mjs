/**
 * Example per-job capture script. Copy it to a scratch directory, edit the
 * steps, and run it from the app repo:
 *
 *   cd <app repo> && node <scratch>/capture.mjs <out-dir> [only-step]
 *
 * Paths, labels and SQL below are placeholders for a typical Gallop Nuxt app.
 */
import { open, run, sql } from "<skill-dir>/bin/shots.mjs";

const [outDir, only] = process.argv.slice(2);
const BASE = "http://localhost:3100"; // the demo-data dev server, never one on real data
const DB = "postgresql://localhost:5432/<app>-docs-scratch"; // a scratch copy of the demo DB
const db = (q) => sql(DB, q);

const { browser, page, kit } = await open({ base: BASE, login: "/api/auth/preview-login" });
kit.out(outDir);

await run(
  {
    // A thing the user can already do: show before, the click, and after.
    async setting() {
      db("update widgets set required = false where code = 'example'"); // reset, so the step re-runs
      await kit.go("/admin/widgets");
      const table = page.locator("table").first();
      const heads = await table.locator("thead th").allInnerTexts();
      const col = heads.findIndex((h) => h.trim() === "Example"); // find columns by header text, never by index
      const cell = table.locator("tbody tr", { hasText: "Row label" }).first().locator("th, td").nth(col);
      await kit.mark(cell);
      await kit.shot("setting-1-before", [table.locator("thead"), cell]);
      await kit.unmark();
      await cell.locator("button").first().click();
      await page.waitForTimeout(1000);
      await kit.mark(cell);
      await kit.shot("setting-2-after", [table.locator("thead"), cell]);
      await kit.unmark();
    },

    // A dialog or drawer: shoot the element itself.
    async dialog() {
      await kit.go("/records/1");
      await page.getByRole("button", { name: "Outcome" }).first().click();
      await kit.settle(500);
      const dialog = page.getByRole("dialog").last();
      await kit.mark(dialog.getByRole("button", { name: "Transfer…" }));
      await kit.element("dialog-1", dialog);
      await kit.unmark();
    },
  },
  { only },
);

await browser.close();
