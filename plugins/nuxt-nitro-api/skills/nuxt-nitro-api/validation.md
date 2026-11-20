# Validation Patterns

> **Example:** [validation-endpoint.ts](./examples/validation-endpoint.ts)

## Available Utilities (all auto-imported from h3)

| Raw | Validated |
|-----|-----------|
| `readBody(event)` | `readValidatedBody(event, validator)` |
| `getQuery(event)` | `getValidatedQuery(event, validator)` |
| `getRouterParams(event)` | `getValidatedRouterParams(event, validator)` |

Note: It's `getRouterParams` (plural), not `getRouterParam`.

## Pattern 1: Pass `schema.parse` (the default)

Nuxt 4 runs **h3 v1** (1.15.x), whose validated readers take a **function**
`(data) => result`, not a schema object. Pass the schema's `parse`:

```typescript
const querySchema = z.object({
  search: z.string().min(1).optional(),
  page: z.coerce.number().int().positive().default(1),
});

const query = await getValidatedQuery(event, querySchema.parse);
const body = await readValidatedBody(event, bodySchema.parse);
const params = await getValidatedRouterParams(event, paramsSchema.parse);
```

When `parse` throws, h3 turns it into a **400** (`statusMessage: "Validation Error"`,
the `ZodError` in `data`). The result is typed from the schema.

- **Not the schema object:** `getValidatedQuery(event, querySchema)` is a type error
  on h3 v1 (passing schemas directly is an h3 **v2** feature; Nuxt 4 isn't on it).
- **Not `schema.safeParse`:** h3 returns whatever the validator returns, so you get
  the `{ success, data | error }` wrapper back as your "body", and a failed parse is
  not rejected.

## Pattern 2: Manual Validator Function

For custom validation logic:

```typescript
const query = await getValidatedQuery(event, (data) => querySchema.parse(data));
```

## Pattern 3: safeParse for Better Errors

Zod 4 has a built-in `z.prettifyError()` — no `zod-validation-error` dependency needed:

```typescript
import { z } from "zod";

const rawQuery = getQuery(event);
const result = querySchema.safeParse(rawQuery);

if (!result.success) {
  console.error("Validation error:", z.treeifyError(result.error)); // structured dev log
  throw createError({
    statusCode: 400,
    statusMessage: "Bad Request",
    message: z.prettifyError(result.error), // human-readable, e.g. "✖ Invalid email address\n  → at email"
  });
}

return result.data;
```

`z.prettifyError(err)` returns a readable multi-line string; `z.treeifyError(err)` returns a nested object keyed by field (the replacement for the deprecated `.format()`). Use `z.flattenError(err)` for a flat `{ formErrors, fieldErrors }` shape.

## Common Zod Patterns

### Query Parameters

```typescript
const querySchema = z.object({
  // Optional string
  search: z.string().optional(),

  // Coerce to number (query params are strings)
  page: z.coerce.number().default(1),
  limit: z.coerce.number().max(100).default(20),

  // Boolean from string
  active: z.enum(["true", "false"]).transform(v => v === "true").optional(),

  // Enum
  status: z.enum(["pending", "active", "closed"]).optional(),

  // Array from comma-separated
  tags: z.string().transform(s => s.split(",")).optional(),
});
```

### Request Body

```typescript
const createUserSchema = z.object({
  email: z.email(), // Zod 4: top-level, NOT z.string().email()
  name: z.string().min(1).max(100),
  role: z.enum(["admin", "user"]).default("user"),
  metadata: z.record(z.string(), z.any()).optional(),
});
```

### Path Parameters

```typescript
const paramsSchema = z.object({
  id: z.coerce.number().int().positive(), // rejects "", "0", "abc", "1.5"
});

// In /api/users/[id].get.ts
const { id } = await getValidatedRouterParams(event, paramsSchema.parse);
```

## Validation traps that keep shipping

Every one of these passed review once and was later fixed. Check them on every
handler you write or touch.

### 1. Never `readBody` / `getQuery` / `getRouterParams` and destructure

The raw readers return `any`. `const { amount } = await readBody(event)` accepts
any shape, and the first bad value surfaces as a **500** from deep in the handler
(or a database error) instead of a 400. Every field a handler reads, from body,
query **and** route params, goes through a schema, ids included.

```typescript
// ❌ unvalidated: wrong type, missing field and junk keys all reach the DB
const { amount, invoiceId } = await readBody(event);

// ✅ 400 on bad input, typed result
const { amount, invoiceId } = await readValidatedBody(event, z.object({
  amount: z.number().int().positive(),
  invoiceId: z.number().int().positive(),
}).parse);
```

### 2. Query and route values are strings, and `""` is not "absent"

`?page=` sends `""`. `z.coerce.number()` turns `""` into **`0`**, and `.default()`
only fires for `undefined`, so a blank param slips past the default. Rules:

- Ids and page numbers: `z.coerce.number().int().positive()` (rejects `""`, `0`, `NaN`).
- Optional filters a form may send blank: map `""` to `undefined` first.
- Booleans: `z.coerce.boolean()` makes `"false"` **true**. Use `z.stringbool()` or
  `z.enum(["true", "false"]).transform((v) => v === "true")`.

```typescript
const blankToUndefined = <T extends z.ZodType>(s: T) =>
  z.preprocess((v) => (v === "" ? undefined : v), s);

const querySchema = z.object({
  page: blankToUndefined(z.coerce.number().int().positive().optional()).default(1),
  status: blankToUndefined(z.enum(["open", "closed"]).optional()),
});
```

### 3. Dates: validate the calendar, not the shape

A `/^\d{4}-\d{2}-\d{2}$/` regex accepts `2025-02-30`, which then fails as a 500 in
the Postgres cast, or compares wrongly as text. `z.iso.date()` checks real calendar
days (it rejects `2025-02-30` and `2025-02-29`, accepts `2024-02-29`). Check
ranges on the object, with a `path` so the error lands on the right field:

```typescript
const rangeSchema = z.object({
  from: z.iso.date(),
  to: z.iso.date(),
}).refine((v) => v.from <= v.to, { error: "`to` must be on or after `from`", path: ["to"] });
```

(Canonical `YYYY-MM-DD` strings compare correctly as text; anything else doesn't.)

### 4. `z.object` silently strips unknown keys

A renamed or legacy field, a misspelled key, or a filter this mode doesn't support
is **dropped without an error**, so the caller believes it was applied. When a
dropped key would be a bug, use `z.strictObject({...})` (400 `Unrecognized key`),
or map the old name explicitly. Likewise, reject a parameter a branch cannot honor
(an `offset` on a mode that ignores it) instead of accepting and ignoring it.

### 5. Bound every string and array, above all on unauthenticated routes

Sign-up, contact and webhook-style endpoints that insert rows need `.max()` on
every string and array (`z.string().trim().min(1).max(200)`,
`z.array(...).max(50)`). Unbounded input from an anonymous caller is a storage and
DoS problem, not just a validation one.

### 6. Canonicalize once, in the schema

If identifiers are compared downstream (lookups, dedupe, guards), normalize them in
the schema with `.trim()` / `.toUpperCase()` / a `.transform()`, so every query
and every guard sees the same form. Two code paths that normalize differently
(the planner trims, the guard doesn't) disagree about the same record.

### 7. Cross-field rules, and PATCH against the stored row

Rules that involve two fields (start ≤ end, "B is required when A is X", a pair of
columns that must both be set or both be null) belong in a `.refine`/`.superRefine`
on the object. On a PATCH that sends only one of the pair, check the rule against
**the stored row merged with the patch**, not just the fields that were sent.

### 8. One schema per write, shared by every path that writes

Import, bulk, retry and "sync from provider" paths must call the **same** schema or
server util as the edit endpoint. A second hand-written path that skips a check is
how invalid rows get in. Put the validation in `server/utils/` (or `shared/`) and
call it from each path.

## Type Inference from Schemas

Export schemas for client-side type reuse:

```typescript
// types/api.ts
import { z } from "zod";

export const CreateUserSchema = z.object({
  email: z.email(),
  name: z.string().min(1),
});

export type CreateUserInput = z.infer<typeof CreateUserSchema>;

// Client usage
import type { CreateUserInput } from "~/types/api";
const body: CreateUserInput = { email: "test@example.com", name: "Test" };
```

**Note:** Nitro auto-generates response types, but NOT input types from Zod schemas.

## Zod 4 Notes (this stack pins zod ^4)

The model's prior is mostly Zod 3 — these are the idioms that changed. Get them right.

- **String formats are top-level functions, not `z.string()` methods.** Use `z.email()`, `z.url()`, `z.uuid()`, `z.ipv4()`, `z.iso.datetime()`. The chained forms (`z.string().email()`) are deprecated.
- **Error customization is one `error` param.** `message`, `invalid_type_error`, `required_error`, and `errorMap` are gone:
  ```typescript
  z.string().min(5, { error: "Too short." });
  z.string({ error: (iss) => iss.input === undefined ? "Required" : "Must be a string" });
  ```
- **Format errors with the built-ins**, not `zod-validation-error`: `z.prettifyError()` (human string), `z.treeifyError()` (nested, replaces deprecated `.format()`), `z.flattenError()` (replaces deprecated `.flatten()`).
- **`.default()` applies to the *output* type** and short-circuits parsing when input is `undefined`. For the old "run the default through the schema" behavior, use `.prefault()`.
- **`z.coerce.*` input type is now `unknown`** (not the output type) — fine for h3 query/body parsing, but affects schemas you consume elsewhere.
- **`.default()` fires even under `.optional()` (and through `.partial()`)** — `someDefaulted.optional()` still emits the default for a missing key, so a defaulted field can never signal "not provided". The classic trap is deriving a PATCH body from a create schema: `CreateSchema.partial()` silently fills every defaulted field, so `body.someField !== undefined` is always true and "was this field sent?" logic (partial updates, tree-replace triggers) misfires on every request. For PATCH schemas, compose from bare **undefaulted** field schemas and add `.optional()` per field:
  ```typescript
  const itemsSchema = z.array(ItemSchema); // no .default([]) here
  const createSchema = z.object({ items: itemsSchema.default([]) });
  const patchSchema = z.object({ items: itemsSchema.optional() }); // undefined ⇢ "not sent"
  ```
- **In a PATCH, "omitted", `null` and a value are three different requests.** Omitted
  (`undefined`) means "leave it", `null` means "clear it". Don't let a transform turn a
  missing key into `null` (`.optional().transform((v) => v ?? null)` does exactly that,
  and the update then wipes the stored value), and don't treat an explicit `null` as
  "not sent" when merging defaults (`body.x ?? derived` overrides the client's clear).
  Test for presence with `body.x !== undefined` (or `"x" in body`), and use `.nullable().optional()`
  for clearable fields.
