# Nitro Server Runtime (version, middleware, context, $fetch, ws)

Server-side mechanics that aren't endpoints or validation: which Nitro you're on,
how `server/middleware/` runs, reading the event without threading it, the
internal-`$fetch` auth trap, and the WebSocket option.

## ⚠️ Version: Nitro follows Nuxt — you're on v2

Nitro's version is **set by Nuxt, not chosen by you**. Nuxt 4.x ships
`@nuxt/nitro-server`, which depends on `nitropack ^2.x` — you have no direct
`nitropack` dependency to bump. **`nitro.build` now documents Nitro v3**, a
separate in-progress major Nuxt has not adopted; copying its examples verbatim
gives you code that doesn't compile here. Ignore the v3 renames until Nuxt ships
on v3. Map back to v2:

| v3 docs (nitro.build) | v2 (this project) |
|---|---|
| `defineHandler` | `defineEventHandler` (auto-imported) |
| `definePlugin` | `defineNitroPlugin` |
| `import { defineCachedEventHandler } from "nitro/cache"` | auto-imported global |
| `features: { websocket: true }` | `experimental: { websocket: true }` |
| `routes/` directory | `server/` directory |
| `render:response` → `response` hook | `render:response` |

When unsure, trust the installed `node_modules/nitropack/dist/runtime/*.d.ts`
over the website.

## Server middleware (`server/middleware/`)

Every request runs **all** files in `server/middleware/` (not route-scoped).
Three rules that bite:

- **Order is filename order** — prefix numerically: `1.logger.ts`, `2.auth.ts`.
- **Don't return a value.** Returning a body **ends the request** there. Set
  `event.context.*` and return nothing.
- **Scope by checking `event.path`** yourself — there's no per-path registration.

```typescript
// server/middleware/2.auth.ts — runs after 1.*, sets context, returns nothing
export default defineEventHandler((event) => {
  if (!event.path.startsWith("/api/")) return;
  event.context.user = parseUser(event);   // ❌ a `return user` here would 200 every request
});
```

## `useEvent()` — read the event without threading it

With `experimental.asyncContext: true` (set in `nuxt.config.ts`), `useEvent()`
returns the current `H3Event` from async context, so deep util/service layers can
read the session/headers without every caller passing `event` down:

```typescript
// nuxt.config.ts → nitro: { experimental: { asyncContext: true } }
import { useEvent } from "nitropack/runtime";   // auto-imported in server/

export async function currentUser() {
  const event = useEvent();                       // no event parameter needed
  return (await getUserSession(event)).user;
}
```

Node-runtime only; it's flagged experimental. Without the flag, `useEvent()`
throws — keep threading `event` explicitly.

## Internal `$fetch` does NOT forward cookies

On the server, `$fetch("/api/…")` to an internal route short-circuits HTTP (direct
handler call — faster), but it **does not carry the incoming request's
cookies/headers**. A session-dependent internal call silently sees no user. Pass
them through:

```typescript
// inside a handler, calling another internal route that needs the session:
await $fetch("/api/me", { headers: { cookie: getHeader(event, "cookie") ?? "" } });
```

## WebSockets — when SSE isn't enough

[sse.md](./sse.md) covers one-way streaming. For bidirectional (client → server),
Nitro has `defineWebSocketHandler` behind `experimental.websocket: true` (NOT v3's
`features.websocket`), with built-in pub/sub:

```typescript
// server/routes/ws.ts
export default defineWebSocketHandler({
  open(peer) { peer.subscribe("room"); },
  message(peer, msg) { peer.publish("room", msg.text()); },  // publish excludes sender
  close(peer) { /* cleanup */ },
});
```

## Two `useDatabase`s — don't confuse them

Nitro ships its own `useDatabase()` (a `db0`-backed SQL layer, gated on
`experimental.database`). This project **shadows** it with the Kysely
`useDatabase()` in `server/utils/db.ts` (see [composables-utils.md](./composables-utils.md)).
Use the Kysely one; don't enable `nitro.database` or import Nitro's.
