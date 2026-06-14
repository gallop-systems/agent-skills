# Nuxt auto-imports

Nuxt auto-imports your own UI surface and the Vue/Nuxt APIs. Add an explicit
`import` only for third-party symbols and TypeScript types. Knowing exactly what
resolves — and how component tags are named — prevents the silent "renders
nothing" failures.

## Components: the tag carries the directory prefix

Files in `app/components` auto-import with **no manual import**. A nested
component's tag is the PascalCased **directory path prefixed onto** the
PascalCased filename:

| File | Tag |
|---|---|
| `app/components/AppHeader.vue` | `<AppHeader>` |
| `app/components/customers/ProfileCard.vue` | `<CustomersProfileCard>` |
| `app/components/form/FileUpload.vue` | `<FormFileUpload>` |
| `app/components/settings/Sidebar.vue` | `<SettingsSidebar>` |

- **Name to avoid stutter.** Put `ProfileCard.vue` in `customers/` → `<CustomersProfileCard>`, not `CustomerProfileCard.vue` → `<CustomersCustomerProfileCard>`.
- **Guessing the bare filename fails silently.** `<FileUpload>` for `form/FileUpload.vue` resolves to nothing — no error, just an unrendered tag. If a component "isn't showing up," check the prefix first.
- **Want a clean unprefixed tag?** Either explicitly import it
  (`import EstimateHeader from '~/components/estimates/EstimateHeader.vue'`), or
  register a directory with a prefix in `nuxt.config` (`components: [{ path: '../src/volt', prefix: 'Volt' }]` → `<VoltButton>`).

## What auto-imports (no `import` line)

- **Vue reactivity & lifecycle:** `ref`, `reactive`, `computed`, `watch`, `watchEffect`, `onMounted`, `onBeforeUnmount`/`onUnmounted`, `nextTick`, `defineProps`/`defineEmits`/`defineModel`/`withDefaults`, `resolveComponent`.
- **Nuxt helpers:** `useRoute`, `useRouter`, `navigateTo`, `useFetch`, `$fetch`, `useAsyncData`, `useState`, `useCookie`, `useRuntimeConfig`, `useHead`, `definePageMeta`, `useNuxtApp`.
- **Your `app/composables`** (`useFoo`) and **`app/utils`** (pure helpers, by bare name) — app-wide.
- **`<NuxtLink>`, `<NuxtPage>`, `<NuxtLayout>`, `<ClientOnly>`, `<Teleport>`** in templates.

Reach for `#imports` (`import { useFoo } from '#imports'`) only to disambiguate a
naming collision.

## What does NOT auto-import (import explicitly)

- **Third-party composables/components:** `useToast` from `'primevue/usetoast'`, `Column` from `'primevue/column'`, `date-fns` helpers, etc.
- **TypeScript types** — interfaces, enums, type aliases are never auto-imported. `import type { Foo } from '...'`.
- **`server/utils`** — auto-imported on the *server* only, never into client code.
- **Vitest unit tests** — plain `*.test.ts` files do NOT get Nuxt's auto-import context. Import the composable/util under test explicitly: `import { useFormatters } from './useFormatters'`. (Component tests via `@nuxt/test-utils/runtime` + `mountSuspended` DO have the context — see the `nitro-testing` skill.)

## Consistency caveat

Some repos still write explicit `import { ref } from 'vue'` everywhere. **Match
the file you're editing** — but the default for new code is to rely on
auto-import.
