# Shared State with `useState`

Cross-component shared state in Nuxt is `useState` — NOT a module-scope `ref`.
This is the single most important state rule in an SSR app, because the wrong
version is a cross-request data leak, not just a bug.

## Never export a module-scope `ref`

A `ref` declared at module scope is created **once per server process** and shared
by every request the server handles. During SSR that means one user can see
another user's data. `useState(key, init)` creates state that is **per-request on
the server** and hydrated to the client:

```typescript
// ❌ SHARED ACROSS ALL SSR REQUESTS — leaks state between users
export const user = ref(null);

// ✅ keyed, per-request, hydration-safe — wrap it in a composable
export const useUser = () => useState("user", () => null);
```

Always expose `useState` through a `use*` composable so the key is defined once
and can't drift between call sites.

## Rules

- **Provide a factory initializer:** `useState("count", () => 0)`. The init runs
  on the server; the value is serialized into the payload and reused on the
  client (no re-init, no mismatch).
- **State must be JSON-serializable** — no class instances, functions, `Date`
  round-trips, or `Map`/`Set`. It travels through the SSR payload as JSON.
- **Same key = same state.** Two `useState("user")` calls anywhere in the app
  read/write the same cell. Namespace keys for anything non-global.
- **Reset with `clearNuxtState(key?)`** — clears one key or all keyed state (e.g.
  on logout).

```typescript
// composables/useFilters.ts — app-wide filter state, survives navigation
export const useFilters = () => useState("filters", () => ({ search: "", page: 1 }));
```

## `useState` vs the alternatives

| Need | Reach for |
|---|---|
| Shared reactive state across components, SSR-safe | `useState` |
| Per-request state that also persists in the browser across reloads | `useCookie` (small, ≤4 KB) — see [ssr-client.md](./ssr-client.md) |
| Client-only persistence (no SSR) | VueUse `useLocalStorage` — see [ssr-client.md](./ssr-client.md) |
| Cached server data | `useFetch`/`useAsyncData` (already keyed state) — see [fetch-patterns.md](./fetch-patterns.md) |

`useState` is plain shared state; it does NOT fetch or cache. For server data,
reach for `useAsyncData`/`useFetch` (which are themselves keyed payload state) and
invalidate with `refreshNuxtData` rather than mirroring fetched data into a
separate `useState`.

## Run one-time init with `callOnce`

To run a side effect **exactly once** across SSR + hydration (seed a store, fire a
one-time analytics/init call), use `callOnce` — not `onMounted` + a flag, which
re-fires on every client mount:

```typescript
await callOnce("init-analytics", () => initAnalytics());
// mode: "navigation" (3.15+) re-runs once per client-side navigation instead of once ever
```

`callOnce` returns nothing — it's for effects. For data, use `useAsyncData` (which
already de-dupes). The call must be unconditional (don't put it behind an `if`).
