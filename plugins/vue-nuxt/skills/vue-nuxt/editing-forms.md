# Forms, dialogs and drawers that edit a record

A component that edits a record holds a **local draft** copied from data it does
not own. Most review findings on these components are the same bug: the draft (or
something derived from it) still belongs to the *previous* record, the previous
opening, or the previous version of the data. This file is the rules for when to
seed, reset and re-sync that local state. For the request side (errors, stale
responses, double submit) see [async-state.md](./async-state.md).

## Seed when the identity changes, not once at setup

`setup` runs once. A dialog or drawer that stays mounted and is reopened for
another record, or a detail panel whose `id` prop changes, keeps the old draft
unless you re-seed. Two correct shapes:

**1. Remount per record (simplest).** Mount the form only while open, keyed by the
record id, so every opening starts from a clean `setup`:

```vue
<Drawer v-model:open="open">
  <ProjectForm v-if="open && project" :key="project.id" :project @saved="onSaved" />
</Drawer>
```

**2. Re-seed on open and on id change** when the component must stay mounted:

```ts
const draft = ref<Draft>(emptyDraft())
watch(
  [open, () => props.record?.id],
  ([isOpen]) => {
    if (!isOpen || !props.record) return
    draft.value = toDraft(props.record)   // every editable field, from the current record
    previewResult.value = null            // and every transient: preview, error, job, notice
  },
  { immediate: true },
)
```

- **Reset everything derived from the old record**, not only the form fields:
  previews, generated output, validation errors, "copied" notices, an in-flight job
  or poll, the selected tab. And invalidate requests still in flight for it (the
  request-token pattern in [async-state.md](./async-state.md)).
- **Reset on close too** when a field is prefilled by the opener (a default date,
  a pre-selected option), so the next opening doesn't reuse it.
- **Capture what the save needs at open time.** If the save sends an expected
  version (optimistic concurrency), take it from the record when the editor opens,
  not from the prop at submit time: a background refresh would otherwise update it
  and silently overwrite someone else's change.

## Don't re-seed on every refetch of the source data

The opposite trap: a watcher on the fetched list or record that re-applies
defaults whenever the data reloads wipes what the user is typing. Seed on
**open** or **id change**. When the same record reloads while the user is
editing, keep their dirty fields and update only the untouched ones (or show a
"changed elsewhere" notice).

```ts
// ❌ re-picks the default whenever the list reloads, clobbering the user's choice
watch(agencies, (list) => { selected.value = list[0]?.id })
// ✅ default once per opening
whenever(open, () => { selected.value ??= agencies.value?.[0]?.id })
```

## Seed every field; send what changed

- **Seed the draft from all of the record's current values.** A form that starts
  from an empty object and is saved with `PUT`/full-object `PATCH` clears every
  field it didn't show.
- **Send only the fields the user edited** when other people (or other tabs) can
  edit the same record, so stale values in untouched fields don't overwrite their
  changes. Diff the draft against the snapshot you seeded from.
- **Compute dirty state the same way:** compare editable fields to the seeded
  snapshot, not "the update payload is valid" or "a field was focused".
- **While the form is dirty, disable actions that read the saved record** (create
  something from it, send it, export it); a notice alone isn't enough.
- **Enforce required fields in the handler or `:disabled`**, not only with a
  required marker on the label.

## Local copies of props must follow the prop

A `const isAdmin = ref(props.user.is_admin)` is a snapshot: it never sees the
refreshed user. Derive it with `computed(() => props.user.is_admin)`, or, when it
is a user-editable draft, re-seed it as above. See the `prop-sync` smell in
[watch.md](./watch.md).

An input component that keeps its own text buffer (to allow partial typing like
`"1."`) must reset that buffer when the parent sets the model to `null` or a new
value from outside; otherwise it shows text that no longer matches the model.

## Options that disappear, URLs that change

- **A selection must survive its options changing.** When the selected tab, filter
  value or option is no longer in the available list (permissions, a reload, a
  deep link to a hidden tab), fall back to the first valid one instead of rendering
  an empty or misleading view:

  ```ts
  const activeTab = computed(() =>
    tabs.value.some((t) => t.id === requested.value) ? requested.value : tabs.value[0]?.id)
  ```

- **State mirrored in the URL must follow the URL both ways.** A search box seeded
  once from `route.query.q` drifts when the user navigates back. Bind it with
  `useRouteQuery` or a writable computed over the query (see [vueuse.md](./vueuse.md)),
  and write restored state (saved columns, a restored tab) back to the URL so a
  shared link shows the same thing.
- **"Clear filters" resets every filter**, including ones that live in the parent
  or the URL. Build the clear action and the "filters active" check from the same
  list of filter sources (see "One rule, one helper" in
  [component-authoring.md](./component-authoring.md)).
- **Dependent defaults follow their source.** When a mode, period or type changes,
  re-apply the defaults and bounds that depend on it (date bounds for a school
  year, defaults for an entry type) in that control's change handler, keeping
  unrelated input.

## Per-item drafts that must survive switching

If the user switches between items (cases, conversations) and expects an
unfinished draft to still be there, keep a draft per item id (a `Map` keyed by id,
or one composer per item under `<KeepAlive>` keyed by id) instead of one shared
draft that the next item overwrites.

## Time is not reactive

`new Date()` in a `computed` is evaluated once and never again, so "today",
"overdue" or "starts in 5 min" stays frozen on a page left open. Derive from a
reactive clock: `const now = useNow({ interval: 60_000 })` (VueUse) and read
`now.value` in the computed.
