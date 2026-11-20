---
name: vue-nuxt
description: Author Vue 3 components inside a Nuxt 4 app. Covers Nuxt auto-import rules, component authoring (props/emits/withDefaults/generics), v-model/defineModel, slots, composables, reactivity, when watch is a code smell, reaching for VueUse over hand-rolled effects, page structure, display formatting, and Vue-shaped template idioms.
---

# Vue-in-Nuxt component authoring

Patterns for writing Vue 3 `<script setup>` components inside a Nuxt 4 app. This
is the **frontend authoring** slice — the data layer (`useFetch`/`$fetch`, SSR
storage, hydration, `definePageMeta`/auth) lives in the `nuxt-nitro-api` skill;
components, styling and dark mode live in `gallop-ui`. This skill
cross-links to those rather than restating them.

## When to Use This Skill

- Authoring or reviewing a `.vue` component in a Nuxt 4 project
- Deciding how a component is named / auto-imported
- Typing props & emits, defaulting props, building a generic component
- Wiring `v-model` on a component
- Designing a component's content API — props vs slots, named/scoped slots
- Authoring a composable — argument shape, what to return, cleanup
- Structuring a page — thin pages, components own the data + logic
- Formatting display values (currency/date/number) consistently
- Anything reactivity-shaped: `computed` vs `watch`, prop→state sync, DOM measurement
- You see `watch` and want to know if it should be something else
- About to hand-roll a `watch` + lifecycle teardown for a browser API (storage, timers, DOM, listeners, URL) — VueUse likely wraps it
- Writing a form, dialog or drawer that edits a record, or any component that loads or saves data

## Reference Files

- [auto-imports.md](./auto-imports.md) — what auto-imports (components with dir-prefix names, composables, utils, Vue/Nuxt APIs) and what does NOT (third-party, types, test files)
- [component-authoring.md](./component-authoring.md) — type-only `defineProps`/`defineEmits`, `withDefaults`, the Boolean-prop trap, factory defaults, generic components, `defineExpose`, what to extract into a shared component
- [v-model.md](./v-model.md) — `defineModel` vs the props+emit+computed proxy, named models, paired fields
- [slots.md](./slots.md) — slots vs props for markup, named/scoped slots, `defineSlots`/`useSlots`, avoiding empty wrappers, forwarding, slot transitions
- [composables.md](./composables.md) — `MaybeRefOrGetter`/`toValue` argument contract, return refs not `reactive()`, thin pure-core shell, `onScopeDispose`/`effectScope` cleanup
- [reactivity.md](./reactivity.md) — `ref` over `reactive`, `useTemplateRef`, pure computeds, mutate-don't-reassign, DOM-measure + `ResizeObserver`, `shallowRef`, watch-getter prop sync, `:key` remount, listener cleanup
- [watch.md](./watch.md) — **`watch` is the escape hatch, not the default**: when it's right, and the four smell shapes (with refactors) found auditing 159 real watchers
- [vueuse.md](./vueuse.md) — reach for a VueUse composable before hand-rolling a `watch` + lifecycle teardown for an external-world effect (DOM, timers, storage, URL, listeners); the `@vueuse/nuxt` setup, the watch-sugar functions, and what to keep on Nuxt's own APIs
- [template-idioms.md](./template-idioms.md) — duplicate-`@keyup` TS error, `:deep()`/`:slotted()`/`:global()`, click-outside marker class, `NuxtLink`/thin `app.vue`, `useHead`, `v-bind` shorthand, `useId`, `<Teleport>`/`<KeepAlive>`, `v-memo`/`v-once`, file-input reset
- [async-state.md](./async-state.md) — loading/error/empty as separate states, `refresh()` doesn't throw, success only on success, refreshing every view after a mutation, discarding stale responses (request tokens), one `router.replace`, double-submit and IME guards
- [editing-forms.md](./editing-forms.md) — forms/dialogs/drawers editing a record: seed on open and id change (or remount with `:key`), reset every transient, don't re-seed on refetch, seed every field and send what changed, selections whose options disappear, URL-mirrored state, reactive clocks
- [page-structure.md](./page-structure.md) — keep pages thin: route-param parsing + layout in the page, data/logic/forms in components
- [formatters.md](./formatters.md) — never inline a currency/date/number formatter; centralize in `useFormatters`, prefer Intl/date-fns

Testing note: when a Vue/Nuxt refactor changes component behavior, route/query
state, or a composable with lifecycle hooks, use the Nuxt frontend testing
guidance in `nitro-testing`'s [frontend-testing.md](../../../../nitro-testing/skills/nitro-testing/frontend-testing.md)
instead of testing those pieces as plain Vue functions.

## Core Principles

1. **Lean on auto-imports.** `app/components`, `app/composables`, `app/utils`, and the Vue/Nuxt APIs all auto-import. Add an explicit `import` only for third-party symbols and TS types. A nested component's tag carries its directory as a prefix (`components/customers/ProfileCard.vue` → `<CustomersProfileCard>`).
2. **Type props/emits, default the booleans.** Use the type-only macros (`defineProps<{...}>()`, `defineEmits<{...}>()`). A bare `boolean` prop coerces to `false` when absent (not `undefined`), so any "defaults-on" flag MUST be defaulted — via reactive destructure (`{ flag = true } = defineProps<…>()`, the 3.5 default, no factory needed for arrays/objects) or `withDefaults` (factory required for non-primitives).
3. **`computed` for derivation, `watch` for escaping the graph.** If a watcher body just assigns one reactive value from others, it's a `computed`. Need to write a value back? A `computed` can have a setter — reach for a writable `computed` or `defineModel` before a sync watcher. Keep computed getters pure (no fetch, no mutation, no DOM).
4. **Tie effects to lifecycle.** DOM measurement, listeners, observers, and timers go in `onMounted` and are torn down in `onUnmounted`. A computed reading live DOM geometry needs an explicit re-measure signal (DOM size isn't reactive). Before hand-rolling that effect-plus-teardown, check whether a **VueUse** composable already wraps it (`vueuse.md`) — they bundle the cleanup.
5. **Call composables at the top of `<script setup>`** — never inside a callback or a template expression (both lose Nuxt's request scope). Derive display state with `computed`, guarding for possibly-null data.
6. **Defer to the right skill.** Fetch/SSR/auth/middleware → `nuxt-nitro-api`. UI components, `pt` styling, color tokens, dark mode → `gallop-ui`. Don't duplicate them here.

## The traps reviewers flag most

These recur in review findings on components written with this skill loaded. Each
links to the rule and an example.

1. **Stale local state.** A draft, selection, preview or flag copied from a prop or
   fetched data keeps the previous record's value when the dialog reopens or the id
   changes. Seed on open and on id change (or remount with `:key="record.id"`), and
   reset every transient with it. → [editing-forms.md](./editing-forms.md)
2. **Stale async responses.** A request that resolves after the user switched
   record, reopened the dialog, typed again or left overwrites current state. Use
   `useFetch` with a reactive key, or a request token checked after every `await`.
   → [async-state.md](./async-state.md#stale-responses-an-older-request-must-not-overwrite-newer-state)
3. **Failures shown as empty or as success.** Render `error` before the empty state
   with a Retry; `refresh()` resolves on failure, so check `error.value` after it;
   emit `saved` and close only on success; reset loading flags in `finally`.
   → [async-state.md](./async-state.md)
4. **Other views not refreshed after a mutation.** Share one keyed fetch or refresh
   every list showing the changed data. → [async-state.md](./async-state.md#refresh-every-view-of-the-data-you-changed)
5. **The same rule computed twice.** Filters vs counts vs labels, preview vs action,
   button state vs message: one helper, every consumer. → [component-authoring.md](./component-authoring.md#one-rule-one-helper)
6. **Keyboard and copy gaps.** Clickable non-buttons, unfocusable tooltip triggers,
   icon buttons with no name, "0 items" sentences. → [template-idioms.md](./template-idioms.md#keyboard-and-screen-reader-access-for-custom-controls)
7. **Double submit.** Guard every mutating handler with an in-flight flag, not just
   `:disabled`; ignore IME-confirm Enter. → [async-state.md](./async-state.md#double-submit)

## Contributing Back

If you hit a Vue-in-Nuxt authoring gotcha this skill doesn't cover (or one it gets
wrong), upstream it — run `/contribute-skill`.
