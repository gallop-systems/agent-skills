# Nuxt Layers

Layers let multiple Nuxt projects share components, composables, utils, server
routes, and config. Relevant when a base/template repo feeds several apps — e.g. a
copier-scaffolded house style, or a shared design system across products.

## Extending

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  extends: [
    "../base-layer",          // local path
    "@my-org/nuxt-theme",     // npm package
    ["github:my-org/layer", { install: true }],  // remote
  ],
});
```

Auto-imports work **across** layers — a composable in the base layer is available
unprefixed in the consumer, same as a local one.

## Precedence

Project root **overrides** `~~/layers/*` (alphabetical) **overrides** `extends`
entries (in listed order). So a consumer can shadow any layer file by placing a
file at the same path. Local `~~/layers/*` directories are auto-registered without
listing them in `extends`; they also get `#layers/*` aliases.

## When a layer vs a package vs the agent-skills repo

| Sharing | Use |
|---|---|
| Runtime Nuxt surface (components, composables, server routes, config) | a **layer** (`extends`) |
| Framework-agnostic JS/TS logic | a plain npm package |
| Agent guidance / Claude skills | the `@gallopsystems/agent-skills` package |

Don't reach for a layer to share a pure function — that's a package. Layers earn
their weight when you're sharing *Nuxt-shaped* surface (auto-imported components,
pages, server handlers) and config.
