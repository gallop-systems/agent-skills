# `v-model` on components

Two sanctioned patterns for two-way binding. Default to `defineModel` for new
code; the computed-proxy is for forwarding an existing component's model.

## `defineModel` — preferred (Vue 3.4+ / Nuxt 4)

```ts
const model = defineModel<boolean>()                              // parent: v-model
const visible = defineModel<boolean>('visible', { required: true }) // parent: v-model:visible
```

Read/write `model.value` directly — no `props` + `emit` boilerplate. Give
non-primitive models a factory default like any prop.

**Named models** give one component multiple independent two-way bindings:

```ts
const years = defineModel<string>('years')
const months = defineModel<string>('months')
// parent: <DurationInput v-model:years="y" v-model:months="m" />
```

## The computed-proxy — for forwarding an existing model

When you wrap a component that already has its own `v-model` (a Volt/PrimeVue
`Dialog`'s `visible`, say), or you need a named local handle or a value
transform, use a writable `computed` over `props` + `emit`:

```ts
const props = defineProps<{ visible: boolean }>()
const emit = defineEmits<{ 'update:visible': [v: boolean] }>()
const visible = computed({ get: () => props.visible, set: (v) => emit('update:visible', v) })
//   <Dialog v-model:visible="visible" />
```

A `computed({ get, set })` is also how you **transform** a child value shape
(date string ↔ `Date`) before writing back. See
[watch.md](./watch.md) — do NOT reach for two mirror `watch`es to do this; that's
the `prop-sync` smell.

## Mutually-exclusive paired fields

When setting one field must clear its sibling, expose **two** typed `update:`
events and bind the inner widget with `:modelValue` + `@update:modelValue` (NOT
`v-model`) so your handler can emit one update and null the other in the same tick:

```ts
const emit = defineEmits<{ 'update:years': [v: string | null]; 'update:months': [v: string | null] }>()
function setYears(v: string) { emit('update:years', v); emit('update:months', null) }
```

A single `v-model` can't express "set A, clear B" atomically.

## Reset / lazy-load on open

To reset transient state or lazy-load when a dialog opens, **watch the bound
flag** (it covers every close path — overlay click, ESC, programmatic) — see the
"re-seed local state on dialog open" case in [watch.md](./watch.md).

## Consistency caveat

A repo with hundreds of `props`+`emit`+`computed` `v-model`s and zero
`defineModel` means matching the manual pattern in that file. Introduce
`defineModel` deliberately, not as a drive-by in an otherwise-consistent file.
