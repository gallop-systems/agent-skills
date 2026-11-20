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

## Errors, status and stale data

These are the `useFetch`/`useAsyncData` semantics (read from the Nuxt 4 runtime)
that generated code gets wrong most often. How to *render* them (loading, error
with Retry, empty, data; double submit; stale responses) is in the `vue-nuxt`
skill's `async-state.md`.

- **Nothing throws.** A failed request sets `error`, resets `data` to its
  `default()` (`undefined` unless you passed one) and sets `status` to `'error'`.
  `await useFetch(...)`, `await refresh()` and `await execute()` all **resolve**. A
  `try/catch` around them catches nothing, so check afterwards:

  ```typescript
  await refresh();
  // also check status: a refresh superseded by a newer one resolves with no error
  if (error.value || status.value !== "success") {
    reportError("Couldn't reload the invoice");  // your app's toast/alert
    return;                         // don't send, advance "as of", or redirect on stale data
  }
  ```

- **`data` being empty is not an answer.** `data` is `undefined` while loading,
  after a failure and when the server returned nothing, so `!data.value` can't mean
  "no rows" or "no access". Branch on `status`/`error` first. A failed permission or
  integration check is **unknown** (show an error and Retry), never "denied", and
  don't pick a view from `data` until `status === 'success'`.
- **`status` can start at `'idle'`.** With `server: false` the whole server render
  and the first client render are `'idle'`, not `'pending'`, and with
  `immediate: false` it stays `'idle'` until `execute()` runs. A skeleton gated on
  `status === 'pending'` alone doesn't appear. Treat `'idle'` as loading when the
  fetch is going to start by itself.
- **A new key keeps the old data.** When a reactive URL/key changes, the new entry
  starts with the **previous key's `data`** while `status` is `'pending'` (a plain
  `refresh()` likewise keeps `data` until replaced). So the screen shows last month's
  report under this month's heading, and buttons act on it. Hide the data and disable
  actions until `status === 'success'` for the current key.
- **Start every fetch before awaiting any.** In a custom composable, code after an
  `await` can run without the Nuxt instance ("Nuxt instance unavailable"), and
  sequential awaits are slower anyway. Start both, then await together:

  ```typescript
  const invoices = useFetch("/api/invoices");
  const totals = useFetch("/api/invoices/totals");
  await Promise.all([invoices, totals]);
  ```

  In a page, give `useHead`/`useSeoMeta` a getter (`title: () => data.value?.name ?? 'Project'`)
  so the title follows the data; a plain value read once at setup goes stale.
- **Polling:** a 401 from a background poll means the session ended; clear the
  state, don't restore the old value. Tolerate a transient failure or two, but cap
  the loop and then report "unknown", not "failed".
- **Capped lists:** a picker or "upcoming vs past" split built from one `limit`-ed
  page silently omits rows. Search server-side (with a stable order) or fetch every
  page before splitting.

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
6. **`try/catch` around `refresh()`** - It never throws; check `error.value` after it (see above)
7. **Rendering `!data` as "nothing here"** - A failed load is an error state, not an empty one
