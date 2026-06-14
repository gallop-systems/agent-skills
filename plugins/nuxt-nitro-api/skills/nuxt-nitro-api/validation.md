# Validation Patterns

> **Example:** [validation-endpoint.ts](./examples/validation-endpoint.ts)

## Available Utilities (all auto-imported from h3)

| Raw | Validated |
|-----|-----------|
| `readBody(event)` | `readValidatedBody(event, validator)` |
| `getQuery(event)` | `getValidatedQuery(event, validator)` |
| `getRouterParams(event)` | `getValidatedRouterParams(event, validator)` |

Note: It's `getRouterParams` (plural), not `getRouterParam`.

## Pattern 1: Direct Schema (h3 v2+ with Standard Schema)

h3 v2+ supports Standard Schema, meaning you can pass Zod schemas directly:

```typescript
const querySchema = z.object({
  search: z.string().min(1),
  page: z.coerce.number().default(1),
});

// Pass schema directly (recommended)
const query = await getValidatedQuery(event, querySchema);

// Also works for body and params
const body = await readValidatedBody(event, bodySchema);
const params = await getValidatedRouterParams(event, paramsSchema);
```

**Pros:** Simplest syntax, cleaner code
**Cons:** ZodError thrown directly - not user-friendly

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
  id: z.coerce.number().positive(),
});

// In /api/users/[id].get.ts
const { id } = await getValidatedRouterParams(event, paramsSchema);
```

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
