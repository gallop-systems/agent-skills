# API principles

The rules every gallop-ui component follows. Use them to read an API you haven't seen, to review a change, and to
sketch a new component. The layer's `CLAUDE.md` is the enforced version, and `docs/decisions.md` records who
decided each name. When this file and the layer disagree, the layer wins: tell the user so this file gets fixed.

## The goal

**An intuitive API is a prime goal, equal to the look.** Ask of every name and shape: would a new developer or
agent guess it without the docs? Would they misuse it?

- **Names say what a thing does, never how it is built.** `Select` with `search-input`, not a `Select` /
  `SelectMenu` split that mirrors two Reka primitives. `DateCalendar`, because "Calendar" means a scheduling calendar.
- **One concept, one name; one behaviour, one prop.** Two components that differ only by a behaviour are one
  component with a prop. The same idea on two components has the same prop name and values.
- **Flat, plain props over shaped objects:** InputDate `time`, not `granularity="minute"`.
- **Leave room for what's coming.** Don't take a name that a component we'll want later needs: the date grid is
  `DateCalendar` because `Calendar` belongs to a future scheduling calendar. Before you choose a name, ask what
  else it could mean in a UI kit.
- **Nuxt UI's vocabulary is the default, not a rule.** Use its name when it is clear to a caller; drop it when the
  name or split reflects implementation. Never copy PrimeVue/Volt's API (`severity`, `fluid`, PrimeVue `pt` keys).
- **Fix a bad name before a release ships it**, rather than keeping it because apps use it. That is what the codemod
  is for.

## Shared props

| Prop | Values | Meaning |
|---|---|---|
| `color` | `primary \| neutral \| success \| info \| warning \| error` | What kind of thing it is. |
| `variant` | `solid \| soft \| subtle \| outline \| ghost \| link` | How loud it is. |
| `size` | `xs \| sm \| md \| lg \| xl` | App-wide default in `gallopUi.defaults.<Component>.size`. |
| `block` | boolean | Full width. |
| `disabled`, `loading`, `invalid`, `readonly`, `clearable` | | The same meaning everywhere. `clearable` is an x in the field that empties it. |

A component implements only the values apps use. Never a synonym (`tone`, `severity`, `kind`, `fluid`), and no new
colours: an app's extra button colour maps onto an existing `color`.

## Naming patterns

- **`show<Thing>` for a boolean that adds a control:** `showClose`, `showToggle`, `showSearch`, `showSelectAll`,
  `showStepper`, `showColorScheme`. A feature boolean stays an adjective or noun: `clearable`, `sticky`,
  `collapsible`, `range`, `multiple`.
- **The listener rule:** a listener may switch on a control that does nothing without it. `@add` shows Board's "+",
  `@back` shows PageHeader's back button (`back-to` stays the link form), `@row-click` makes DataTable rows
  clickable, `@search` turns Select or Input to server search. Don't add a `show<Thing>` for a control whose only
  job is to emit that event.
- **Events** are kebab-case (`clear-filters`, `load-more`). Present tense for a request the caller acts on (`move`,
  `remove`, `search`), past tense for a notice that something happened (`copied`, `move-refused`). Overlays keep
  Nuxt UI's `after:enter` / `after:leave`.
- **Accessible names:** `label` is always visible text. A landmark's name is the native `aria-label` (with a
  built-in default such as Sidebar "Main"); a sub-part's name is a `*AriaLabel` prop (`backAriaLabel`,
  `menuAriaLabel`). Every icon-only control needs a name.
- **Accessors are named after their thing:** `rowKey`, `cardKey`, `labelKey`, `valueKey`. A prop that is a function
  of a row says so: DataTable `rowTo(row)`, `cardTo(row)`, `cardLinkLabel(row)`. A plain `to` always holds a
  destination (`RouteLocationRaw`; an absolute URL opens in a new tab).
- **Nouns are singular:** `noun="invoice"`; plurals come from `pluralize`, with `pluralNoun` for odd words.
- **Controllers** of something that opens return `{ isOpen, open, close, toggle }`. A controller of two things
  prefixes each with its thing: `useSidebar()` gives `isCollapsed`, `collapse()`, `expand()`, `toggleCollapsed()`
  and `isDrawerOpen`.
- **`define…` vs `use…`:** `define…` registers something for the component's lifetime and returns nothing;
  `use…` returns state or functions.

## State: controlled or managed

- **One rule for state props** (`open`, `page`, `selected`, `collapsed`, `searchTerm`…): the prop is *controlled*
  when the caller passes it **and** listens to its `update:` event; otherwise the component manages it, seeded from
  the prop. That is Vue's `defineModel` rule; the layer uses `defineModel` or `useControllable`
  (`runtime/useControllable.ts`).
- **Anything that opens has `v-model:open`** (Modal, Drawer, Popover, DropdownMenu, Select…), so a caller can open it
  from code or just let it manage itself.
- A value input's `modelValue` (Input, Select, Checkbox, Switch…) is the one exception: pure-controlled, no value of
  its own.
- `v-model` types follow the mode (`multiple` gives an array), so call sites typecheck without casts.

## Contracts that repeat

- **Empty state:** `empty` is the title text everywhere, defaulting to "No {plural noun}". Every list has an
  `#empty` slot (slot props `{ searchTerm }` on Select, `{ lane }` on Board, nothing elsewhere). An empty *value*
  in a cell or description prints `fallback` (the em dash by default).
- **Refusals are "a reason string, or nothing":** a string means "refused, and here is why" (shown to the user);
  `null`/`undefined` means allowed. Board lane `disabled`, `cardDisabled(card)` (a reason or `true`), `canMove(move)`.
  A predicate named for the positive (`selectable(row)`) returns a boolean. `locked` is only Modal and Drawer: can't
  be dismissed.
- **Choice items** take `labelKey` / `valueKey` (Select, RadioGroup, SegmentedControl, Tabs, Input suggestions,
  `useRemoteOptions`); `valueKey` defaults to `"value"`.
- **Menu items** share one `MenuItem` shape: `label`, `icon`, `to`, `target`, `onSelect(event)`, `kbd`, `disabled`,
  `class`. DropdownMenu, Sidebar, TopBar and CommandPalette extend it (CommandPalette identifies an item by `id`).
- **Looks:** `ghost` is no box and no rule (Card, Stat); `ruled` is Card's ruled band; `elevated` a raised card;
  `divided` puts rules between parts.

- **Never show one thing and save another.** A field whose typed text isn't a valid value (a date, a time, a number)
  reverts to the saved value on blur or Enter and briefly shows the invalid border. It never keeps the text on
  screen while the model holds something else, and never drops the input silently.

## What belongs in the layer

- **One look across apps.** When one app does something differently from all the others (a floating label, its
  own field style), redesign that app to match the rest rather than add an option to keep the oddity.
- **No shallow wrappers around a library an app already uses well** (a chart library, say). A layer component earns
  its place through shared behaviour and a shared look, not by renaming another library's props.

## `pt` sections and slots

- `class` is always `pt.root`. An overlay's `root` is its panel; its backdrop is `overlay`.
- Inside a list, an item's parts are `item`, `itemLabel`, `itemDescription`, `itemIcon`; a group heading is
  `groupLabel`.
- `icon` is only the component's own leading icon; other icons are named for their job (`toggleIcon`, `zoneIcon`,
  `checkIcon`).
- A field's popup is `panel`; Tabs' panels are `tabPanel`; a title-plus-description block is `text`; an inner
  wrapper is `inner`; `content` is only Card's slot area.
- **Slots are kebab-case, sections camelCase:** `#item-label` fills `pt.itemLabel`, `#trailing-icon` fills
  `pt.trailingIcon`.
- A section per enum value only where values differ in colour (`neutral-soft`, `primary-solid`). Never a section
  per size.

## Cross-cutting requirements

- **Time zones:** anything that formats or picks a date-time takes a `timeZone`, defaulting to `gallopUi.timeZone`.
  Date-only strings are never shifted. The server and the browser print the same text. Date tests run under
  `TZ=UTC` and `TZ=America/New_York`.
- **Dark mode** is designed and checked for every component; colours come only from tokens.
- **Phones:** tables render as cards below `md` by default, derived from the columns, with every feature still
  working (sort, select, row links, paging, actions). An old phone table becoming cards is an improvement, not a
  regression; don't use `layout="table"` to keep one. Field text is 16px below `md` (iOS zooms into smaller
  fields); desktop sizes are unchanged.
- **Use existing libraries first:** VueUse (`useRouteQuery` from `@vueuse/router`, `useEventListener`,
  `refAutoReset`…), Reka UI for focus, keyboard and ARIA, and the template's dependencies. A new layer dependency
  means every app adds it, so ask first. If an app-level library is missing, add it to the template rather than
  re-implementing it.
- **Client-neutral:** no client names, data or domain terms in the layer. Examples use orders, projects, people.
- **Same or better, never a regression,** in look, behaviour and speed. Inventory every behaviour before replacing
  something, and measure old against new.
- **Performance through measured docs, not strict thresholds.** About 200ms for an interaction on a throttled phone
  is acceptable when the component's `.md` has a measured "Performance" section (what is slow at what size, what to
  do). Take cheap, safe wins; flag anything several times slower than before.
- **Escape hatches are labelled:** DataTable's TanStack `table` is exposed but unstable, with no semver guarantee;
  use the stable helpers (selected rows, toggle-all) instead.

## The bar for an API change

- **Naming and API calls go to the owner.** Implementation, tests and internal structure are yours. Present a
  naming call with the options, the trade-offs, and your recommendation tied to the principles above. Don't just
  agree with whichever option was mentioned last. Check `docs/decisions.md` first and don't reopen a settled call
  without new evidence.
- **Backward compatible by default:** a new prop or option must leave every existing call site rendering exactly as
  before. A look that changes without the caller touching `pt` is a breaking change.
- **Breaking changes after 1.0** need a major release, a `CHANGELOG.md` note, and a row per change in
  `migrations/<version>/<area>.json` with a `codemod` the kit can apply (`rename`, `invert-to`, `wrap-array`…) or
  `manual` with a `locate` and a note. `yarn ui:migrate` then rewrites apps and writes the checklist. Before 1.0,
  breaking changes landed in minor versions; that grace is over.
- Batch breaking renames into one release with one codemod rather than trickling them out.
