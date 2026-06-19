## Common Pitfalls to Avoid

### 1. Don't Resort to `sql`` When Kysely Has a Method

```typescript
// WRONG
.select(sql`count(*)`.as("count"))

// RIGHT
.select((eb) => eb.fn.countAll().as("count"))

// WRONG - raw SQL for FILTER (WHERE ...) on aggregates
.having(sql<number>`count(*) filter (where status != 'signed')`, "=", 0)

// RIGHT - .filterWhere() works on all aggregate function builders
.having(
  (eb) => eb.fn.countAll().filterWhere("status", "!=", "signed"),
  "=",
  0
)
```

### 2. Don't Forget .execute()

Queries are lazy - they won't run without calling an execute method:

```typescript
// This does nothing!
db.selectFrom("user").selectAll();

// This runs the query
await db.selectFrom("user").selectAll().execute();
```

### 3. Use whereRef for Column-to-Column Comparisons

```typescript
// WRONG - Compares to string literal "other.column"
.where("table.column", "=", "other.column")

// RIGHT - Compares to actual column value
.whereRef("table.column", "=", "other.column")
```

### 4. Type Your Function Returns

```typescript
// Better type inference
eb.fn<string>("concat", [...])
eb.fn<number>("length", [...])
```

### 5. PostgreSQL Does NOT Auto-Index Foreign Keys

Always create indexes on foreign key columns:

```typescript
await db.schema.createIndex("idx_order_user_id").on("order").column("user_id").execute();
```

### 6. Always Type `sql` Template Literals

When using `sql` template literals, the inferred type is `unknown` since Kysely can't know what the SQL expression resolves to. Always provide an explicit type:

```typescript
// WRONG - Returns unknown type
eb.fn.coalesce("some_json_col", sql`'{}'::jsonb`)

// RIGHT - Explicit type annotation
eb.fn.coalesce("some_json_col", sql<Record<string, unknown>>`'{}'::jsonb`)

// For complex types (e.g., JSON column from a CTE), use typeof with eb.ref
// This ensures the fallback type matches the column type exactly
eb.fn
  .coalesce(
    eb.ref("jobs_agg.jobs"),
    sql<typeof eb.ref<"jobs_agg.jobs">>`'[]'::json`
  )
  .as("jobs")
```

**Key rule**: Every `sql` template literal should have a type parameter: `sql<TYPE>`. This ensures proper type inference throughout your query chain.

### 7. DATE Columns Cause Timezone Issues

By default, the `pg` driver converts DATE columns to JavaScript `Date` objects. This causes timezone problems:

```
Database: 2025-01-01 (just a date, no time)
JS Date:  2025-01-01T00:00:00.000Z (interpreted as UTC midnight)
User in NYC sees: Dec 31, 2024 (5 hours behind UTC)
```

**Solution: Parse DATE as string and let the frontend handle formatting**

Step 1: Configure `pg` to return DATE as string:

```typescript
import pg from "pg";

// Tell pg to return DATE columns as strings instead of Date objects
const DATE_OID = 1082;
pg.types.setTypeParser(DATE_OID, (val: string) => val);
```

Step 2: Update `kysely-codegen` to generate matching types:

```bash
npx kysely-codegen \
  --url="$DATABASE_URL" \
  --out-file=server/db/db.d.ts \
  --dialect=postgres \
  --date-parser=string
```

Now DATE columns return strings like `"2025-01-01"` and the frontend can parse/format respecting the user's timezone.

**Note**: This applies to DATE columns only. TIMESTAMPTZ columns already handle timezones correctly by storing UTC and converting on read.

### 8. Don't Use the `between` String Operator — It Emits Invalid SQL

The `"between"` operator looks like it should work but compiles to a tuple, which is a PostgreSQL syntax error:

```typescript
// WRONG - compiles to: "age" between ($1, $2)  -> Postgres syntax error
.where("age", "between", [18, 65])

// RIGHT - use the expression-builder helpers
.where((eb) => eb.between("age", 18, 65))            // "age" between $1 and $2
.where((eb) => eb.betweenSymmetric("age", 65, 18))   // swaps bounds if needed
```

