# VueUse — reach for a composable before hand-rolling an effect

`watch.md` lists the cases where `watch` is legit: they're all effects that cross
**out of** the reactive graph (DOM, timers, storage, URL, the network). For most
of those, **VueUse already wraps the boundary** — and a VueUse composable bundles
the *teardown* with the reactive effect, so it retires the manual-`onUnmounted`
cleanup, not just the watch. Before you write a `watch` + `onMounted`/`onUnmounted`
pair against a browser API, check whether a composable does it.

> Not a replacement for the framework. Data fetching stays on
> `useFetch`/`useAsyncData` (see `nuxt-nitro-api`); cookies use Nuxt's built-in
> `useCookie`; derivation stays a `computed`. VueUse is for the *external-world*
> effects — see the caveats at the bottom.

## Setup in Nuxt

Add the module; it auto-imports every `@vueuse/core` function, so they need no
explicit `import` (same as Nuxt's own composables — see `auto-imports.md`):

```ts
// nuxt.config.ts
export default defineNuxtConfig({ modules: ['@vueuse/nuxt'] })
```

The **`@vueuse/router`** and **`@vueuse/integrations`** add-ons are separate
installs and are **not** auto-imported by the module — import them explicitly.

## The boundary cases (mapped from `watch.md`)

| You were about to `watch` for… | Reach for | Why it's better |
|---|---|---|
| `document.body.style.overflow` toggle | `useScrollLock(document.body)` | writable ref; restores the prior value on unmount |
| `setInterval` polling | `useIntervalFn(fn, ms)` / `useTimeoutPoll` | **auto-clears on unmount** — no `clearInterval` to forget |
| `setTimeout` | `useTimeoutFn(fn, ms)` | same auto-cleanup, with `start`/`stop` controls |
| debounced auto-save | `useDebounceFn` / `refDebounced` | no manual timer ref + cleanup |
| `localStorage`/`sessionStorage` write-back | `useLocalStorage(key, init)` / `useStorage` | a reactive ref mirrored to storage both ways — the write-back watch disappears |
| `addEventListener` in `onMounted` | `useEventListener(target, evt, fn)` | auto-removes on unmount |
| click-outside marker class | `onClickOutside(el, fn)` | replaces the hand-rolled document listener (cf. `template-idioms.md`) |
| `ResizeObserver` re-measure | `useElementSize` / `useElementBounding` / `useResizeObserver` | reactive size, observer torn down for you (cf. `reactivity.md`) |
| `matchMedia` listener | `useMediaQuery` / `usePreferredColorScheme` / `usePreferredDark` | reactive boolean, no listener bookkeeping |
| clipboard write + "copied!" flag | `useClipboard()` → `{ copy, copied }` | `copied` auto-resets |

URL sync (`router.replace({ query: { ...route.query, tab } })`) →
`useRouteQuery('tab')` from `@vueuse/router` gives a ref bound two-way to the query
param. Nuxt's own `useRoute()` is already reactive for *reads*; reach for
`useRouteQuery` when you want a **writable** ref bound to a single param.

## VueUse's `watch` sugar — when a `watch` IS warranted

When the effect genuinely belongs in a watcher, VueUse's Watch category removes the
boilerplate `watch.md` warns about:

- **`watchDebounced(src, cb, { debounce: 300 })`** / **`watchThrottled`** — the
  debounced-auto-save case without a `setTimeout` inside the callback.
- **`whenever(source, cb)`** — fires only when `source` becomes truthy; the
  "re-seed on dialog open" pattern (`watch(visible, v => { if (v) … })`) as one line.
- **`until(source).toBe(x)`** — await a reactive condition instead of polling.
- **`watchOnce`** — auto-stops after the first fire; no manual `stop()` handle.
- **`watchIgnorable` / `watchPausable`** — suppress or pause a watcher around a
  programmatic write (a cleaner answer than guard flags for the "re-fires on
  programmatic reseed" trap in `watch.md`).

`onWatcherCleanup` and `flush: 'post'` (in `watch.md`) still apply — these are sugar
over the same watcher, not a different mechanism.

## Caveats — don't over-reach

- **Cookies:** use Nuxt's built-in **`useCookie`** (SSR-aware), not VueUse's
  `@vueuse/integrations` `useCookies` (a `universal-cookie` wrapper).
- **Fetching:** `useFetch`/`useAsyncData`/`$fetch` own the data layer
  (`nuxt-nitro-api`). Skip VueUse's `useFetch`/`useAsyncState` in a Nuxt app.
- **Head/title:** prefer Nuxt's `useHead`/`useSeoMeta` over `useTitle`/`useFavicon`.
- **Derivation is still a `computed`.** VueUse doesn't change the core rule: if the
  body just assigns one reactive value from others, it's a `computed`, not a
  composable and not a watch.
