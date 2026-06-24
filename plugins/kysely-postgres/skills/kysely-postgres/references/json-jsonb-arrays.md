## JSON, JSONB, and Array Handling

### JSONB Columns

**NO `JSON.stringify` or `JSON.parse` needed!** The `pg` driver handles JSONB automatically:

```typescript
// INSERT - pass objects directly
await db
  .insertInto("user")
  .values({
    email: "test@example.com",
    metadata: { preferences: { theme: "dark" }, count: 42 },
  })
  .execute();

// UPDATE - pass objects directly
await db
  .updateTable("user")
  .set({
    metadata: { preferences: { theme: "light" } },
  })
  .where("id", "=", userId)
  .execute();

// READ - returns parsed object, not string
const user = await db
  .selectFrom("user")
  .select(["id", "metadata"])
  .executeTakeFirst();
console.log(user.metadata.preferences.theme); // "dark" - already an object!
```

### Array Columns (text[], int[], etc.)

**NO `JSON.stringify` needed for array columns!** The `pg` driver handles arrays natively:

```typescript
// INSERT with array - pass array directly
await db
  .insertInto("product")
  .values({
    name: "Product",
    tags: ["phone", "electronics", "premium"], // Direct array!
  })
  .execute();

// READ - returns as native JavaScript array
const product = await db
  .selectFrom("product")
  .select(["name", "tags"])
  .executeTakeFirst();
console.log(product.tags); // ["phone", "electronics", "premium"]

// UPDATE array
await db
  .updateTable("product")
  .set({ tags: ["updated", "tags"] })
  .where("id", "=", productId)
  .execute();
```

### Querying Arrays

```typescript
// Array contains all values (@>) - operator works natively!
.where("tags", "@>", sql`ARRAY['phone', 'premium']::text[]`)

// Arrays overlap (&&) - operator works natively!
.where("tags", "&&", sql`ARRAY['premium', 'basic']::text[]`)

// Array contains value (ANY) - type-safe with eb.fn
.where((eb) => eb(sql`${searchTerm}`, "=", eb.fn("any", [eb.ref("tags")])))
// eb.ref("tags") validates column exists - eb.ref("invalid") would be a TS error
```

### Querying JSONB

```typescript
// Key exists (?) - operator works natively!
.where("metadata", "?", "theme")

// Any key exists (?|) - operator works natively!
.where("metadata", "?|", sql`array['theme', 'language']`)

// All keys exist (?&) - operator works natively!
.where("metadata", "?&", sql`array['theme', 'notifications']`)

// JSONB contains (@>) - operator works natively!
.where("metadata", "@>", sql`'{"notifications": true}'::jsonb`)

// Extract field as text (->> as operator) - type-safe!
.where((eb) => eb(eb("metadata", "->>", "theme"), "=", "dark"))
// eb("metadata", ...) validates column - eb("invalid", ...) would be TS error

// Extract nested path (#>> still needs sql``)
.where(sql`metadata#>>'{preferences,theme}'`, "=", "dark")

// In SELECT - type-safe with eb()
.select((eb) => [
  eb("metadata", "->", "preferences").as("prefs"),   // Returns JSONB
  eb("metadata", "->>", "theme").as("theme"),        // Returns text
])
// Nested paths still need sql``
.select(sql`metadata#>'{preferences,theme}'`.as("t"))   // Nested as JSONB
.select(sql<string>`metadata#>>'{a,b}'`.as("t"))        // Nested as text
```

### JSONPath (PostgreSQL 12+)

```typescript
// JSONPath match (@@) - works as native operator!
.where("metadata", "@@", sql`'$.preferences.theme == "dark"'`)

// JSONPath exists (@?) - NOT in Kysely's allowlist, use function instead
// Use jsonb_path_exists() for type-safe column validation
.where((eb) =>
  eb.fn("jsonb_path_exists", [eb.ref("metadata"), sql`'$.preferences.theme'`])
)
// eb.ref("metadata") validates column - eb.ref("invalid") would be TS error

// Extract with JSONPath - type-safe with eb.fn
.select((eb) => [
  "id",
  eb.fn("jsonb_path_query_first", [eb.ref("metadata"), sql`'$.preferences.theme'`]).as("theme"),
])

// JSONPath with variables
const searchValue = "dark";
.where((eb) =>
  eb.fn("jsonb_path_exists", [
    eb.ref("metadata"),
    sql`'$.preferences.theme ? (@ == $val)'`,
    sql`jsonb_build_object('val', ${searchValue}::text)`,
  ])
)
```

### Conditional Queries ($if)

Use `$if()` for runtime-conditional query modifications:

```typescript
const result = await db
  .selectFrom("user")
  .selectAll()
  .$if(!includeInactive, (qb) => qb.where("is_active", "=", true))
  .$if(includeMetadata, (qb) => qb.select("metadata"))
  .$if(!!searchTerm, (qb) => qb.where("name", "like", `%${searchTerm}%`))
  .$if(!!roleFilter, (qb) => qb.where("role", "in", roleFilter!))
  .execute();
```

**Type behavior**: Columns added via `$if` become optional in the result type since inclusion isn't guaranteed at compile time.

### Relations (jsonArrayFrom / jsonObjectFrom)

Kysely is NOT an ORM - it uses PostgreSQL's JSON functions for nested data:

```typescript
import { jsonArrayFrom, jsonObjectFrom } from "kysely/helpers/postgres";

// One-to-many: User with their orders
const users = await db
  .selectFrom("user")
  .select((eb) => [
    "user.id",
    "user.email",
    jsonArrayFrom(
      eb
        .selectFrom("order")
        .select(["order.id", "order.status", "order.total_amount"])
        .whereRef("order.user_id", "=", "user.id")
        .orderBy("order.created_at", "desc")
    ).as("orders"),
  ])
  .execute();

// Many-to-one: Product with its category
const products = await db
  .selectFrom("product")
  .select((eb) => [
    "product.id",
    "product.name",
    jsonObjectFrom(
      eb
        .selectFrom("category")
        .select(["category.id", "category.name"])
        .whereRef("category.id", "=", "product.category_id")
    ).as("category"),
  ])
  .execute();
```

**Critical: Use explicit `.select()` instead of `.selectAll()` with nested json helpers**

When using `jsonObjectFrom` containing a nested `jsonArrayFrom` (or vice versa), using `selectAll("table")` breaks TypeScript's type inference. The result type becomes `unknown` or loses the nested structure, requiring `$castTo` to fix.

```typescript
// WRONG - selectAll() breaks type inference for nested json helpers
const invoice = await db
  .selectFrom("invoices")
  .selectAll("invoices")
  .select((eb) => [
    jsonObjectFrom(
      eb
        .selectFrom("payment_plans")
        .selectAll()  // ❌ This breaks type inference!
        .select((eb2) => [
          jsonArrayFrom(
            eb2.selectFrom("installments").selectAll()
              .whereRef("installments.plan_id", "=", "payment_plans.id")
          ).as("installments"),
        ])
        .whereRef("payment_plans.invoice_id", "=", "invoices.id")
    ).as("payment_plan"),  // Type is unknown or broken
  ])
  .executeTakeFirst();

// RIGHT - explicit select() preserves type inference
const invoice = await db
  .selectFrom("invoices")
  .selectAll("invoices")
  .select((eb) => [
    jsonObjectFrom(
      eb
        .selectFrom("payment_plans")
        .select([  // ✅ Explicit columns!
          "payment_plans.id",
          "payment_plans.invoice_id",
          "payment_plans.notes",
          "payment_plans.created_at",
        ])
        .select((eb2) => [
          jsonArrayFrom(
            eb2.selectFrom("installments").selectAll()
              .whereRef("installments.plan_id", "=", "payment_plans.id")
          ).as("installments"),
        ])
        .whereRef("payment_plans.invoice_id", "=", "invoices.id")
    ).as("payment_plan"),  // Type is properly inferred!
  ])
  .executeTakeFirst();
```

**Why this happens**: Kysely's type inference for nested json helpers relies on tracking the selected columns through the query chain. `selectAll()` returns all columns dynamically, which confuses TypeScript when combined with additional `.select()` calls that add nested json helpers. Using explicit column names gives TypeScript the static information it needs.

**Rule of thumb**: When combining `jsonObjectFrom`/`jsonArrayFrom` with nested json helpers, always use explicit `.select([...columns])` instead of `.selectAll()` on the subquery containing the nested helper.

### Reusable Helpers

Create composable, type-safe helper functions using `Expression<T>`:

```typescript
import { Expression, sql } from "kysely";

// Helper that takes and returns Expression<string>
function lower(expr: Expression<string>) {
  return sql<string>`lower(${expr})`;
}

// Use in queries
.where(({ eb, ref }) => eb(lower(ref("email")), "=", email.toLowerCase()))
```

### Splitting Query Building and Execution

Build queries without executing, useful for dynamic query construction:

```typescript
// Build query (doesn't execute)
let query = db
  .selectFrom("user")
  .select(["id", "email"]);

// Add conditions dynamically
if (role) {
  query = query.where("role", "=", role);
}
if (isActive !== undefined) {
  query = query.where("is_active", "=", isActive);
}

// Execute when ready
const results = await query.execute();

// Or compile to SQL without executing
const compiled = query.compile();
console.log(compiled.sql);        // The SQL string
console.log(compiled.parameters); // Bound parameters
```

### Subqueries

```typescript
// Subquery in WHERE
.where("id", "in",
  db.selectFrom("order").select("user_id").where("status", "=", "completed")
)

// EXISTS subquery
.where((eb) =>
  eb.exists(
    db.selectFrom("review")
      .select(sql`1`.as("one"))
      .whereRef("review.product_id", "=", eb.ref("product.id"))
  )
)
```

### INSERT Operations

```typescript
// Single insert with returning
const user = await db
  .insertInto("user")
  .values({ email: "test@example.com", first_name: "Test", last_name: "User" })
  .returning(["id", "email"])
  .executeTakeFirst();

// Multiple rows
await db
  .insertInto("user")
  .values([
    { email: "a@example.com", first_name: "A", last_name: "User" },
    { email: "b@example.com", first_name: "B", last_name: "User" },
  ])
  .execute();

// Upsert (ON CONFLICT) - type-safe with expression builder
await db
  .insertInto("product")
  .values({ sku: "ABC123", name: "Product", stock_quantity: 10 })
  .onConflict((oc) =>
    oc.column("sku").doUpdateSet((eb) => ({
      stock_quantity: eb("product.stock_quantity", "+", eb.ref("excluded.stock_quantity")),
    }))
  )
  .execute();
// eb("product.invalid_column", ...) would be a TypeScript error!

// Insert from SELECT
await db
  .insertInto("archive")
  .columns(["user_id", "data", "archived_at"])
  .expression(
    db.selectFrom("user")
      .select(["id", "metadata", sql`now()`.as("archived_at")])
      .where("is_active", "=", false)
  )
  .execute();
```

**`doUpdateSet` object vs callback form.** `doUpdateSet` takes either a plain
object `doUpdateSet({ col: value })` or a callback `doUpdateSet((eb) => ({ ... }))`.
The object form has no expression builder, so the moment you need a *builder
expression* for any column — arithmetic, an `EXCLUDED` reference, a coalesce — you
must switch the whole call to the callback form. Inside it, a **bare column name
refers to the target (existing) row**, and **`eb.ref("excluded.<col>")` references
the incoming row** (Kysely lowercases it to Postgres's `excluded` pseudo-table).
The other columns come along unchanged inside the returned object:

```typescript
// Raw sql for the increment / EXCLUDED — column names are unchecked strings
.onConflict((oc) =>
  oc.column("email").doUpdateSet({
    reply_count: sql`reply_count + 1`,
    email: sql`EXCLUDED.email`,
    status: "active",                       // plain value, fine in either form
  }),
)

// Callback form unlocks eb(): both column refs are now type-checked
.onConflict((oc) =>
  oc.column("email").doUpdateSet((eb) => ({
    reply_count: eb("reply_count", "+", 1),
    email: eb.ref("excluded.email"),
    status: "active",
  })),
)
```

The same object-vs-callback rule applies to `.set()` on a plain `UPDATE` (see below).

### UPDATE Operations

```typescript
// Simple update
await db
  .updateTable("user")
  .set({ is_active: false })
  .where("id", "=", userId)
  .execute();

// Update with expression
await db
  .updateTable("product")
  .set((eb) => ({
    stock_quantity: eb("stock_quantity", "+", 10),
  }))
  .where("sku", "=", "ABC123")
  .returning(["id", "stock_quantity"])
  .executeTakeFirst();
```

