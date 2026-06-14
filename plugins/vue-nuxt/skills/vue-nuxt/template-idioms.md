# Template & vue-tsc idioms

Smaller Vue-shaped template patterns and the compile errors they prevent.

## Never two handlers of the same event on one element

Two `@keyup.*` (or two `@keydown.*`) modifier handlers on one element both compile
to a single `onKeyup` object property → vue-tsc fails with **TS1117 "duplicate
property"**, and only one wires up at runtime. Use a single handler and branch:

```vue
<!-- ❌ <input @keyup.enter="submit" @keyup.esc="cancel" /> -->
<input @keyup="onKey" />
<!-- function onKey(e) { if (e.key === 'Enter') submit(); else if (e.key === 'Escape') cancel() } -->
```

## Scoped-CSS reach: `:deep()`, `:slotted()`, `:global()`

Scoped CSS adds a data attribute that only matches the component's own elements.
Three pseudo-selectors reach past that boundary:

```vue
<style scoped>
.prose :deep(table) { @apply w-full; } /* child/3rd-party-rendered HTML (markdown, rich text) */
:slotted(p) { @apply mt-2; }            /* content the PARENT passed into a <slot> */
:global(body) { @apply antialiased; }   /* escape scope to a global rule */
</style>
```

`:deep()` for descendants the component renders dynamically, `:slotted()` for
slot content the caller supplied (scoped styles don't reach it by default), and
`:global()` for the occasional global rule without a second `<style>` block.

## Click-outside: match a unique marker class

Scope document click-outside detection to a **purpose-named marker class** added
solely for it — never `target.closest('.relative.flex')` or other structural
Tailwind selectors that silently match unrelated elements:

```vue
<div class="send-menu relative …">
<!-- if (!e.target.closest('.send-menu')) close() -->
```

## `<NuxtLink>` and a thin `app.vue`

Use `<NuxtLink to="…">` for internal navigation (client routing + prefetch), not a
raw `<a>`. Keep `app.vue` a thin shell — `<NuxtLayout><NuxtPage /></NuxtLayout>`
plus app-global hosts (a `<Toast />`, a confirm dialog). `NuxtLink`/`NuxtLayout`/
`NuxtPage` are auto-imported.

## Per-page `<head>` with `useHead`

Set the document title/head reactively and SSR-safely with `useHead` in
`<script setup>` — never `document.title`. Set a default in `app.vue` and override
per page:

```ts
useHead({ title: 'Invoices' })            // page
// app.vue: useHead({ titleTemplate: (t) => (t ? `${t} · Acme` : 'Acme') })
```

## Reset a file input after reading it

`<input type="file">` won't re-fire `change` for the same file twice — clear it
after handling so re-selecting the same file works:

```ts
function onFile(e: Event) { const t = e.target as HTMLInputElement; /* …read t.files… */ t.value = '' }
```

## Status → label/severity lookup

Map enums to labels/severities with a small `Record` lookup + `||` fallback,
called as a plain function (functions, not `computed`, when they take a per-row
argument):

```ts
const SEV: Record<Status, string> = { paid: 'success', overdue: 'danger' }
const sev = (s: Status) => SEV[s] || 'secondary'
```

## `v-bind` same-name shorthand

When a bound attribute matches the variable name (Vue 3.4+), drop the value —
`:src` expands to `:src="src"`. Terser, and worth recognizing when reading code:

```vue
<img :src :alt />   <!-- ≡ :src="src" :alt="alt" -->
```

## `useId()` for stable, SSR-safe element IDs

Wiring `<label for>` / `aria-describedby` needs an ID that's stable across SSR and
hydration — a hand-rolled counter or `Math.random()` causes a hydration mismatch.
`useId()` (Vue 3.5, auto-imported) gives an app-unique, hydration-stable ID:

```ts
const id = useId()   // <label :for="id">Email</label> <input :id :aria-describedby="`${id}-help`">
```

## `<Teleport>` overlays out to `body`

Render modals/dropdowns/toasts to `<body>` so they escape a parent's
`overflow: hidden`, `z-index`, or `transform` stacking context (the usual cause of
a dialog clipped inside a scrolling panel):

```vue
<Teleport to="body"><div class="modal">…</div></Teleport>
```

`<Teleport>` is auto-imported. (Volt/PrimeVue overlays already teleport
internally; this is for your own hand-rolled overlays.)

## `<KeepAlive>` caches toggled-component state

Wrap a dynamic `<component>`/`v-if` swap in `<KeepAlive>` to preserve a toggled
child's state (a half-filled form, scroll position) instead of remounting it.
Teardown gotcha: a cached component fires `onActivated`/`onDeactivated`, **not**
`onMounted`/`onUnmounted` — put pause/resume logic there, not in the mount hooks:

```vue
<KeepAlive :include="['EditForm']"><component :is="currentTab" /></KeepAlive>
```

## `v-memo` / `v-once` for expensive render subtrees

Declarative render-skipping for big lists/tables. `v-once` renders a subtree once
and never updates it; `v-memo="[deps]"` skips a `v-for` row's re-render unless a
dep changes. Reach for these only when a large grid actually shows up in a profile
— not by default.

```vue
<div v-for="row in rows" :key="row.id" v-memo="[row.id === selectedId]">…</div>
```

## One-off caveats (not general conventions)

These surfaced once each — apply only if they bite, don't treat as rules:

- **Confirm which motion library is installed** before animating: `motion-v` uses the component API (`<motion.div :initial :animate>`), while `@vueuse/motion` uses the `v-motion` directive (`:visible-once`). They're different packages.
- **A parent's `whitespace-nowrap`** (common on table `th`/`td`) is inherited by a child tooltip/popover and forces it onto one overflowing line — reset with `whitespace-normal break-words` on the bubble.
