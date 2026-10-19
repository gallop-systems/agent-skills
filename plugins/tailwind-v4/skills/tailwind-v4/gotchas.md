# Tailwind v4 Gotchas

Mined from real debugging sessions in this stack (Nuxt/Vite + Tailwind v4 +
gallop-ui). Each is a place where a class silently did nothing, a v3 habit
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
fails. Include `build` in your check.

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
`change` event (VueUse's `usePreferredDark` does this in Vue).

## Tokens flip, raw palette classes don't

- Your `@theme` semantic tokens (`--color-surface`, `--color-fg`, `--color-line`) change value in the dark
  block, so `bg-surface` needs no `dark:`. gallop-ui components are written the same way.
- A raw palette class (`bg-white`, `text-zinc-700`) is fixed. It needs a `dark:` pair, and forgetting it gives
  white stripes on dark.

Rule: use tokens in app markup, so there is no `dark:` half to forget. Keep raw palette classes for meaning-carrying
hues (red for an error, green for success). Don't restyle layer components with `dark:` pairs: change the token.

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

Under Yarn (esp. PnP), `@tailwindcss/vite` may emit a "doesn't provide vite/tailwindcss"
unmet-peer-dependency warning even though the deps resolve transitively. It is safe to ignore,
and not a config bug. (Adding `tailwindcss` as a direct dependency silences the `tailwindcss` one.)
