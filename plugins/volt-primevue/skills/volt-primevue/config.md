# PrimeVue plugin config

Options passed where PrimeVue is registered (`app.use(PrimeVue, { … })` / the Nuxt
module config), beyond colors. Volt runs **`unstyled: true`** — keep that; it's
what makes the components unstyled (and what makes styled-mode theming inert; see
[theming.md](./theming.md)).

## App-wide section styling: global `pt`

Instead of repeating the same `pt:` on every call site, set defaults once with a
global `pt` object keyed by lowercase component name → sections. A component-level
`pt:` still overrides the global:

```ts
app.use(PrimeVue, {
  unstyled: true,
  pt: {
    dialog: { header: { class: "border-b border-line" } },  // every dialog's header
    select: { dropdown: { class: "text-fg-muted" } },
  },
  ptOptions: { mergeSections: true, mergeProps: true },
});
```

`ptOptions` governs how global + local combine: `mergeSections` (default `true`)
merges section objects; `mergeProps` (default `false`) merges class/listener
props rather than replacing. Set `mergeProps: true` if you want a call-site
`pt:` to *add to* the global classes instead of replacing them. (Note the vendored
components already pass their own `mergeProps: ptViewMerge` per-component — see
[gotchas.md](./gotchas.md).)

## Config knobs worth knowing

```ts
app.use(PrimeVue, {
  unstyled: true,
  zIndex: { modal: 1100, overlay: 1000, menu: 1000, tooltip: 1100 },  // overlay stacking
  locale: { /* aria, filter, date strings — overrides built-in en defaults */ },
});
```

- **`zIndex`** — the dial when a Volt overlay (dialog, menu, tooltip) renders
  under or over app chrome. Defaults: modal/tooltip `1100`, overlay/menu `1000`.
- **`locale`** — overrides all built-in aria labels, filter/date/pagination
  strings (i18n, or just rewording an aria label).
- **`inputVariant: 'outlined' | 'filled'`** — default `outlined`; affects input
  styling defaults.
- **`ripple`** — irrelevant under unstyled (no ripple CSS), harmless if set.

Don't set `theme` / `definePreset` — inert under `unstyled: true`
([theming.md](./theming.md)).
