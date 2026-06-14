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
2. **Regeneration convenience.** `volt-vue add` scaffolds a component in the
   upstream `surface-*` + `dark:` convention. Restyle it and you own that file —
   re-adding or pulling a newer version later means redoing your edits. Leaving
   Volt as-generated keeps that escape hatch cheap. (This is a convenience cost,
   not "you diverge from upstream forever" — there's no continuous sync; you add
   once and own it either way.)
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
