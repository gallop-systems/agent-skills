# Tailwind v4 Gotchas

Mined from real debugging sessions in this stack (Nuxt/Vite + Tailwind v4 +
PrimeVue/Volt). Each is a place where a class silently did nothing, a v3 habit
broke, or the fix was non-obvious.

## `@apply` of custom tokens in a `<style>` block needs `@reference` to YOUR css

In v4, a component-scoped `<style>` doesn't see your Tailwind context. `@apply`
there needs a `@reference` — and the trap is that `@reference "tailwindcss"` loads
only the **default** theme, so built-in utilities (`rounded-lg`, `zinc-*`) work
but your custom `@theme` tokens fail with *"Cannot apply unknown utility class."*

```css
/* ❌ @reference "tailwindcss";  → @apply text-fg fails */
@reference "~/assets/css/main.css";   /* ✅ exposes YOUR tokens */
.prose :where(h2) { @apply text-fg; }
```

Prefer the bundler alias (`~/` in Nuxt, or your Vite alias) over a relative
path — `@tailwindcss/vite` resolves aliases in `@reference` fine, and the alias
survives file moves. A relative path (`"../assets/css/main.css"`) is depth-
sensitive: move the file a directory deeper (e.g. a route-namespace refactor)
and the production build fails with
`[@tailwindcss/vite:generate:build] Can't resolve '../assets/css/main.css'` —
typecheck, tests, and dev can all stay green; only the real build catches it.

Better still in scoped styles: skip `@apply` and consume the generated CSS
variables directly — `color: var(--color-fg)` always works with no `@reference`.

Note: a full `yarn build` validates `@apply` in `<style>`; a bare
`@tailwindcss/cli` compile does **not** — the CLI can pass while the real build
fails. Include `build` in your check. (The SFC-specific details live in the
**volt-primevue** skill's gotchas.)

## `@theme` variables no utility references are pruned from the output

v4 treats `@theme` as a **source of utilities**, and by default only emits the
custom properties that something in the compiled output actually references (a
generated utility like `bg-series-1`). A token read **only** through a raw
`var()` — an inline `:style` binding, a `<style>` block, a JS-computed style —
looks unused to the compiler and is dropped. Nothing errors: the build, the
linter and typecheck are all clean, and the variable is simply absent from the
emitted CSS.

```css
@theme {
  --color-series-1: #4f46e5;   /* ❌ pruned: no utility class ever uses it */
}
```
```vue
<span :style="{ backgroundColor: 'var(--color-series-1)' }" />  <!-- renders transparent -->
```

Sibling tokens in the same block can survive while these vanish — semantic ones
like `--color-surface` stay because `bg-surface`/`text-fg` are used throughout the
templates.

Two fixes, depending on what the token is for:

```css
/* Read only through var() → plain :root. Plain custom properties are never pruned. */
:root {
  --color-series-1: #4f46e5;
}

/* Genuinely part of the theme (should ALSO generate utilities) → @theme static,
   which emits every variable in the block regardless of use. */
@theme static {
  --color-series-1: #4f46e5;
}
```

Rule of thumb: `@theme` is for values you want turned into utility classes;
`:root` is for values you want to read directly.

**Diagnostic signal:** a value silently falling back — a transparent background,
an inherited color, a `var()` with no fallback resolving to nothing — while the
build is completely clean. If `var(--token)` renders as nothing, check whether the
token is declared in `@theme` and never used as a utility *before* suspecting
scope or specificity.

Overriding such a variable in `@media (prefers-color-scheme: dark) { :root { … } }`
is unaffected: that is a plain CSS block, and the pruning happens only on the
`@theme` declaration side.

## `@import url(...)` must come before `@import "tailwindcss"`

The CSS spec requires all `@import` statements to precede other rules. Because
`@import "tailwindcss"` inlines real rules, any plain `@import url(...)` (e.g.
Google Fonts) placed after it is invalid and silently dropped.

```css
@import url("https://fonts.googleapis.com/css2?family=Inter");  /* ✅ first */
@import "tailwindcss";
@import "some-lib/dist/style.css";
```

## JS-set colors can't read `var(--color-*)` — they won't flip with the theme

Anything that takes colors as JS values (ApexCharts, canvas, SVG attributes
written from script) can't use `bg-surface`/`var(--color-fg)` — the value is baked
at render and won't follow `prefers-color-scheme`. A `colors: ["#18181b"]`
(near-black) chart line is invisible on dark. Compute a palette from a
`window.matchMedia("(prefers-color-scheme: dark)")` match and recompute on its
`change` event. (The volt-primevue skill has the Vue composable version.)

## Two surface systems: PrimeUI's ramp is fixed, your `@theme` tokens flip

- PrimeUI's `--p-surface-0 … --p-surface-950` ramp is defined **once** and does
  **not** change with the theme. `bg-surface-0` is always white — to go dark you
  need an explicit `dark:bg-surface-900` pair. Vendored Volt components rely on
  this full 0–950 ramp.
- Your `@theme` semantic tokens (`--color-surface`, `--color-fg`) **flip their
  value** in the dark `@media` block, so `bg-surface` needs no `dark:`.

Rule: tokenize only the markup you own (pages, your components). Leave vendored
Volt components on the `surface-*` ramp + `dark:` pairs so they stay
upstream-compatible. Mixing the two is what produces white-striped tables on dark.

## Don't port a v3 `tailwind.config.js` into a v4 app

None of it applies, and some of it actively breaks:

```js
// ❌ v3 — delete the whole file in v4
module.exports = {
  content: ["./**/*.vue"],        // → automatic detection (+ @source for out-of-tree)
  darkMode: "class",              // → @custom-variant dark (...) in CSS, or rely on @media
  theme: { extend: { colors: {...} } }, // → @theme { --color-* } in CSS
  plugins: [require("...")],      // → @plugin / @import in CSS; require() also breaks in ESM
};
```

Also drop the `@nuxtjs/tailwindcss` module — it's v3-era and has been observed to
trigger an infinite dev-server regeneration loop. Use `@tailwindcss/vite`.

## Benign noise

Under Yarn (esp. PnP), `@tailwindcss/vite` and `tailwindcss-primeui` may emit
"doesn't provide vite/tailwindcss" unmet-peer-dependency warnings even though the
deps resolve transitively. These are safe to ignore — they are not a config bug.
(Adding `tailwindcss` as a direct dependency silences the `tailwindcss-primeui` one.)
