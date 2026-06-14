# Response & Function Caching (Nitro)

Nitro ships a KV-backed cache layer with stale-while-revalidate and per-key
invalidation. Reach for it before adding a memoization Map or a Postgres cache
table. All helpers are **auto-imported in `server/`**.

> **Nitro v2 names** (this project — see [server-runtime.md](./server-runtime.md)).
> `nitro.build` documents v3, which moves these to `import { … } from "nitro/cache"`.
> Here they are auto-imported globals.

## `defineCachedFunction` — cache an expensive async function

```typescript
const getStars = defineCachedFunction(
  async (repo: string) => {
    const { stargazers_count } = await $fetch(`https://api.github.com/repos/${repo}`);
    return stargazers_count as number;
  },
  {
    maxAge: 60 * 60,       // serve from cache for 1h
    swr: true,             // after maxAge, serve stale and revalidate in the background
    name: "ghStars",
    group: "nitro/functions",
    getKey: (repo) => repo,  // cache key from the args
  },
);

await getStars("unjs/nitro");
await getStars.invalidate("unjs/nitro");  // drop one key on demand (e.g. after a mutation)
```

`getKey` is what makes it safe to call with different arguments — without it,
every arg shares one cache entry.

## `defineCachedEventHandler` — cache a whole endpoint

```typescript
export default defineCachedEventHandler(
  async (event) => ({ now: Date.now(), data: await loadData() }),
  {
    maxAge: 60,
    swr: true,
    varies: ["host"],                        // vary the key on these headers
    shouldBypassCache: (event) => !!getQuery(event).fresh,  // skip cache for ?fresh=1
    getKey: (event) => event.path,
  },
);
```

Don't cache an endpoint whose body depends on the session/user unless you `vary`
on the discriminator — otherwise one user's response is served to another.

## Where the cache lives

The cache backs onto the `cache` **storage mount** (see [storage.md](./storage.md)):
filesystem in dev, whatever you mount (Redis, etc.) in production. Configure via
`nitro.storage` / `nitro.devStorage` in `nuxt.config.ts`.

## Gotchas

- **`maxAge` is seconds, not ms.**
- **`swr: true`** means a request after expiry gets the *stale* value immediately
  while a background refresh runs — great for latency, but readers can see
  slightly old data. Omit it for must-be-fresh endpoints.
- **Invalidate on write.** After a mutation changes the source data, call
  `fn.invalidate(key)` — caches don't know your DB changed.
- **Route-level caching** for simple cases can be declared without a handler
  wrapper via `routeRules` (`swr` / `cache`) — see [route-rules.md](./route-rules.md).
