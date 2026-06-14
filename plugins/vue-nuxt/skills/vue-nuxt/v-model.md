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

**Transform on the boundary with `get`/`set`.** For a component's *own* model,
`defineModel` takes `get`/`set` transformers directly — no separate writable
`computed` needed (reserve that for forwarding *someone else's* model, below):

```ts
const model = defineModel<string>({ get: (v) => v.toUpperCase(), set: (v) => v.trim() })
```

**Custom `v-model` modifiers** (`v-model.capitalize`) arrive via the
`[model, modifiers]` tuple:

```ts
const [model, modifiers] = defineModel<string>({
  set: (v) => (modifiers.capitalize ? v[0].toUpperCase() + v.slice(1) : v),
})
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

A `computed({ get, set })` transforms a *forwarded* value shape (date string ↔
`Date`) before writing back — for a component's **own** model, prefer
`defineModel`'s `get`/`set` (above) over a separate computed. Either way, do NOT
reach for two mirror `watch`es to do this; that's the `prop-sync` smell (see
[watch.md](./watch.md)).

## Mutually-exclusive paired fields

When setting one field must clear its sibling, expose **two** typed `update:`
events and bind the inner widget with `:modelValue` + `@update:modelValue` (NOT
`v-model`) so your handler can emit one update and null the other in the same tick:

```ts
const emit = defineEmits<{ 'update:years': [v: string | null]; 'update:months': [v: string | null] }>()
function setYears(v: string) { emit('update:years', v); emit('update:months', null) }
```

A single `v-model` can't express "set A, clear B" atomically.

## Controlled / uncontrolled: work standalone OR be parent-driven

For a component that should manage its own state **unless** a parent supplies the
value (a toggle that works alone but a parent can override), detect whether the
control prop was passed and fall back to internal state per render:

```ts
const props = defineProps<{ open?: boolean }>()        // undefined ⇒ uncontrolled
const emit = defineEmits<{ 'update:open': [v: boolean] }>()
const internal = ref(false)
const controlled = computed(() => props.open !== undefined)
const open = computed(() => (controlled.value ? props.open! : internal.value))
function toggle() {
  if (controlled.value) emit('update:open', !props.open)
  else internal.value = !internal.value
}
```

This relies on `undefined` meaning "unset", so the control prop must **not** be a
bare `boolean` (the Boolean-casting trap coerces absent → `false`; see
[component-authoring.md](./component-authoring.md)) — type it `boolean | undefined`
and give it no `withDefaults` default.

## Reset / lazy-load on open

To reset transient state or lazy-load when a dialog opens, **watch the bound
flag** (it covers every close path — overlay click, ESC, programmatic) — see the
"re-seed local state on dialog open" case in [watch.md](./watch.md).

## Consistency caveat

A repo with hundreds of `props`+`emit`+`computed` `v-model`s and zero
`defineModel` means matching the manual pattern in that file. Introduce
`defineModel` deliberately, not as a drive-by in an otherwise-consistent file.
