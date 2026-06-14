# Slots & reusability

Slots are how a component accepts **markup** from its caller. Reach for a slot
whenever a component is a *container* for caller-provided content — cards, panels,
menus, layouts, list rows, buttons.

## Slots beat props for markup and open-endedness

A prop can carry a string, but not a chunk of markup, and it forces you to
pre-plan every variant. If a `<Button>` takes `type: 'primary' | 'secondary'`, a
caller can't add a third look without you editing `Button`. A slot is
open-ended — the caller passes whatever they need:

```vue
<!-- ❌ prop must anticipate every case -->
<Button label="Save" type="primary" />
<!-- ✅ slot accepts any content -->
<Button @click="save">Save <Spinner v-if="saving" /></Button>
```

Rule of thumb: **prop for data, slot for markup.** If you find yourself adding a
prop just to toggle a bit of caller-specific UI, that UI belongs in a slot.

## Named slots + the `#` shorthand

```vue
<!-- Card.vue -->
<template>
  <article>
    <header><slot name="header" /></header>
    <slot />                <!-- default slot -->
    <footer><slot name="footer" /></footer>
  </article>
</template>

<!-- caller -->
<Card>
  <template #header><h2>Title</h2></template>   <!-- #header == v-slot:header -->
  Body content goes in the default slot.
  <template #footer><Button>OK</Button></template>
</Card>
```

## Fallback (default) content

Content between the `<slot>` tags renders when the caller provides nothing:

```vue
<slot name="empty">No results yet.</slot>
```

## Scoped slots — the mental model

A scoped slot is **a function the parent supplies that returns markup; the child
calls it with data.** The child exposes values by binding them on `<slot>`; the
caller receives them via the slot prop:

```vue
<!-- List.vue — child owns iteration, caller owns each row's markup -->
<template>
  <ul>
    <li v-for="item in items" :key="item.id">
      <slot :item="item" :index="index" />   <!-- expose data to the slot -->
    </li>
  </ul>
</template>

<!-- caller -->
<List :items="invoices">
  <template #default="{ item }">
    <strong>{{ item.number }}</strong> — {{ item.total }}
  </template>
</List>
```

This is the core reusability move: the child encapsulates *logic* (fetching,
iterating, state) while the caller decides *presentation*.

## Typing & inspecting slots (Composition API)

- **Type** the slots a component accepts with `defineSlots` (compile-time only,
  like `defineProps`):

  ```ts
  defineSlots<{
    default(props: { item: Invoice; index: number }): any
    header(): any
  }>()
  ```

- **Inspect** which slots the caller actually passed with `useSlots()` — use it to
  avoid rendering an empty wrapper:

  ```vue
  <script setup lang="ts">
  const slots = useSlots()
  </script>
  <template>
    <!-- only render the styled footer wrapper if a footer slot was given -->
    <footer v-if="slots.footer" class="border-t p-4"><slot name="footer" /></footer>
  </template>
  ```

  (In a template you can also test `$slots.footer` directly.) Without the guard
  you ship an empty `<footer>` whose padding/border still affects layout.

## Forwarding & splitting slots

- **Forward** a slot through a wrapper so the inner component receives it:

  ```vue
  <Inner>
    <template v-for="(_, name) in $slots" #[name]="scope">
      <slot :name="name" v-bind="scope" />
    </template>
  </Inner>
  ```

- **Split** one incoming slot into two render positions by branching with `v-if`
  on a condition, each `<slot>` keeping its own fallback.

## Slot transitions need keyed content

Wrapping a `<slot>` in `<Transition>` only animates if the slotted content is
**keyed**, so Vue can tell one state from the next:

```vue
<Transition name="fade" mode="out-in">
  <component :is="current" :key="current" />
</Transition>
```

## Reusable ≠ big

Small components are worth extracting too. A three-line `OverflowMenu` that always
pairs the same trigger icon + a11y wiring is worth a component: every use stays
identical, and a change happens in one place. Extract the genuinely shared
surface; leave caller-specific chrome in the caller (see the "what to extract"
note in [component-authoring.md](./component-authoring.md)).
