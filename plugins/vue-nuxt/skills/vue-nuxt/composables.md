# Authoring a composable

How to *write* a composable's reactive surface. The **decision** of composable vs
plain util lives in `nuxt-nitro-api/composables-utils.md` (logic that touches Vue
reactivity/lifecycle → composable; pure transform → util). This file is the
Vue-shaped mechanics: argument shape, what to return, and cleanup.

## Accept ref-or-getter-or-value; normalize with `toValue`

A reactive input should accept a plain value, a `ref`, **or** a getter — typed
`MaybeRefOrGetter<T>` and read through `toValue()` inside the effect. Don't branch
on `isRef`/`unref`, and don't read `.value` once at the top (that snapshots and
loses reactivity):

```ts
import { toValue, type MaybeRefOrGetter } from 'vue'

export function useDoubled(input: MaybeRefOrGetter<number>) {
  // re-reads through toValue on every recompute → tracks input if it's reactive
  return computed(() => toValue(input) * 2)   // caller passes 3, ref(3), or () => count.value
}
```

`toValue(x)` returns `x` for a plain value, `x.value` for a ref, `x()` for a
getter. This is the VueUse-shaped contract and the single biggest "make a
composable ergonomic" move — callers shouldn't have to wrap a literal in `ref()`
just to call you.

## Return a plain object of refs — not `reactive()`

Return refs/computeds in a **plain object**. A caller destructures the result, and
a plain object of refs survives destructuring; a `reactive()` return does not (the
properties detach into plain values). See [reactivity.md](./reactivity.md) for the
`ref`-over-`reactive` rule this mirrors.

```ts
export function usePager(total: MaybeRefOrGetter<number>) {
  const page = ref(1)
  const atEnd = computed(() => page.value >= toValue(total))
  return { page, atEnd }            // ✅ const { page } = usePager(n) stays reactive
  // ❌ return reactive({ page, atEnd })  → const { page } = … is a dead number
}
```

## Thin composable: pure core, reactive shell

Keep business logic in plain functions (no Vue import — trivially unit-testable,
no Nuxt context needed) and let the composable be a thin reactive wrapper that
wires that logic to `ref`/`computed`. This is "functional core, imperative shell"
applied to composables, and it matters here specifically: plain `*.test.ts` files
**don't** get Nuxt's auto-import context (see [auto-imports.md](./auto-imports.md)),
so pure functions test without `mountSuspended`.

```ts
// core.ts — pure, no Vue, unit-test directly
export const clampPage = (p: number, total: number) => Math.min(Math.max(p, 1), total)

// usePager.ts — thin shell
export function usePager(total: MaybeRefOrGetter<number>) {
  const page = ref(1)
  return { page, go: (p: number) => (page.value = clampPage(p, toValue(total))) }
}
```

## Clean up with `onScopeDispose` — not only `onUnmounted`

A composable that starts a listener/timer/observer must tear it down. Inside a
composable, register cleanup with **`onScopeDispose`** rather than `onUnmounted`:
it fires on component unmount too, but *also* works when the composable runs in a
detached `effectScope()` (a shared singleton, a manually-stopped scope) where
there's no component instance and `onUnmounted` would silently no-op.

```ts
export function useNow(intervalMs = 1000) {
  const now = ref(Date.now())
  const id = setInterval(() => (now.value = Date.now()), intervalMs)
  onScopeDispose(() => clearInterval(id))   // fires on unmount OR scope.stop()
  return { now }
}
```

For a composable that itself creates watchers/computeds you want to dispose as a
unit (a store you stand up and tear down by hand), wrap them in an
**`effectScope()`** and stop the whole scope at once:

```ts
const scope = effectScope()
scope.run(() => { /* watchers/computeds created here */ })
// later: scope.stop()  → disposes every effect created inside, and runs onScopeDispose
```

`useTemplateRef`, `MaybeRefOrGetter`, and the "return refs" rule together let a
composable own DOM refs and reactive inputs internally instead of demanding the
caller thread them in — see [reactivity.md](./reactivity.md) and
[component-authoring.md](./component-authoring.md).
