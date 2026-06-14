# Component authoring

Type-only macros, props/emits, the Boolean trap, generics, and what to extract.

## Props & emits: type-only macros

Declare props and emits with the type-only generic form; emit payloads as named
tuple types:

```ts
const props = defineProps<{ label: string; size?: 'sm' | 'md'; rows: Row[] }>()
const emit = defineEmits<{
  'update:modelValue': [value: string]
  saved: []
  rowClick: [row: Row]
}>()
```

Use the runtime/object form only when you need `withDefaults`.

### Forward many props / handlers at once

Spread a whole object of props with `v-bind="obj"`, or a map of handlers with
`v-on="handlers"`, instead of listing each:

```vue
<UserCard v-bind="user" v-on="cardHandlers" />
<!-- equivalent to :name="user.name" :email="user.email" … @edit="…" @delete="…" -->
```

Handy for forwarding `$attrs`/`$props` straight through a thin wrapper component
(`<Inner v-bind="$attrs" />`). Be deliberate, though — spreading a large object
binds *every* key, which can pass props the child didn't ask for.

## The Boolean prop trap (the most-cited authoring gotcha)

A bare `boolean` prop is subject to Vue's **Boolean casting**: when the attribute
is absent it coerces to **`false`**, not `undefined`. So `props.flag ?? true`
never sees `undefined`, and a "defaults-on" flag silently stays off.

```ts
// ❌ absent → false → feature silently disabled (typechecks fine)
const props = defineProps<{ responsive?: boolean }>()
const on = props.responsive !== false // always false when not passed

// ✅ default it explicitly
const props = withDefaults(defineProps<{ responsive?: boolean }>(), { responsive: true })
```

Any boolean that should default **on** MUST go through `withDefaults` (or be
inverted to an opt-*out* flag that naturally defaults `false`).

## Factory defaults for arrays/objects

Non-primitive defaults need a **factory** in `withDefaults`, or every instance
shares one object:

```ts
withDefaults(defineProps<{ items?: Item[]; config?: Cfg }>(), {
  items: () => [],          // ✅ factory
  config: () => ({ x: 1 }), // ✅ factory
})
// ❌ { items: [] } — one array shared across all instances, leaks state
```

Bare literals are only safe for primitives (`isAdmin: false`, `size: 'md'`).

## Generic components

Declare the type param in the tag and thread it through props/emits so a
tabs/select preserves the caller's literal union instead of widening to `string`:

```vue
<script setup lang="ts" generic="T extends string">
const props = defineProps<{ modelValue: T; options: readonly { value: T; label: string }[] }>()
const emit = defineEmits<{ 'update:modelValue': [value: T] }>()
</script>
```

## `defineExpose` — the sanctioned imperative escape hatch

Expose child methods for a parent to call (reset a form after save, trigger
submit from a dialog footer) instead of prop hacks:

```ts
defineExpose({ reset, submit })
// parent: const child = useTemplateRef('child'); child.value?.reset()
```

## What to put in a shared component vs leave in the caller

When extracting, a **composable shares logic-only**; a **component shares
markup + logic**. Extract only the genuinely universal surface and leave
page-specific chrome in each caller. E.g. a reusable `<Dropzone>` owns the
drag/drop box and file handling; the page keeps its own heading, helper banner,
and "or paste text" affordance. If you find yourself adding props just to toggle
caller-specific chrome inside the shared component, that chrome belongs in the
caller.

## Type off the server contract, don't hand-write DTOs

Derive prop/state types from the data you fetch rather than redeclaring an
interface that drifts from the API:

```ts
// from a fetch ref:
type Project = NonNullable<typeof projects.value>[number]
// or an endpoint-response helper indexing the generated InternalApi (illustrative —
// the general rule is "derive from the endpoint type, never hand-write the DTO";
// see nuxt-nitro-api/fetch-patterns.md type-extraction)
```

## Advanced: config-driven generic shells

A generic table/form shell can take a typed config array
(`columns: Column[]`, `fields: FormField[]`) whose entries optionally carry a
`template?: Component` rendered via `<component :is="col.template" v-bind="...">`,
plus `defineExpose`d imperative methods. Powerful, but it's an advanced pattern —
reach for it only when several call sites genuinely share the shell, not as a
default.
