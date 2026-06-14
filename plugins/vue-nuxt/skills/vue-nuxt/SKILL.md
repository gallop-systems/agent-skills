---
name: vue-nuxt
description: Author Vue 3 components inside a Nuxt 4 app. Covers Nuxt auto-import rules, component authoring (props/emits/withDefaults/generics), v-model/defineModel, reactivity, when watch is a code smell, and Vue-shaped template idioms.
---

# Vue-in-Nuxt component authoring

Patterns for writing Vue 3 `<script setup>` components inside a Nuxt 4 app. This
is the **frontend authoring** slice — the data layer (`useFetch`/`$fetch`, SSR
storage, hydration, `definePageMeta`/auth, formatters) lives in the
`nuxt-nitro-api` skill; Volt/PrimeVue styling and dark mode live in
`volt-primevue`. This skill cross-links to those rather than restating them.

## When to Use This Skill

- Authoring or reviewing a `.vue` component in a Nuxt 4 project
- Deciding how a component is named / auto-imported
- Typing props & emits, defaulting props, building a generic component
- Wiring `v-model` on a component
- Anything reactivity-shaped: `computed` vs `watch`, prop→state sync, DOM measurement
- You see `watch` and want to know if it should be something else

## Reference Files

- [auto-imports.md](./auto-imports.md) — what auto-imports (components with dir-prefix names, composables, utils, Vue/Nuxt APIs) and what does NOT (third-party, types, test files)
- [component-authoring.md](./component-authoring.md) — type-only `defineProps`/`defineEmits`, `withDefaults`, the Boolean-prop trap, factory defaults, generic components, `defineExpose`, what to extract into a shared component
- [v-model.md](./v-model.md) — `defineModel` vs the props+emit+computed proxy, named models, paired fields
- [reactivity.md](./reactivity.md) — pure computeds, mutate-don't-reassign, DOM-measure + `ResizeObserver`, watch-getter prop sync, `:key` remount, listener cleanup
- [watch.md](./watch.md) — **`watch` is the escape hatch, not the default**: when it's right, and the four smell shapes (with refactors) found auditing 159 real watchers
- [template-idioms.md](./template-idioms.md) — duplicate-`@keyup` TS error, `:deep()`, click-outside marker class, `NuxtLink`/thin `app.vue`, `useHead`, file-input reset

## Core Principles

1. **Lean on auto-imports.** `app/components`, `app/composables`, `app/utils`, and the Vue/Nuxt APIs all auto-import. Add an explicit `import` only for third-party symbols and TS types. A nested component's tag carries its directory as a prefix (`components/customers/ProfileCard.vue` → `<CustomersProfileCard>`).
2. **Type props/emits, default the booleans.** Use the type-only macros (`defineProps<{...}>()`, `defineEmits<{...}>()`). A bare `boolean` prop coerces to `false` when absent (not `undefined`), so any "defaults-on" flag MUST use `withDefaults`. Give array/object defaults a factory.
3. **`computed` for derivation, `watch` for escaping the graph.** If a watcher body just assigns one reactive value from others, it's a `computed`. Need to write a value back? A `computed` can have a setter — reach for a writable `computed` or `defineModel` before a sync watcher. Keep computed getters pure (no fetch, no mutation, no DOM).
4. **Tie effects to lifecycle.** DOM measurement, listeners, observers, and timers go in `onMounted` and are torn down in `onUnmounted`. A computed reading live DOM geometry needs an explicit re-measure signal (DOM size isn't reactive).
5. **Call composables at the top of `<script setup>`** — never inside a callback or a template expression (both lose Nuxt's request scope). Derive display state with `computed`, guarding for possibly-null data.
6. **Defer to the right skill.** Fetch/SSR/auth/middleware → `nuxt-nitro-api`. Volt components, `pt:` styling, color tokens, dark mode → `volt-primevue`. Don't duplicate them here.

## Contributing Back

If you hit a Vue-in-Nuxt authoring gotcha this skill doesn't cover (or one it gets
wrong), upstream it — run `/contribute-skill`.
