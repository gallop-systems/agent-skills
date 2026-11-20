# Error Handling (client + server)

What each `createError` field does on the server is in its own section below. The
rest of this file is the **client/page** surface: triggering the error page, the
`error.vue` root, recovering, and containing a failure to a subtree.

## `createError` — fatal vs non-fatal

`createError` works on both sides. On the **server** it sets the HTTP status. On
the **client/page**, a `createError` with `fatal: true` replaces the whole page
with the error page (`error.vue`); without `fatal`, it's a non-fatal error you
handle locally:

```typescript
// page setup — show the full-screen error page for a missing resource
const { data, error } = await useFetch(`/api/invoices/${id}`);
if (error.value) {
  // keep the real status: a 500 or 403 is not "not found"
  throw createError({ statusCode: error.value.statusCode ?? 500, statusMessage: error.value.statusMessage, fatal: true });
}
if (!data.value) {
  throw createError({ statusCode: 404, statusMessage: "Invoice not found", fatal: true });
}
```

`showError(...)` is the imperative equivalent (call it from a handler instead of
throwing). Pass `data` on the error to carry structured detail to `error.vue`.

## Server: what each `createError` field does

| Field | Goes to | Notes |
|---|---|---|
| `statusCode` | HTTP status | The client branches on it (`err.statusCode` / `err.status`). |
| `statusMessage` | the HTTP status line | h3 **strips anything outside printable ASCII**, so accents, curly quotes, dashes and emoji vanish. Keep it a short ASCII phrase. |
| `message` | JSON body `message` | Human-readable text, any characters. Read client-side as `err.data?.message`. |
| `data` | JSON body `data` | Structured detail (field errors, conflicting ranges). |

```typescript
throw createError({
  statusCode: 409,
  statusMessage: "Conflict",
  message: "Overlaps the booking for 3–5 March",   // non-ASCII is fine here
  data: { conflictingId: other.id },
});
```

In a production build Nitro sends `message` and `data` only for handled, non-fatal
errors: a server `createError` with `fatal: true` is redacted like an unhandled one.

A plain `throw new Error(...)` (or any non-`createError` throw) is **unhandled**: the
client gets a 500 and, in a production build, `message: "Server Error"` with no `data` (the real message shows only in dev). Expected failures
(bad input, missing record, conflict, an upstream rejection) must be a
`createError` with the right status. Don't catch them and return a success-shaped
body (`{ ok: true }`, `[]`, `null`) either: the client can't tell it failed.

## `error.vue` — the app-root error page

A single `error.vue` at the project root renders for any fatal error (and SSR
500s). It receives the error as a prop and clears it with `clearError`:

```vue
<script setup lang="ts">
const props = defineProps<{ error: NuxtError }>();
// clearError unmounts the error page; redirect clears the errored route
const handled = () => clearError({ redirect: "/" });
</script>

<template>
  <div>
    <h1>{{ error.statusCode }}</h1>
    <p>{{ error.statusMessage }}</p>
    <button @click="handled">Go home</button>
  </div>
</template>
```

Only `clearError` dismisses the error page — re-rendering won't. Gotcha: on the
error page, **middleware re-runs** but **plugins do not re-run** until you
`clearError()`, so don't rely on plugin-provided state inside `error.vue`.

## `<NuxtErrorBoundary>` — contain a failure to a subtree

When one widget can fail without taking down the page (a flaky third-party embed,
an optional panel), wrap it so the error is caught locally instead of bubbling to
`error.vue`:

```vue
<NuxtErrorBoundary @error="logError">
  <RiskyWidget />
  <template #error="{ error, clearError }">
    <p>Couldn't load this section.</p>
    <button @click="clearError">Retry</button>
  </template>
</NuxtErrorBoundary>
```

## Which to reach for

| Situation | Use |
|---|---|
| Resource missing / unauthorized in page setup | `throw createError({ …, fatal: true })` |
| Imperatively show the error page from a handler | `showError(...)` |
| Render for any fatal error, app-wide | `error.vue` + `clearError` |
| One section may fail without killing the page | `<NuxtErrorBoundary>` |
| API handler rejecting a request | `createError` (status code) — see `auth-patterns.md` |
