# `watch` — the escape hatch, not the default

`watch` reactively performs **side effects**. It is not for deriving values —
that's `computed`. Heavy `watch` use is usually a `computed`, a *writable*
`computed`, a `defineModel`, or an event handler in disguise.

**Rule of thumb:** read the watcher body. If it ends by assigning one reactive
value from others and nothing leaves Vue's world (no fetch, DOM, third-party lib,
storage, URL), delete it and write a `computed`.

> Grounded in a 159-watcher audit across 7 Nuxt apps: **77% were legitimate, ~9%
> clear smells, ~14% borderline.** The smells clustered into the four shapes
> below; over half the *borderline* cases were one pattern ("reset a field in a
> watcher"). The legit cases are real — the trap is using `watch` for what the
> framework already does declaratively.

## Writing a value back? Use a writable `computed`, not a watch

The most common reason people reach for `watch` is to *write a value back* —
mirror a prop, transform a bound value, proxy a child's `v-model`. A `computed`
can have a setter; use it.

```ts
// ❌ two watches mirroring a prop both ways — desyncs, pure boilerplate
const visible = ref(props.visible)
watch(() => props.visible, (v) => (visible.value = v))
watch(visible, (v) => emit('update:visible', v))

// ✅ writable computed — one source of truth, genuinely two-way
const visible = computed({
  get: () => props.visible,
  set: (v) => emit('update:visible', v),
})
// ✅ or, for a component's OWN model: const visible = defineModel<boolean>('visible')
```

A writable `computed` also transforms a value across the boundary (string ↔ Date):

```ts
const date = computed({
  get: () => parseISO(model.value),
  set: (d) => (model.value = d.toISOString()),
})
```

(Both getter and setter receive the previous value as their first argument if you
need it.)

Two rules from the Vue docs that keep this correct:

- **Getters must be side-effect-free.** A `computed` getter only derives and
  returns — no mutating other state, no async, no DOM. Side effects *in reaction
  to* a change are what `watch` is for.
- **A computed value is a read-only snapshot.** Never mutate what a `computed`
  returns; update the *source* state it derives from and let a new snapshot be
  produced.

## When `watch` IS the right tool

Only when the effect crosses **out of** the reactive graph:

- **Fetch on a changing key** — prefer a reactive `useFetch` `query`/key (it
  auto-refetches; see `nuxt-nitro-api/fetch-patterns.md`). Reach for `watch` only
  for imperative `$fetch` keyed off a single id.
- **Drive a non-Vue library** — Tiptap, a Leaflet/Google map, a signature canvas,
  a PrimeVue popover you `.hide()` imperatively.
- **DOM / timers** — `document.body.style.overflow`, a debounce `setTimeout`, a
  polling `setInterval` (clear it in `onUnmounted`).
- **Persist** — a `localStorage`/`useCookie` write, debounced auto-save of a
  deep-watched form.
- **URL sync** — `router.replace({ query: { ...route.query, tab } })`.
- **Re-seed local state on dialog open** — `watch(visible, (v) => { if (v) initForm() })`.
  The single most common legit pattern.
- **Clone a server prop into a locally-editable draft** —
  `watch(() => props.record, (r) => { if (r) form.value = structuredClone(toRaw(r)) }, { immediate: true })`.

### Cancel stale work with `onWatcherCleanup`

A watcher that starts async work (a keyed `$fetch`, a timer) must cancel the
previous run, or out-of-order responses clobber state — the #1 correctness bug in
keyed-fetch watchers. Vue 3.5's `onWatcherCleanup(fn)` registers teardown that
runs before the next fire and on stop:

```ts
import { onWatcherCleanup } from 'vue'

watch(query, async (q) => {
  const ctrl = new AbortController()
  onWatcherCleanup(() => ctrl.abort())   // abort the in-flight request if q changes again
  results.value = await $fetch('/api/search', { query: { q }, signal: ctrl.signal })
})
```

Gotcha: `onWatcherCleanup` only registers **synchronously, before the first
`await`**. For teardown decided after an await, use the callback's third arg
instead — `watch(src, (v, _old, onCleanup) => { … onCleanup(fn) })`.

### `flush: 'post'` runs the callback after the DOM patches

When a watcher reacts to a change by reading/scrolling the **updated** DOM, give
it `{ flush: 'post' }` so it runs after Vue patches — no manual `await nextTick()`.
They're ~one microtask apart and interchangeable; pick by clarity (prefer
`flush: 'post'` for an effect that *reacts to reactive change*, `nextTick` for a
one-shot after an imperative toggle).

```ts
watch(activeId, () => scrollActiveIntoView(), { flush: 'post' })  // DOM already updated
```

## Smell catalog (with refactors)

| Smell | Tell | Reach for |
|---|---|---|
| **derive-state** | body assigns a filtered/mapped view into another ref | `computed` |
| **prop-sync** | local `ref(props.x)` kept in sync by a watch (often + a 2nd watch emitting back) | `defineModel` or a writable `computed` |
| **side-effect-in-handler** | watching a value that only changes via one control, to clear a dependent field | that control's `@update:model-value` handler |
| **manual-refetch** | watching filter refs to call a function that calls `useFetch` | a `computed` `query` passed to `useFetch` |

The biggest real cluster was **side-effect-in-handler** — resetting dependent
fields when a Select changed. In a watcher it hides cause/effect and re-fires on
programmatic form reseeds; the colocated handler is direct and only fires on the
user action:

```ts
// ❌ watch(() => form.entityType, () => { form.eventType = ''; form.conditionValue = null })
// ✅
function onEntityType(v) { form.entityType = v; form.eventType = ''; form.conditionValue = null }
//   <Select v-model="form.entityType" @update:model-value="onEntityType" />
```

Watch for **cascades** — a chain of watches each resetting the next (entityType →
eventType → conditionProperty) is just a chain of handlers, far harder to follow.

**Borderline tell — `seed-via-immediate`:** `watch(asyncList, (l) => { if (!local.value) local.value = pick(l) }, { immediate: true })` to default a *user-mutable* ref from fetched data is defensible (a pure `computed` can't be user-overridden) — but keep the `!local.value` guard so a refetch doesn't clobber an in-progress edit.

## `deep: true` is expensive — use it sparingly

A deep watch traverses **every** nested property of the watched object on each
check, so it gets costly on large structures. Before reaching for it:

- **Watch a getter of the specific field** instead of the whole object:
  `watch(() => form.address.zip, ...)` rather than `watch(form, ..., { deep: true })`.
- If you genuinely need to react to *any* field of a form (e.g. debounced
  auto-save), a deep watch is legitimate — but scope it as tightly as you can.
- For deriving from a few keys of a nested object, a `computed` (or `watchEffect`)
  tracks **only the keys actually read**, avoiding the full traversal a deep watch
  pays for.

**Deep-watch aliasing trap:** in a deep watch the callback's `oldValue` and
`newValue` are the **same reference** (Vue mutated the object in place), so you
*cannot* diff old-vs-new inside the callback — `if (next.x !== prev.x)` is always
false. Watch a derived getter instead, so old/new are distinct primitives:

```ts
// ❌ watch(items, (next, prev) => { if (next.length !== prev.length) … }, { deep: true })  // never fires
// ✅ watch(() => items.value.length, (next, prev) => { if (next > prev) onAdded() })
```

## `watch` vs `watchEffect`

Both run side effects reactively; they differ in how they **track dependencies**:

- **`watch(source, cb)`** tracks ONLY the explicit source, fires lazily and only
  when it *actually changed*, and hands you **old + new** values. Use it when you
  want precise control over what fires the effect, need the previous value, or
  want it lazy.
- **`watchEffect(cb)`** runs immediately and auto-tracks every reactive property
  read during its **synchronous** execution. Terser, and it removes the burden of
  maintaining a source list — genuinely better for a side effect with **several**
  dependencies, or one reading a few keys of a nested object (it tracks only
  what's used, unlike a `deep` watch).

```ts
// watch: todoId named twice (source + inside callback)
watch(todoId, async () => { data.value = await $fetch(`/api/todos/${todoId.value}`) }, { immediate: true })
// watchEffect: todoId.value is both the read and the tracked dep — no immediate flag, no repeated source
watchEffect(async () => { data.value = await $fetch(`/api/todos/${todoId.value}`) })
```

Two cautions on `watchEffect`:

- **Async tracking gotcha:** it only tracks deps accessed **before the first
  `await`**. Read a ref *after* an `await` and it silently won't re-trigger on
  that ref. With multiple async deps, read them all up front or use an explicit
  `watch`.
- **It tempts the derive-state smell.** Because it runs immediately and
  auto-tracks, `watchEffect` is the most common home for "compute and assign" —
  which is a `computed`. The *only* `watchEffect` smell in the audit was exactly
  this: `watchEffect(() => { orgField.options = organizations.value })` → should
  be a `computed` that maps the field list.

Default: **`computed` for derivation, `watch` for a precise single-source effect,
`watchEffect` for a genuine multi-dependency side effect** whose deps are all read
synchronously.
