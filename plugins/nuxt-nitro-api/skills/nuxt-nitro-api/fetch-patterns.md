# Fetch Patterns

## The Three Methods

| Method | SSR | When to Use |
|--------|-----|-------------|
| `useFetch` | Yes | Default for page data loading |
| `$fetch` | No | Event handlers (onClick, onSubmit) |
| `useAsyncData` + `$fetch` | Yes | Custom cache keys, combining fetches |

## useFetch (Default Choice)

```typescript
// Basic - types inferred from Nitro
const { data, status, refresh, error } = await useFetch("/api/users");

// With reactive query params - auto-refetches on change
const search = ref("");
const page = ref(1);
const { data } = await useFetch("/api/users", {
  query: { search, page },  // Reactive refs
});

// Computed query for conditional params
const queryParams = computed(() => ({
  ...(search.value ? { search: search.value } : {}),
  offset: page.value * 20,
}));
const { data } = await useFetch("/api/users", {
  query: queryParams,
});

// Dynamic URL with getter function
const userId = ref("123");
const { data } = await useFetch(() => `/api/users/${userId.value}`);

// Transform response before caching
const { data } = await useFetch("/api/users", {
  transform: (response) => response.users.map(u => u.name),
});

// Reduce SSR payload size
const { data } = await useFetch("/api/users", {
  pick: ["id", "name"],  // Only these fields
});
```

### New Options (Nuxt 3.14+)

```typescript
const { data } = await useFetch("/api/data", {
  // Retry on failure
  retry: 3,
  retryDelay: 1000,

  // Request deduplication
  dedupe: "cancel",   // Cancel previous (default)
  // dedupe: "defer",  // Wait for existing

  // Built-in debounce
  delay: 300,  // Wait before making request
});
```

## Debounced Search Pattern

```typescript
const search = ref("");
const debouncedSearch = refDebounced(search, 300);  // Auto-imported

const { data } = await useFetch("/api/search", {
  query: computed(() => ({
    ...(debouncedSearch.value ? { q: debouncedSearch.value } : {}),
  })),
});

// Reset pagination when filters change
watch([debouncedSearch, categoryFilter], () => {
  page.value = 0;
});
```

## useAsyncData + $fetch

Use when you need:
1. Custom cache key
2. Combine multiple fetches
3. Non-HTTP async operations

```typescript
// Custom cache key
const { data } = await useAsyncData("my-key", () =>
  $fetch("/api/users")
);

// Combining fetches
const { data } = await useAsyncData("combined", async () => {
  const [users, roles] = await Promise.all([
    $fetch("/api/users"),
    $fetch("/api/roles"),
  ]);
  return { users, roles };
});
```

## $fetch (Client-Only)

Only use in event handlers - never at component top level:

```typescript
const handleSubmit = async () => {
  const result = await $fetch("/api/users", {
    method: "POST",
    body: { name: "Test" },
  });
};

const handleDelete = async (id: number) => {
  await $fetch(`/api/users/${id}`, { method: "DELETE" });
  refresh();  // Refresh useFetch data
};
```

## Invalidating after a mutation

`refresh()` re-pulls a single `useFetch`. When a mutation affects data loaded by
**other** components, use the global `refreshNuxtData(keys?)` instead of wiring
cross-component refresh plumbing — it re-runs every matching `useFetch`/
`useAsyncData` payload:

```typescript
await $fetch("/api/invoices", { method: "POST", body });
await refreshNuxtData(["invoices", "invoice-summary"]);  // re-pull by explicit key
// refreshNuxtData() with no args refetches everything (use sparingly)
```

For this to target precisely, give the fetches explicit keys
(`useAsyncData("invoices", …)` / `useFetch("/api/invoices", { key: "invoices" })`).
`clearNuxtData(keys?)` drops cached payload + error state without refetching (e.g.
reset a wizard's loaded data on cancel).

## Type Inference

Template literals preserve type inference (fixed late 2024):

```typescript
const userId = "123";  // Type is "123" (literal)
const result = await $fetch(`/api/users/${userId}`);
// result typed from handler return type

// Generic string loses precision
const userId: string = "123";  // Type is string
const result = await $fetch(`/api/users/${userId}`);
// result is union of all matching routes
```

### Static route shadowing a dynamic sibling

Template-literal inference normally resolves a dynamic route fine. But adding a
**static** route under an existing `[param]` directory makes a template-literal
`$fetch` to the dynamic sibling ambiguous. E.g. adding
`server/api/invoices/summary.get.ts` next to `server/api/invoices/[id].get.ts`:
the typed-route map now matches both `/api/invoices/:id` and
`/api/invoices/summary`, so inference can't tell which `$fetch(\`/api/invoices/${id}\`)`
means — and typecheck fails on the existing callers.

Disambiguate by casting the URL to the specific route id (NOT the response
type — that still defeats response inference):

```typescript
// Ambiguous after adding the static `/api/invoices/summary` route:
const invoice = await $fetch(`/api/invoices/${id}`);

// RIGHT - name the route id; the response stays inferred
const invoice = await $fetch(`/api/invoices/${id}` as "/api/invoices/:id");
```

Expect this side effect whenever you add a static endpoint beside a `[param]`
one — you'll need to touch the existing dynamic-route callers.

### TS2589 once the app passes ~200 API routes

**Symptom:** `TS2589: Type instantiation is excessively deep and possibly
infinite` on ordinary, untyped `useFetch("/api/...")` / `$fetch(url)` calls — in
files your change never touched — right after adding a few routes.

**Cause:** Nitro v2 types each call by scoring the URL against *every* key of
`InternalApi` with a recursive template-literal type (`MatchedRoutes` →
`CalcMatchScore`). Around 204 routes that exceeds TypeScript's instantiation
limit ([nuxt/nuxt#33735](https://github.com/nuxt/nuxt/issues/33735); upstream
closed as not planned, [nitrojs/nitro#2758](https://github.com/nitrojs/nitro/issues/2758)).
It is the route **count**, not one handler: removing any one new route makes
it pass, adding any one back fails it.

**Don't** add `$fetch<T>()` / `useFetch<T>()` generics at the failing sites.
That short-circuits the matcher at those calls only; the overflow moves to the
next untyped call site, and fixing two call sites can turn 2 errors into
hundreds.

**Fix:** a types-only `yarn patch` of `nitropack` that replaces the scoring fold
with a shallow per-segment matcher (exact key → direct index; `:param` and
`/**` segments; query string stripped). Responses stay inferred and nothing at
runtime changes.

```bash
yarn patch nitropack          # prints a temp dir holding an editable copy
# edit <temp-dir>/dist/types/index.d.ts: replace the `type MatchedRoutes<...> = ...;`
# declaration (the one using Extract<Matches, { exact: true }>) with:
```

```typescript
type __Seg<R extends string, K extends string> = K extends `:${string}` ? (R extends "" ? false : true) : K extends `**${string}` ? true : R extends K ? (K extends R ? true : false) : false;
type __M<R extends string, K extends string> = K extends `${infer Kh}/${infer Kr}` ? (R extends `${infer Rh}/${infer Rr}` ? (__Seg<Rh, Kh> extends true ? __M<Rr, Kr> : false) : false) : K extends `:${string}` ? (R extends `${string}/${string}` ? false : R extends "" ? false : true) : K extends `**${string}` ? true : R extends K ? (K extends R ? true : false) : false;
type MatchedRoutes<Route extends string> = Route extends "/" ? keyof InternalApi : Route extends `${infer Base}?${string}` ? MatchedRoutes<Base> : Route extends keyof InternalApi ? Route : { [K in keyof InternalApi]: __M<Route, K & string> extends true ? K : never }[keyof InternalApi];
```

```bash
yarn patch-commit -s <temp-dir>   # writes .yarn/patches/nitropack-npm-<version>-<hash>.patch
                                  # and a "resolutions" entry in package.json
yarn install && yarn typecheck
```

Verified on nitropack 2.13.4 (Nuxt 4.4). Notes:

- **Re-make the patch when `nitropack` is bumped** (the patch pins one
  version); otherwise the error returns. Say so in the project's CLAUDE.md.
- Real response types coming back can surface response-shape errors that the
  overflow had been hiding as `any` — budget time to fix those.

**Never add manual types:**
```typescript
// WRONG - defeats inference
const result = await $fetch<User>("/api/users/123");

// RIGHT - let Nitro infer
const result = await $fetch("/api/users/123");
```

## Common Mistakes

1. **Using `$fetch` in `onMounted`** - Use `useFetch` instead
2. **Manual watchers for refetch** - Query refs are auto-watched
3. **Adding type params** - Types are inferred from Nitro
4. **Using `watch` option for dynamic URLs** - Use getter function
5. **Passing null/undefined in query** - Filter them out first
