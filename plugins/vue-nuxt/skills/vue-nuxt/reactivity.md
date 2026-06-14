# Reactivity gotchas

Derivation, prop sync, DOM measurement, remounting, and cleanup. For the
`watch`-vs-`computed` decision and the `watch` smell catalog, see
[watch.md](./watch.md).

## Keep computed getters pure

A `computed` getter derives and returns — nothing else. Mutating another ref/Set,
firing an async request, or touching the DOM inside a getter makes it
order-dependent, can re-trigger itself, and is undebuggable. Move side effects to
a `watch` or an event handler. (And never mutate a computed's *return* value —
it's a read-only snapshot; update the source state instead.)

## Mutate a ref's object in place — don't reassign

When a ref's object is bound to `v-model` inputs, update it **in place**;
reassigning a fresh literal swaps the proxied target the template tracks, and
later programmatic writes to the old reference are lost:

```ts
// ❌ form.value = { ...next }      // swaps the tracked proxy
// ✅
Object.assign(form.value, next)     // or per-key assignment
```

## Default to `ref`; reach for `reactive` rarely

`ref` is the default for all state. Use `reactive` only to **group** tightly
related fields or to wrap a non-Vue object (`Map`/`Set`). `reactive`'s traps are
why: it loses reactivity when **destructured** (the keys become plain values —
`toRefs` to recover) and when **reassigned wholesale** (the proxy identity swaps).
A `ref` has neither problem — `.value` is always the live cell.

```ts
const state = reactive({ count: 0 })
const { count } = state          // ❌ plain number now, not reactive
const { count } = toRefs(state)  // ✅ if you must destructure a reactive
// Rule: default ref(); reactive() only to group state or wrap Map/Set.
```

## Template refs: prefer `useTemplateRef`

To reach a DOM element or child component, use **`useTemplateRef('name')`** (Vue
3.5 / Nuxt 4) — pass the string that matches `ref="name"` in the template. It
self-documents that the value is an element/component handle, infers the type, and
lets a composable own the ref internally. The legacy "declare `const el =
ref(null)` whose variable name must match `ref="el"`" form still works but is
fragile to rename drift — prefer `useTemplateRef` in new code.

```ts
const input = useTemplateRef('input')          // <input ref="input">
onMounted(() => input.value?.focus())
// v-for: useTemplateRef returns an ARRAY, and its order is NOT guaranteed —
// key/sort yourself rather than trusting index alignment.
```

## DOM-measured computeds need a re-measure signal

DOM size isn't reactive, so a `computed` reading live geometry
(`offsetLeft`/`offsetWidth`) won't recompute on resize or a breakpoint flip. Add
an explicit version ref and bump it from a `ResizeObserver`:

```ts
const container = useTemplateRef('container')   // <div ref="container">
const layoutVersion = ref(0)
let ro: ResizeObserver | null = null
onMounted(() => { ro = new ResizeObserver(() => layoutVersion.value++); ro.observe(container.value!) })
onBeforeUnmount(() => ro?.disconnect())

const indicator = computed(() => {
  void layoutVersion.value          // subscribe to re-measure
  const b = buttons.value[active.value]
  return b ? { left: `${b.offsetLeft}px`, width: `${b.offsetWidth}px` } : { left: '0px', width: '0px' }
})
```

Measure conditionally-mounted elements only **after `await nextTick()`** (and hold
them via a null-guarded template ref) — right after toggling `visible`, the
element isn't laid out and a sync `getBoundingClientRect()` reads 0.

## React to prop changes with a watch on a getter

Props aren't directly watchable — watch a getter, and seed local state with
`{ immediate: true }`:

```ts
watch(() => props.thing, (next) => { local.value = next }, { immediate: true })
```

The legitimate prop→local case is **owning an editable draft**: a parent owns
server data via `useFetch` (keep `refresh`), passes it as a prop; the child clones
it into a local draft (`structuredClone(toRaw(prop))`), re-syncs on a watch of the
prop, and emits `@saved`/`@updated` so the parent re-fetches. Copy into local
state — never mutate the prop. (A bare `local = ref(props.x)` + sync watch with no
emit-back is the `prop-sync` smell — use `defineModel`; see [v-model.md](./v-model.md).)

## Remount on identity change with `:key`

```vue
<UserDetail :key="route.params.id" :id="route.params.id" />
```

Bind `:key` to the **identifying value** so the component remounts cleanly when
identity changes. Do NOT abuse an incrementing `:key="bump++"` to force a data
re-pull — that destroys child state/scroll; use a watcher or `refresh()` instead.
When a *full remount* genuinely is the goal (reset all of a child's internal
state), bumping `:key` is the right tool — and `$forceUpdate()` is the wrong one
(it re-renders but skips computeds and bypasses the reactivity graph; if you
"need" it, you have a reactivity bug to fix instead).

## Always pair setup with teardown

Anything started in `onMounted` — `addEventListener`, `setInterval`,
`ResizeObserver`, `MutationObserver` — must be torn down in
`onUnmounted`/`onBeforeUnmount` (`removeEventListener`, `clearInterval`,
`disconnect`). Keep the handle in a module-scope `let` so teardown can reach it.
Inside a **composable**, register teardown with `onScopeDispose` instead so it
also fires for a detached `effectScope` — see [composables.md](./composables.md).

## `shallowRef` for large or wholesale-replaced data

Deep reactivity has a cost: `ref`/`reactive` recursively proxy every nested
property. For a large list, a third-party class instance (a `Map`, an editor/map
object you drive imperatively), or data you always **replace wholesale** rather
than mutate, use `shallowRef` (or `shallowReactive`) — only `.value` reassignment
triggers, nested mutation does not.

```ts
const rows = shallowRef<Row[]>([])
rows.value = [...rows.value, next]   // ✅ replace .value — triggers
// rows.value.push(next)             // ❌ no trigger under shallowRef (use triggerRef if you must mutate)
```
