# Route Rules

`routeRules` in `nuxt.config.ts` declaratively apply caching, headers, redirects,
proxying, and CORS per URL pattern — no handler code. Reach for them before
hand-rolling middleware to do what a rule does in one line.

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  routeRules: {
    "/api/**":          { cors: true },                          // CORS on all API routes
    "/api/realtime/**": { cache: false },                        // never cache SSE/streaming
    "/blog/**":         { swr: 3600 },                           // cache + revalidate hourly
    "/docs/**":         { prerender: true },                     // render at build time
    "/old-path":        { redirect: "/new-path" },               // 301 (redirectCode to change)
    "/external/**":     { proxy: "https://upstream.example/**" },// reverse-proxy
    "/admin/**":        { headers: { "X-Robots-Tag": "noindex" } },
  },
});
```

## Semantics

- **Specificity wins:** a more specific path overrides a general one; `/api/**`
  rules are overridden by `/api/realtime/**`.
- **`swr: N`** = stale-while-revalidate for N seconds; **`cache: { maxAge: N }`**
  for a plain TTL; **`cache: false`** disables inherited caching (use on
  streaming/per-user routes that a broader rule would otherwise cache).
- **`isr`** (incremental static regen) is the same idea on supported platforms.
- Rules apply to both Nitro routes and rendered pages under the path.

## When to use a rule vs a handler

| Want | Use |
|---|---|
| Cache/headers/redirect/proxy/CORS by path | `routeRules` |
| Per-key cache with invalidation, SWR on a function | `defineCachedFunction` — [caching.md](./caching.md) |
| Logic (auth, body inspection, dynamic redirect) | server middleware / handler — [server-runtime.md](./server-runtime.md) |

Don't write a middleware that just sets a static header or redirects a fixed path
— that's a route rule.
