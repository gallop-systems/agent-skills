# Using gallop-ui in an app

How an app consumes the layer: what is available without imports, how to restyle it, and where the truth lives.
Check names against the subtree's docs (`layers/gallop-ui/components/<Name>/<Name>.md`): they are versioned with the
layer this app has, and this file is not.

## What you get without importing anything

Nuxt picks up `layers/*` on its own. From the layer:

- **Components** in `components/<Name>/` register by name: `<Button>`, `<Select>`, `<DataTable>`, `<Modal>`… Folders
  starting with `_` (`_field`, `_select`) are internals, never used directly.
- **Composables** in `composables/` are auto-imported: `useToast`, `useConfirm`, `useSubmit`, `useApiError`,
  `useCopy`, `useColorScheme`, `useSidebar`, `useRemoteOptions`, `useUnsavedGuard`, `useRowLink`, `defineShortcuts`,
  `defineCommands`… A `define…` composable registers something while the calling component is mounted and returns
  nothing; a `use…` composable returns state or functions. Anything under `runtime/` is private.
- **Formatters** (`shared/utils/`) are auto-imported plain functions that also work on the server: `formatDate`,
  `formatDateTime`, `formatRelative`, `formatCurrency`, `formatNumber`, `formatPercent`, `formatPhone`,
  `formatAddress`… Use them, never `Intl`, `toLocaleString` or date-fns `format()` in a component
  (`FORMATTERS.md`).
- **Mount-once pieces** go in `app.vue`: `<Toaster />` for `useToast()`, `<ConfirmDialog />` for `useConfirm()`.
- **Types** come from one import: `import type { Pt, GallopUiConfig } from "~~/layers/gallop-ui/types"`.

## Restyling: four levels, broad to narrow

| Level | Where | Use for |
|---|---|---|
| 1. Tokens | the app's CSS (`app/assets/css/main.css`), `--color-*` in `@theme` | The app's palette: every component follows it. |
| 2. App-wide classes and defaults | `app/app.config.ts` → `gallopUi.pt.<Component>.<section>`, `gallopUi.defaults.<Component>.<prop>` | The app's look for a component everywhere; app-wide `size` and the like. |
| 3. One instance | the `pt` prop: `:pt="{ item: 'py-1' }"` | Inner parts of one call site. |
| 4. One instance's root | `class` | `class` is `pt.root` at the call site. |

```ts
// app/app.config.ts
export default defineAppConfig({
  gallopUi: {
    timeZone: "America/New_York",            // formatters' and date pickers' default zone
    defaults: { Button: { size: "sm" } },     // an explicit prop still wins
    pt: { DataTable: { tableView: "rounded-lg" } },
  },
});
```

`gallopUi` is typed: a wrong component, section or default key is a type error, not a silent no-op. Each
component's `.md` "Customizing" section lists its sections. Some keys are shared (`Field` is the root of every
field, `Table` covers Table and DataTable's `<table>`, `Pill` also styles StatusPill, `Modal` also ConfirmDialog);
the README lists them.

### Merge order, and why `class` always wins

Every section merges through tailwind-merge in this order:

**layer default → app `gallopUi.pt` → `pt` prop → `class`** (for `root`).

A later class *replaces* a conflicting earlier one (`px-2` replaces the default padding); it doesn't add to it.
The layer writes every state it knows about (size, color, variant, disabled, invalid, checked, selected, open…) as
a plain class chosen in script, so a caller's class always beats it. What that means for you:

- To restyle a state the component knows, write a plain class: `class="px-2"` replaces the size's padding for
  every size. To target one size, use the data attribute the element renders: `data-[size=sm]:px-2`.
- `hover:`, `focus-visible:`, `active:` defaults are replaced by the same variant: `hover:bg-surface-muted`.
- States Reka changes while open (`data-highlighted`, `data-[state=open]`, `data-[side=…]`) are replaced only by the
  same variant in that section: `pt: { item: "data-highlighted:bg-fill" }`. A plain `bg-*` on an item doesn't change
  its highlighted look.
- **An app's `pt` merges with the defaults; it doesn't replace them.** A default `dark:` class survives unless you
  set the same property under `dark:`. When you recolour, restate the dark half (or, better, use tokens).
- Size an `<Icon>` with `text-*`, not `size-*` (@nuxt/icon sets width and height to `1em` outside Tailwind's
  layers).
- Overlays (Modal, Drawer, Popover, Tooltip, DropdownMenu) portal their box away: that box is `root`, so `class`
  still styles what you see. The backdrop is `overlay`.

## Tokens and dark mode

- **Dark mode is required in every app.** No light-only option, no pinned light colours.
- Each token is one `light-dark(<light>, <dark>)` declaration. What switches is `color-scheme`, set by the app's
  strategy: the OS (`:root { color-scheme: light dark }`, the template default), or an attribute on `<html>`
  (`data-color-scheme="light|dark"`, set from a cookie by `useColorScheme()`; no flash on first paint).
  `TOKENS.md` has the contract; `theme/neutral.css` has every value.
- In app code write token classes (`bg-surface`, `text-fg-muted`, `border-line`, `bg-danger-soft`), not
  `bg-white dark:bg-zinc-900`. Status colours are the `danger | warning | success | info` families.
- `yarn ui:tokens` checks the app's theme CSS against the contract: what is missing, what still has an old name.
- A Light / Dark / System choice is `useColorScheme()`, or `show-color-scheme` on Sidebar or TopBar.
- One UI font per app: `--font-sans` in `@theme` in `main.css`. Never set the font from a layout.

## Dates, times and time zones

- Instants display in `gallopUi.timeZone` (an app default; UTC with a dev warning when unset, never the browser's
  zone, which the server can't know). Pass `timeZone` per call when it differs per user.
- A date-only `"2025-01-28"` is never shifted. Bind date-only fields as strings (`InputDate model-type="string"`).
- `InputTime`'s `"HH:mm"` model is never shifted either.

## `/_ui`: the playground in every app

`yarn dev`, then open `/_ui` (development only; production never has it):

| URL | Shows |
|---|---|
| `/_ui` | Every component, searchable, grouped by tier. |
| `/_ui/<Name>` | Every story of one component, plus its `.md` in a tab. |
| `/_ui/<Name>/<story>` | One story with prop controls. |

Query parameters: `theme=light|dark`, `width=390` (a phone frame that triggers the app's breakpoints), `bare=1`,
`still=1` (no animation, for screenshots). The page renders in *this* app's tokens, fonts, `gallopUi.pt` and
`gallopUi.defaults`, so it is what this app's users see. Use it to choose a component and to check a restyle in
both schemes at 390.

## Finding things in the subtree

```sh
grep -i "date range" layers/gallop-ui/CATALOGUE.md          # which component
sed -n '/^## When not to use/,/^## /p' layers/gallop-ui/components/Select/Select.md
grep -rn "searchInput\|search-input" layers/gallop-ui/components/Select/Select.md
ls layers/gallop-ui/components layers/gallop-ui/composables
git log --oneline -3 -- layers/gallop-ui                    # which pull the app is on
```

## Per-app guards

- `yarn ui:check` (lefthook pre-commit, `--staged`) fails when a commit mixes `layers/gallop-ui` with app files, or an
  app component shadows a layer component.
- `yarn ui:test` (pre-push, CI) runs the layer's own tests against the app's dependencies.
- The app's linter, formatter and Renovate ignore `layers/gallop-ui`. Don't "fix" lint in it.
