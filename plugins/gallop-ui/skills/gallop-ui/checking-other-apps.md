# Making sure other apps don't break

A layer change reaches every app, and a release reaches each app's real screens. Prove both: the layer change
against every app's stories, and the app after a pull against its own pages. The bar is **same or better, never a
regression** in look, behaviour and speed, at desktop and phone width, light and dark. Every difference is either
intended (and explained) or fixed.

## 1. `ui:impact` across apps (for a layer change)

From a gallop-ui worktree (`node scripts/impact.mjs`), or from an app whose subtree you edited (`yarn ui:impact`):

```sh
node scripts/impact.mjs                      # every app found next to this checkout, the full affected set
node scripts/impact.mjs --direct             # quick loop: only components whose own files changed
node scripts/impact.mjs --apps a,b           # a subset (folder names)
node scripts/impact.mjs --before app         # what each app sees when it pulls this, from its current version
```

It discovers every `~/Projects/<app>/layers/gallop-ui` (one checkout per repository), runs each app from a
`git archive` of its `HEAD` in a temp folder (never the checkout, never its `.env` or databases), and writes an HTML
report under `~/.cache/gallop-ui-impact/<time>/` with:

- **Call sites:** the affected components' tags in each app, file and line, flagged where a removed prop is still
  passed.
- **Types:** each app's `nuxt typecheck` with the edited layer (errors the app already had aren't counted).
- **Looks:** every story of every affected component at 1280 and 390, light and dark, before and after, with changed
  pixels in red.

Read the whole report. Every red diff must be one you meant. A look that changes in an app without that app touching
`pt` is a breaking change. Name the apps you checked and what changed in the PR. Run the full set (not `--direct`)
before opening the PR. Needs each app's `yarn install` and a Playwright Chromium (or Google Chrome); `--no-visual`
still gives call sites and types.

## 2. Grep every app for affected usage

`impact.mjs` sees tags and auto-imported calls. Also grep for what it can't see: `pt` keys, `gallopUi.pt` entries,
data attributes, CSS that targets layer markup, and test assertions:

```sh
for layer in ~/Projects/*/layers/gallop-ui; do
  app=$(dirname "$(dirname "$layer")")
  [ -d "$app/.git" ] || continue            # a worktree (its .git is a file): the main checkout covers it
  git -C "$app" fetch -q origin
  echo "== $app"; git -C "$app" grep -n -E "<pattern>" origin/main -- app tests
done
```

Grep `origin/main`, not the working tree: main checkouts may have uncommitted work and stale branches, and
worktrees of the same app are duplicates.

## 3. Before/after screenshot sweep (for an app after a pull, or a risky layer change)

- **Before** = the app at `origin/main` in a detached worktree; **after** = your branch. Both against the **same
  throwaway database**, seeded once, each on its own port.
- Screenshot the main pages, and every page that uses an affected component, at **1280 and 390, light and dark**.
  Force the scheme with Playwright `colorScheme`, or `?theme=dark` on `/_ui`.
- **Exercise the interactions,** not just the resting page: open popovers and menus, open Selects by mouse and by
  keyboard, type into fields, turn a page, sort, drag a Board card, open a Modal over a Select.
- Keep the screenshots in a scratch folder, never in a repo. List every difference in the PR with the reason it
  is intended, or fix it.

## 4. Computed-style comparison (when "looks the same" must be exact)

Pixels hide small shifts. For a component swap or a restyle, compare computed styles and box geometry with
Playwright: `getComputedStyle` (font size, line height, padding, colours, border, radius) and
`getBoundingClientRect` (height, width), old against new. Do it at rest and with `:hover`, `:focus-visible` and
`:active` forced through CDP (`CSS.forcePseudoState`), in light and dark. A temporary page that renders each case
side by side (`app/pages/zz-<name>.vue` in the throwaway worktree, never committed) makes the comparison
mechanical.

Check at 1280 that desktop is identical when a change was meant to be phone-only, and at 390 that fields in one row
still match in height and text size.

## 5. Tables

- **Inventory before replacing.** List every behaviour a table has in both layouts (sort, multi-sort, filter, paging,
  page size, selection, row link or click, actions, reorder, empty, loading, sticky header, keyboard). That list is
  the contract and goes in the PR body. Measure old against new, including speed on a throttled phone.
- **Stateful cells need `:key="row.id"`.** DataTable patches rows in place on a page turn, so a component with state
  inside a cell slot (an inline editor, an input, an open Tooltip, local `ref` state, focus) keeps that state at the
  same position on the next page unless it is keyed by row. Grep every `#cell-*` slot in every affected app, add the
  key, and prove it by turning the page with the state active.
- Phone tables become cards by default. That is an improvement, not a regression.

## 6. Throwaway databases only

Never point a check at a real local database or a real `.env`. Run a disposable Postgres on your own port:

```sh
docker run -d --rm --name <app>-check -p <port>:5432 -e POSTGRES_PASSWORD=postgres postgres:17 \
  -c fsync=off -c synchronous_commit=off -c full_page_writes=off -c timezone=America/New_York
```

Point the app's DB URLs at that port in an env file inside your worktree (copied from `.env.example`), migrate and
seed it, and remove the container when done. Never use ports 5432, 5433 or 3306, even if they are free.
