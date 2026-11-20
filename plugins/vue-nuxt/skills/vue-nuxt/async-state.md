# Async UI state: loading, errors, stale responses, double submit

Every request a component makes has four outcomes the template must show
differently, can finish after the user has moved on, and can be fired twice. These
are the mistakes reviewers flag most often in component code. The fetch APIs
themselves (`useFetch` options, keys, SSR) are in `nuxt-nitro-api`'s
`fetch-patterns.md`; this file is about what the **component** does with them.

## Render four states, not two

`pending`, `error`, empty and data are four different screens. The common bug is
an `error` that falls through to the empty state, so a failed load reads as
"nothing here" (no invoices, no contacts, nothing scheduled). That is a false
statement, not a missing nicety.

```vue
<script setup lang="ts">
const { data: contacts, status, error, refresh } = await useFetch('/api/contacts')
</script>

<template>
  <Skeleton v-if="status === 'idle' || status === 'pending'" />
  <div v-else-if="error">
    Couldn't load contacts. <button @click="refresh()">Retry</button>
  </div>
  <EmptyState v-else-if="!contacts?.length" title="No contacts yet" />
  <ContactList v-else :contacts />
</template>
```

- **Check `error` before the empty branch**, and give it a Retry that calls `refresh()`.
- **`idle` comes before `pending`.** With `server: false` (or `immediate: false`)
  the status is `'idle'` during the server render and until the request starts, so
  a skeleton gated on `pending` alone doesn't appear on first render.
- **Unknown is not "no".** Don't derive a permission, a view or a "not found" from
  data that is `undefined` because it is loading or failed. Treat that as unknown:
  show loading or an error with Retry, never "access denied" or "not a member".
- **Unknown is not zero.** Pass `undefined` (and render a placeholder) to totals
  and counters until their data has loaded; `data?.total ?? 0` shows a loading
  screen as a real `$0.00`.
- **Load optional data separately.** If a secondary panel's request fails, show
  its own error; don't let it blank the primary data (separate `useFetch` calls,
  not one `Promise.all` that rejects as a whole).
- **Don't unmount the fetching component while it is pending.** A parent `v-if`
  on the child's own loading state unmounts it, the remount refetches, and a
  failing request loops. Keep the component mounted and let it show its own
  loading and error states.

## `refresh()` does not throw: check `error` after awaiting it

`useFetch`/`useAsyncData`'s `refresh()`/`execute()` return `Promise<void>` and
**resolve even when the request fails**: the failure lands in `error`, `status`
becomes `'error'`, and `data` is reset to its default (`undefined` unless you
passed `default`). A `try/catch` around `await refresh()` never catches anything.

```ts
// ❌ proceeds with a failed (now undefined) invoice, or reports success
await refresh()
send(invoice.value!)

// ✅
await refresh()
if (error.value) return toast({ title: "Couldn't reload the invoice", color: 'error' })
send(invoice.value!)
```

Same rule for anything that advances state after a refresh ("as of" timestamps,
step counters, polling cursors): only advance when `status.value === 'success'`.

## After a mutation: success only on success, refresh outside the try

```ts
const { toast } = useToast()   // or your app's notifier
async function save() {
  if (saving.value) return                     // in-flight guard (see Double submit)
  saving.value = true
  try {
    await $fetch(`/api/projects/${id}`, { method: 'PATCH', body: draft.value })
  } catch (err: any) {
    // keep the dialog open and the user's input; show the server's message
    toast({ title: 'Save failed', description: err?.data?.message ?? 'Please try again.', color: 'error' })
    return
  } finally {
    saving.value = false                        // always reset the loading flag
  }
  emit('saved')                                 // only after the request succeeded
  open.value = false
  await refresh()                               // its failure is a refresh error, not a save error
  if (error.value) toast({ title: 'Saved, but the list could not reload', color: 'error' })
}
```

- **Emit `saved`/close the dialog only on success.** On failure keep the editor
  open with the unsaved input intact.
- **Reset loading flags in `finally`**, so an exception can't leave a spinner (and
  a disabled button) on forever.
- **Surface the server's error message** (`err.data?.message` for a `$fetch`
  `FetchError`) instead of replacing it with generic text; a conflict or validation
  message is what the user needs.
- **Keep the follow-up `refresh()` outside the mutation's `try`.** Otherwise a
  reload failure is reported as "save failed" and the user saves again.
- **Pick the success copy from the response.** If the endpoint can return a
  partial or queued result, say so; don't print "Done" for every non-error.
  For several requests in one save, report which part succeeded and refresh
  anyway.

## Refresh every view of the data you changed

A mutation that only refreshes the list it started from leaves other components
showing the old value. Two ways to keep them in sync:

- **Share one keyed fetch.** `useFetch`/`useAsyncData` calls with the **same
  explicit `key`** share the same `data`, `error` and `status` refs (Nuxt 4), so
  one `refresh()` updates every component using that key. (Without an explicit
  `key`, `useFetch` derives one from the URL and options, so only identical calls
  share, and `useAsyncData` is keyed per call site. Name the key when sharing is
  the intent.)
- **Or refresh by key from anywhere:** `await refreshNuxtData('price-list')`.
- **Or emit up:** a child that mutates emits `saved`/`updated`, and the parent
  that owns the fetch handles it with `refresh()` for every list that shows the
  changed data, not only the one the action came from.

Also: when a component receives a job or record through props that is still
running, start polling it there too, not only when the component started the job
itself.

## Stale responses: an older request must not overwrite newer state

The user switches records, reopens a dialog, types another search term or leaves
the page while a request is in flight. When it lands it writes to state that now
belongs to something else.

**Prefer `useFetch` with a reactive key or `query`.** Nuxt discards a superseded
response for the same key and, with the default `dedupe: 'cancel'`, aborts it. The
hand-rolled `$fetch` in a handler or watcher is where the bug lives.

For a watcher, abort the previous run with `onWatcherCleanup` (see
[watch.md](./watch.md#cancel-stale-work-with-onwatchercleanup)). For handlers,
dialogs and polling, use a **request token**: bump a counter on every start *and*
on every reset, close or unmount, and drop any response whose token is old.

```ts
let seq = 0
const results = ref<Result[]>([])
const loading = ref(false)

async function search(q: string) {
  const mine = ++seq
  loading.value = true
  try {
    const r = await $fetch('/api/search', { query: { q } })
    if (mine !== seq) return                 // a newer search, a reset or a close happened
    results.value = r
  } finally {
    if (mine === seq) loading.value = false  // don't clear a newer run's flag
  }
}
function reset() { seq++; results.value = []; loading.value = false }
onScopeDispose(() => seq++)                  // unmount invalidates in-flight work
```

- **Compare a token, not just the id.** Checking `id === props.id` after the await
  misses A → B → A: the first A's response arrives after you are back on A and
  overwrites the second.
- **Guard every write**, not only `data`: `status`, `error`, `loading`, toast and
  "next poll" scheduling all go behind the same check.
- **Early-return paths that clear state must bump the token too**, or a request
  started before the clear repopulates it.
- **Polling:** after each `await`, check you are still mounted and still following
  the same job before scheduling the next tick. `useTimeoutPoll`/`useIntervalFn`
  (VueUse) stop on unmount for you; the identity check is still yours. Bound the
  number of failed polls before reporting the job as unknown, and treat a 401 as
  "session ended", not "try again".
- **Key replays and pending sets by row id, never array index**; earlier
  operations shift positions.

### Previous data stays visible while the next key loads

When a reactive key changes (a new month, a new record id), Nuxt 4 seeds the new
key's `data` with the **previous key's** value until the new request finishes, and
a plain `refresh()` keeps the current `data` until it is replaced. So `data` can
belong to the last selection. Hide it, or disable actions that act on it, until
`status.value === 'success'`:

```vue
<Button label="Close month" :disabled="status !== 'success'" @click="closeMonth" />
```

### One `router.replace` per change

`useRoute()` updates only after a navigation finishes, so two
`router.replace({ query: { ...route.query, x } })` calls in a row both spread the
*old* query and the second overwrites the first. Merge every change into one call:

```ts
// ❌ clearFilter('customer'); clearFilter('property')  — the second replace drops the first
router.replace({ query: { ...route.query, customer: undefined, property: undefined } })
```

## Double submit

Enter pressed twice, a double click or a slow network sends the same mutation
twice. Every mutating handler needs an in-flight guard, and its button is disabled
while it runs:

```ts
const saving = ref(false)
async function add() {
  if (saving.value) return
  saving.value = true
  try { await $fetch('/api/items', { method: 'POST', body: { name: name.value } }) }
  finally { saving.value = false }
}
// <Button :loading="saving" :disabled="saving" @click="add" />
```

- **The guard is in the handler**, not only `:disabled`: an Enter-key handler or a
  second caller bypasses the button.
- **Track pending per item** with a `Set` of ids when each row has its own action;
  a single shared `pendingId` lets a second row's click clear the first row's state.
- **IME:** the Enter that confirms an IME composition (Chinese, Japanese, Korean
  input) also fires `keydown`. Ignore it in commit-on-Enter handlers:
  `if (e.isComposing) return`.
- **Don't lose input typed during a save.** If the field stays editable, clear it
  after the save only if it still holds the submitted value, or disable it while
  the save runs.
