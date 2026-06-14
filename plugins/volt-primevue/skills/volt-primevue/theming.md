# Theming & dark mode

Dark mode follows the OS: `@media (prefers-color-scheme: dark)`. No toggle, no
`dark` class on `<html>`. Tailwind v4's `dark:` variant also keys on
`prefers-color-scheme` by default, so everything reacts to the same signal.

There are **two color systems** in play, and the whole skill is knowing which to
use where.

## The two layers

| | App markup (you own) | Volt internals (vendored) |
|---|---|---|
| **System** | semantic `@theme` tokens | `surface-*` scale + `dark:` pairs |
| **Example** | `bg-surface text-fg` | `bg-surface-0 dark:bg-surface-900` |
| **How it flips** | the `--color-*` var changes value in the dark media block | each shade is fixed; the component picks the dark end with `dark:` |
| **You write** | once | both halves |

### Why not use semantic tokens everywhere (incl. Volt)?

You *can* — Volt components are vendored and editable, so nothing stops you from
restyling one to `bg-surface text-fg`. The reasons not to are practical, in
descending order of weight:

1. **Vocabulary mismatch (the real one).** Semantic tokens are a small,
   opinionated set (`surface`, `surface-muted`, `line`, `fg`, `fg-muted`, …) for
   "card / text / border" decisions. A component library reaches all over the
   0–950 ramp — subtle fills, two border weights, icon idle vs hover, elevation
   layering. To express all of Volt in tokens you'd expand them until they *are*
   the ramp, at which point you've just renamed `surface-*`.
2. **Consistency with newly-added siblings.** `volt-vue add` always scaffolds in
   the upstream `surface-*` + `dark:` convention, so keeping existing components on
   it means every Volt file reads the same way and a freshly-added one drops in
   without restyling. This is a mild *consistency* benefit, **not** a regeneration
   one: there's no `volt-vue update` and no continuous sync — you own each file the
   moment you add it, edits or not. (Upstream behavior fixes ride the `primevue`
   version bump, not a re-add.)
3. **The convention they ship in.** As generated, `--p-surface-0…950` are fixed
   (never flipped), so a Volt component flips by *picking the dark end* with
   `dark:bg-surface-900` — not by a value that changes. Semantic tokens flip the
   variable's value instead, so one class covers both schemes. You could rewrite
   a component to the token style, but then you're back to reasons 1 and 2.

## The token set

Defined in `app/assets/css/main.css`: light values in a top-level `@theme`
block, dark values overriding the same `--color-*` vars inside the
`prefers-color-scheme: dark` media block.

```css
@theme {
  --color-canvas: #fafafa;        /* app background */
  --color-surface: #ffffff;       /* cards, panels, dialogs */
  --color-surface-muted: #fafafa; /* subtle fills, row hover */
  --color-line: #e4e4e7;          /* borders */
  --color-line-soft: #f4f4f5;     /* soft dividers */
  --color-fg: #18181b;            /* primary text */
  --color-fg-muted: #71717a;      /* secondary text */
  --color-fg-subtle: #a1a1aa;     /* tertiary text */
  --color-accent: #18181b;        /* inverted/primary fills (buttons) */
  --color-on-accent: #ffffff;     /* text/icon on an accent fill */
  --color-fill: #e4e4e7;          /* neutral solid fills: avatars, tracks, dots */
}

@media (prefers-color-scheme: dark) {
  :root {
    --color-canvas: #09090b;
    --color-surface: #18181b;
    --color-surface-muted: #27272a;
    --color-line: #27272a;
    --color-line-soft: #27272a;
    --color-fg: #f4f4f5;
    --color-fg-muted: #b4b4bc;    /* lifted off a strict mirror-invert for legibility */
    --color-fg-subtle: #8c8c95;   /* ~5.5:1 on near-black */
    --color-accent: #f4f4f5;      /* inverts so filled buttons read on dark */
    --color-on-accent: #18181b;
    --color-fill: #3f3f46;
  }
}
```

The dark `fg-muted` / `fg-subtle` are **lifted** off a strict mirror-invert —
the perfectly-inverted values are too dark to read on near-black.

### Where each layer lives (and why it's not fighting Volt)

[Volt's Nuxt setup](https://volt.primevue.org/nuxt/#css-variables) prescribes the
`--p-*` palette + semantic tokens in **`:root`**, with dark mode via
`@media (prefers-color-scheme: dark)`. Keep that exactly as-is — don't move
`--p-*` into `@theme`; the `tailwindcss-primeui` plugin already turns them into
`surface-*` / `primary-*` utilities.

Your semantic tokens go in **`@theme`** instead, because that's the Tailwind v4
mechanism that generates the utilities (`--color-canvas` → `bg-canvas`). Defining
them only in `:root` would set the variable but produce **no class**. So:

- `--p-*` → `:root` (Volt's way; plugin generates `surface-*`)
- `--color-*` → `@theme` (Tailwind's way; generates `bg-surface`, `text-fg`, …)

Different namespaces, no collision: `bg-surface-0` (primeui, numbered) and
`bg-surface` (your token, bare) coexist. Dark values for **both** sit in the same
`prefers-color-scheme` block — your `--color-*` overrides next to Volt's `--p-*`
overrides.

## Ignore styled-mode theming (`definePreset`, `theme.preset`)

Most PrimeVue theming docs describe **styled** mode — `definePreset`, `theme: {
preset: Aura }`, component design tokens like `button.background`. Volt runs
PrimeVue with **`unstyled: true`**, which turns all of that **off**: the built-in
CSS and preset machinery aren't loaded, so a `definePreset`/`theme.preset` config
does nothing here. If you're following a primevue.org theming tutorial and it
reaches for `definePreset`, stop — that's the wrong layer. Your knobs are the
`--p-*` variables in `:root` (Volt's way) plus the Tailwind `@theme` tokens above.

(The `--p-*` variable **prefix** still applies — `tailwindcss-primeui` reads it.
It's the preset/design-token *machinery* that's inert, not the variables.)

## The naming trap (this one bites)

In Tailwind v4 the utility name is the **full** variable suffix:

- `--color-fg-subtle` → `text-fg-subtle`  ✅
- `text-subtle` ❌ — generates **nothing**, element falls back to near-black

A wrong/shortened token name fails silently (no class generated), so a
suspicious "secondary text is black in dark mode" is almost always a misnamed
token, not a wrong value. **Compile the CSS and grep the generated utilities** —
don't eyeball the browser.

## Adding a new token

1. Add `--color-foo: <light>;` to the `@theme` block.
2. Add `--color-foo: <dark>;` inside the dark media block.
3. Use `bg-foo` / `text-foo` / `border-foo` — done, both schemes covered.

No `dark:` variant, ever, for app markup. If you're typing `dark:` in a page or
app component, you're reaching for the wrong layer.
