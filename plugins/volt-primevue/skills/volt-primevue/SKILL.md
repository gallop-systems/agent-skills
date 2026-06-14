---
name: volt-primevue
description: Build UIs with Volt (unstyled PrimeVue + Tailwind). Covers adding components, pt: pass-through customization, choosing components, and the two-layer color model for prefers-color-scheme dark mode.
---

# Volt + PrimeVue UI

Volt components are **PrimeVue unstyled components styled with Tailwind**. They
ship as source you vendor into `src/volt/` and register with a `Volt` prefix, so
you own the markup but track upstream styling conventions.

## When to Use This Skill

- Building UI in a Nuxt + Tailwind v4 + PrimeVue/Volt project
- Adding or customizing a Volt component
- Anything color/theme/dark-mode related in this stack
- Deciding between a Volt component and a hand-rolled one

## What Volt is

- PrimeVue **unstyled** components + Tailwind classes, vendored under `src/volt/`.
- Registered with a `Volt` prefix via `nuxt.config.ts` (`<VoltButton>`, `<VoltCard>`, …).
- `app/assets/css/main.css` has `@source "../../../src/volt";` so Tailwind scans
  the vendored sources for class names. If a Volt class isn't generating, that
  `@source` line is the first thing to check.

## Adding components

Use the CLI — **never hand-create a Volt component**:

```bash
npx volt-vue add MultiSelect      # adds src/volt/MultiSelect.vue
```

Hand-writing one means you've guessed the PrimeVue part structure and the
`surface-*`/`dark:` conventions; the generator gets both right and stays
consistent with upstream.

## Customization — `pt:` pass-through

Volt uses PrimeVue's pass-through API. Target a component's internal section with
`pt:<section>:class`:

```vue
<VoltButton pt:root:class="bg-zinc-900 hover:bg-zinc-800" />
<VoltCard pt:root:class="rounded-2xl" pt:body:class="p-6" />
```

**Use `pt:`, not a plain `class`.** Volt merges classes with
[tailwind-merge](https://volt.primevue.org/overview/#twmerge), and the two paths
differ in precedence:

- `pt:{section}:class` is **merged with the component's defaults** and reliably
  overrides them — `pt:root:class="bg-primary"` wins.
- A plain `class="bg-primary"` has **lower precedence and may not apply** — its
  conflicting utilities can lose to the component's own classes.

So `<VoltInputText pt:root:class="bg-primary" />` works; `<VoltInputText
class="bg-primary" />` may silently not.

What `pt:` **can't** do is change DOM — it only restyles sections the component
already renders. To add an element the component doesn't have (e.g. an animated
overlay), you have two honest options, because Volt components are **vendored and
yours to edit** (see [Choosing a component](#choosing-a-component-volt-vs-custom)):
edit the component's source in `src/volt/`, or build a standalone component.

## Choosing a component: Volt vs custom

Volt gives you selection semantics + accessibility for free. The question is only
whether you need DOM/behavior the component doesn't render — and remember Volt
components are **vendored and editable**, so "the component doesn't do X" has
three answers, not two: restyle via `pt:`, **edit the source in `src/volt/`**, or
build standalone.

Worked example — **segmented toggle** (`SelectButton` vs a custom `SlidingTabs`):

- `VoltSelectButton` ships v-model, single/multi-select, label+icon options, and
  proper radiogroup a11y, with a *highlighted-active* look.
- A custom `SlidingTabs` adds an **animated indicator** (a single shared element
  that measures the active button and slides), responsive label collapse, and
  token-matched styling.
- The slide **can't** come from `pt:` — `SelectButton` toggles a background class
  per button and has no shared, position-measured overlay, and `pt:` changes
  classes, not DOM. But that doesn't force a rewrite: since the source lives in
  `src/volt/SelectButton.vue`, adding the indicator **there** is a legitimate
  option (you keep its a11y + selection model).

So the real decision:

- **No animation needed → `SelectButton` as-is** (`pt:` to match your design).
  Free a11y + multi-select; don't reinvent it.
- **Animated indicator / responsive collapse needed →** either **edit the
  vendored `SelectButton`** (keep its a11y, accept that you now own that file and
  lose easy `volt-vue add` regeneration) **or build a standalone `SlidingTabs`**
  (clean and decoupled, but you owe the a11y yourself — `role="group"` +
  `aria-pressed` at minimum). Standalone wins when it's a *filter* toggle rather
  than a form field; editing the source wins when you want the full input
  semantics.

## Theming & dark mode

This is the part people get wrong. Read **[theming.md](./theming.md)** — the
two-layer color model (`surface-*` for Volt, semantic tokens for your markup),
why they can't be unified, and the `prefers-color-scheme` mechanics.

The one-paragraph version: dark mode follows the OS via
`@media (prefers-color-scheme: dark)`. **Your app markup** uses semantic `@theme`
tokens (`bg-surface`, `text-fg`, `border-line`) written **once** — the
`--color-*` var flips in the dark media block, so there's no `dark:` half to
forget. **Volt internals** stay on the `surface-*` scale with explicit `dark:`
pairs — they need the full 0–950 ramp, and leaving them as `volt-vue add`
generated them keeps regeneration easy. You *could* restyle a vendored component
to tokens (it's your code), but the small token set can't express the whole ramp,
so don't — tokens for your opinionated markup, `surface-*` for the component
library.

## Gotchas

See **[gotchas.md](./gotchas.md)** — the ones that cost real debugging time:

- `@reference "main.css"` (not `"tailwindcss"`) for `@apply` of custom tokens in
  SFC `<style>` blocks.
- JS-driven colors (ApexCharts, canvas) can't read CSS tokens — pick them from a
  reactive `prefers-color-scheme` palette.
- A bare `boolean` prop casts to `false` when absent — default it with
  `withDefaults`, never rely on `undefined`.
