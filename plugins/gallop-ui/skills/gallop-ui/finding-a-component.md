# Finding the right component

Work down this list and stop at the first step that fits. The layer's `CLAUDE.md` ("Before you build") says the
same from the layer's side.

## 1. Search

```sh
cd <app>
grep -in "<words a user would say>" layers/gallop-ui/CATALOGUE.md   # "date range", "kanban", "copy link"
```

- `CATALOGUE.md` is generated from each component's frontmatter. Its **"Use it for"** column holds the phrases
  people search with (`kebab menu`, `bottom sheet`, `combobox`), and **"Replaces app copies"** names the
  Volt/PrimeVue or app component each one replaced (`VoltDialog` → Modal, `v-tooltip` → Tooltip). Search both.
- Read the `.md` of every candidate: **When to use**, **When not to use** (which often names the right sibling),
  **Functionality**, then Props, Slots and Customizing.
- Check composables too (`useConfirm`, `useSubmit`, `useRemoteOptions`, `useRowLink`…): the need may be behaviour,
  not a component.
- Open `/_ui/<Name>` in `yarn dev` to see the stories in this app's theme.
- Also search the app (`git grep -n "<Name>" -- app`) for how it already does this. Copy the app's own pattern when
  it uses the layer correctly.

## 2. Exact match: use it as it is

Use the documented props. Restyle with `class` (= `pt.root`) or `pt` for a one-off; put a look the app wants
everywhere in `gallopUi.pt`. Don't wrap a layer component in an app component just to preset props: use
`gallopUi.defaults` or the props at the call site.

## 3. Close match: bend it, don't fork it

In this order:

1. **A prop** the component already has (read the whole Props table; many options are off by default).
2. **A `pt` section** for a look.
3. **A slot** for content (`#empty`, `#item`, `#<key>-cell`, `#actions`, `#footer`…). Slot names are kebab-case.

Never:

- wrap it in an app component to add behaviour the layer should own;
- copy its source into `app/components`;
- name an app component like a layer one (shadowing; `yarn ui:check` fails);
- edit `layers/gallop-ui` in the app.

If it truly lacks something **any app could use** (a missing option, a missing slot), propose extending it in the
layer: backward compatible, existing call sites render exactly as before, `.md`, stories and tests updated in the
same change. Don't stretch a component past its job: if the new use changes what its value *is* (a boolean
instead of a choice), it is a different component.

While the layer change is pending, the app may carry a small, local workaround marked `TODO(gallop-ui): <what the
layer should do>`. The next `ui:pull` removes it.

## 4. No match: compose, then propose

1. **Compose layer primitives in the app** (`Card` + `DescriptionList` + `Button`…), in an app component named for
   the app's domain.
2. **Propose a layer component** when either is true:
   - a **second app** needs the same composition (the second copy is the trigger: move it to the layer as a
     composite, and both apps adopt it);
   - it is a **generic UI pattern** with no domain in it (a disclosure, a meter, a stepper), even if one app needs it
     today.
3. Keep it in the app when it only makes sense for that app's domain.

Don't build a shallow wrapper around a library an app already uses well (a chart library, say). A layer component
earns its place by behaviour and a shared look.

## Primitives before composites

- **Primitives** are building blocks with their own behaviour (Button, Input, Select, Modal, Popover, Tooltip…).
  **Composites** put primitives together for a recurring job (PageHeader, FormField, DataTable, Board,
  CommandPalette…). The tier is in each `.md`'s frontmatter and in CATALOGUE.md's sections.
- **A layer composite builds only on layer primitives.** It never uses a plain element styled to look like a
  primitive, and never an app's component. If a composite needs a primitive the layer lacks, the primitive is
  built first.
- Basic composites (a few primitives, no engine, no app-shell state) come before advanced ones (tables, app shell,
  palettes).

## Suggesting a new component to the owner

The owner decides names and whether the layer grows. Bring a short proposal, not a branch:

- **The need**, in a caller's words, and the call sites: every app and file that has a copy or would use it
  (`git -C ~/Projects/<app> grep -n "<pattern>" origin/main -- app`).
- **Why the existing components don't fit:** the candidates you read and what each lacks.
- **The tier**, and the primitives it builds on (and any primitive that must come first).
- **The API sketch:** name, props, slots, events, v-model, following [api-principles.md](api-principles.md). List
  every non-obvious name with the alternatives you considered, and a recommendation with the trade-off. Check
  `docs/decisions.md` so you don't reopen a settled name.
- **What it replaces**, and whether adopting it is a scripted rewrite.

In the gallop-ui repo, `docs/roadmap.md` ("Later") lists ideas not built yet, and `docs/decisions.md` ("Considered
and not built") lists what was declined and why. Check both first. A new idea goes in `docs/roadmap.md`.
