# Storage (unstorage / `useStorage`)

Nitro's `useStorage()` is a unified KV abstraction (powered by unstorage). It's
the right tool for cross-request ephemeral state — rate-limit counters,
idempotency keys, short-lived caches, one-off blobs — **without** a Postgres
table. Auto-imported in `server/`.

> This is a KV store, not the app database. Persistent relational data still lives
> in Kysely/Postgres (`server/utils/db.ts`). Note both are called `useDatabase` in
> their respective worlds — see [server-runtime.md](./server-runtime.md).

## Basic use

```typescript
const store = useStorage("redis");        // a configured mount, or useStorage() for default (memory/fs)

await store.setItem("rate:user:42", { count: 1, resetAt });
const hit = await store.getItem<{ count: number }>("rate:user:42");
await store.removeItem("rate:user:42");
const keys = await store.getKeys("rate:");  // prefix scan
```

`setItem`/`getItem` JSON-serialize automatically; use `getItemRaw`/`setItemRaw`
for binary/strings you don't want parsed.

## Configuring mounts

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  nitro: {
    storage: {
      redis: { driver: "redis", url: process.env.REDIS_URL },
    },
    devStorage: {
      redis: { driver: "fs", base: "./.data/redis" },  // dev override → local fs
    },
  },
});
```

## Read bundled server assets

Files under `server/assets/` are readable (read-only) via the `assets:server`
mount — handy for seed data, templates, or fixtures shipped with the build:

```typescript
const seed = await useStorage("assets:server").getItem("seed.json");
```

## Gotchas

- **Default mount is memory (dev) — not durable.** For anything that must survive
  a restart or be shared across instances, configure a real driver (redis, fs, a
  cloud KV).
- **Multi-instance:** an in-memory mount is per-process; counters/locks across
  replicas need a shared driver (redis).
- **The `cache` mount** is what [caching.md](./caching.md) writes to — point it at
  redis in prod so cached responses are shared.
