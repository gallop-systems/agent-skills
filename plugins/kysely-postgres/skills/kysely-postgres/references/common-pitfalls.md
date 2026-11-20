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

**…but only when the expression references the schema.** The whole payoff of
dropping raw `sql` is letting Kysely validate column/table names against your
generated types — so the value is proportional to how many schema identifiers the
expression names. A `sql` template made only of **bound parameters and constants**
has nothing to check; converting it is lateral churn, and occasionally worse:

```typescript
// WORTH CONVERTING - names a column, so eb.ref/eb() validate it exists
.where(sql`lower(name)`, "=", value)
.where((eb) => eb(eb.fn<string>("lower", [eb.ref("name")]), "=", value))

// WORTH CONVERTING - correlated EXISTS validates table + both column refs
sql<boolean>`EXISTS (SELECT 1 FROM child WHERE child.parent_id = parent.id)`
eb.exists(eb.selectFrom("child").select(eb.lit(1).as("one"))
  .whereRef("child.parent_id", "=", "parent.id"))

// LEAVE RAW - a bound param + a constant cast: no column, nothing to verify.
// The "typed" form is also a schema MISMATCH: eb.cast(...) is Expression<Date>,
// but a DATE column is codegen'd as `string` (with --date-parser string).
sql`${value}::date`            // keep it

// LEAVE RAW - bare string/number/bool literals have no schema surface
sql.lit("Unassigned")          // keep it (or eb.lit for number/bool, but no real gain)
```

Rule of thumb: **convert when the raw SQL names a column or table; leave it when
it is only parameters and literals.** The latter compiles to identical SQL and the
"type-safe" rewrite verifies nothing.

**One more trap in the canonical `count(*)` swap above: it returns a *string* at
runtime, and a type parameter won't change that.** `eb.fn.countAll()` emits a bare
`count(*)`, which PostgreSQL returns as `bigint` — and the `pg` driver deserializes
`bigint` to a JavaScript **string** by default (see why below). So the row's `count`
is `"2"`, not `2`:

```typescript
// MISLEADING - compiles, but lies about the runtime value
.select((eb) => eb.fn.countAll<number>().as("count"))
// `<number>` is a pure type assertion. The driver still hands back a string,
// so `row.count === 2` is false and `row.count.toFixed()` throws.

// RIGHT - cast in SQL so the driver parses a real number
.select((eb) => eb.cast<number>(eb.fn.countAll(), "integer").as("count"))
// emits `cast(count(*) as integer)` -> int4 -> the driver yields a JS number
```

The rule generalizes: **typing a `sql`/builder expression as `<number>` does not
change the value the driver produces — only a SQL-level cast does.** Any
`bigint`-returning aggregate (`count`, `sum` over a `bigint`, etc.) needs an explicit
`cast` when downstream code expects a JS number.

> **Why `bigint` comes back as a string — and don't "fix" it globally.** The `pg`
> driver returns `int8`/`bigint` as a string on purpose: a JS `number` is a float64,
> exact only to `2^53 - 1`, while `bigint` runs to `2^63 - 1`, so auto-parsing would
> silently corrupt large IDs. You *can* register `pg.types.setTypeParser` to coerce
> `int8` to a number, but it reintroduces that precision footgun for **every**
> `bigint` column (primary keys included), and `kysely-codegen` has no
> `--bigint-parser` flag (only `--date-parser` / `--numeric-parser`) — so the
> generated `Int8` type still selects as `string` and you would be hand-overriding an
> alias that regeneration clobbers. Keep the string default and `cast` per query where
> you need a number.

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

### 9. Builder Argument Strings Are Column References, Not Literals

This bites hardest when converting raw `sql` to builders. In `eb.fn.coalesce`,
binary `eb(lhs, op, rhs)`, and most `eb.fn` calls, a bare string argument is
interpreted as a **column reference**, not a string value. So porting
`` sql`coalesce(status, 'pending')` `` naively produces a query that looks for a
column named `pending`:

```typescript
// WRONG - 'pending' is read as a column name -> "column \"pending\" does not exist"
eb.fn.coalesce("status", "pending")

// RIGHT - wrap a literal default in eb.val() (parameterized) ...
eb.fn.coalesce("status", eb.val("pending"))
// ... or a typed sql`` literal when you need it inlined (e.g. inside GROUP BY)
eb.fn.coalesce("status", sql<string>`'pending'`)

// Number/boolean/null literals can use eb.lit (eb.lit rejects strings, see
// expression-builder.md):
eb.fn.coalesce("score", eb.lit(0))

// Coalescing two real COLUMNS is the case where bare strings are correct:
eb.fn.coalesce("preferred_name", "legal_name")   // both are column refs
```

A companion trap: when you feed a `sql`` fragment as the right-hand operand of a
typed operator (e.g. a full-text `@@`), the fragment must carry a type parameter
or it infers `unknown` and the operator overload rejects it:

```typescript
// WRONG - RawBuilder<unknown> is not a valid operand -> TS2345
.where("search_vector", "@@", sql`to_tsquery('english', ${q})`)

// RIGHT - type the fragment so it satisfies the operator's operand type
.where("search_vector", "@@", sql<string>`to_tsquery('english', ${q})`)
```

### 10. Normalize Identifiers Once, and Match the Same Way Everywhere

Emails, codes and external ids arrive with mixed case and stray whitespace. If
writes, lookups, joins and the unique index each normalize differently, you get
missed matches and duplicate accounts. Pick one form, store it, and index it:

```typescript
// write: normalize before insert/update
const email = input.email.trim().toLowerCase();

// enforce: store only the normalized form, so the column itself can be compared.
// SQL trimming is not JS trimming (`btrim(x)` strips spaces only; `\\s` in a regex
// is ASCII-only in the C locale, while JS `trim()` also strips U+FEFF and others),
// so backfill with the SAME function the write path uses, not a SQL lookalike:
for (const u of await db.selectFrom("user").select(["id", "email"]).execute()) {
  const email = u.email.trim().toLowerCase();
  if (email !== u.email) await db.updateTable("user").set({ email }).where("id", "=", u.id).execute();
}
// a backstop for writers that skip the normalizer (catches case and ASCII whitespace)
await sql`alter table "user" add constraint user_email_normalized
  check (email = lower(email) and email !~ '^\\s|\\s$')`.execute(db);
await db.schema.createIndex("user_email_uq").on("user").unique().column("email").execute();
// (resolve rows that collide after the backfill before creating the index)

// read: a plain comparison now matches every row
.where("email", "=", email)
```

Apply the same normalization to both sides of a join key and to values you test
for emptiness: a concatenation like `first || ' ' || last` is `' '`, not `''`, when
both parts are empty, so trim before the check. If later code matches
case-insensitively, the SQL predicate must too.

### 11. CHECK Constraints Pass on NULL (and NaN)

A CHECK is satisfied when its expression is true **or NULL**, so a condition that
touches a NULL column silently allows the row:

```typescript
// WRONG - kind='district' with district_code NULL passes (NULL is not false)
sql`check (kind <> 'district' or district_code between 1 and 32)`
// RIGHT - say IS NOT NULL explicitly
sql`check (kind <> 'district' or (district_code is not null and district_code between 1 and 32))`
```

`numeric` also accepts `'NaN'`, and PostgreSQL sorts NaN above every number, so
`check (amount > 0)` passes for NaN. Reject `!Number.isFinite(x)` before writing.
When a CHECK couples two columns (`status = 'failed'` requires `error` not null),
every update of one must set the other in the same statement.

### 12. Date and Time Boundaries

- **Inclusive end date vs timestamp column:** `where created_at <= '2025-01-31'`
  means midnight at the *start* of the 31st and drops that whole day. Use an
  exclusive upper bound at the next day:
  `.where("created_at", ">=", start).where("created_at", "<", dayAfterEnd)`.
- **"Today" depends on the session time zone.** `CURRENT_DATE` and
  `now()::date` use the connection's `TimeZone` (often UTC on servers), and
  `CURRENT_DATE AT TIME ZONE 'X'` does not give X's date. Convert the instant
  first, then take the date (or compute the boundary in TypeScript with the zone
  and pass it as a parameter):
  ```typescript
  sql<string>`(now() at time zone 'America/New_York')::date`
  ```
  Cutoffs such as "before today" belong at that zone's midnight, not UTC midnight.
- **Casting untrusted text to a date:** PostgreSQL does not evaluate `WHERE`/`AND`
  terms in a defined order, so `col ~ '^\d{4}-\d{2}-\d{2}$' and col::date > ...`
  can still cast the bad value and error. Guard with `CASE` (which does order
  evaluation) or clean the value to NULL first. A regex shape check also accepts
  `2025-02-30`; validate a real calendar date before inserting.

### 13. LIKE Treats `_` and `%` as Wildcards

`like 'user_%'` also matches `userX…`. Escape user-supplied or literal patterns
(`value.replace(/[\\%_]/g, "\\$&")`), or compare a literal prefix without LIKE:
`eb.fn<boolean>("starts_with", [eb.ref("code"), eb.val(prefix)])`. When
matching an identifier inside text, match a whole token, not a substring, so
`12` does not match `1234`.

### 14. Large ID Lists and Numeric Inputs

- The wire protocol caps a statement at 65,535 bind parameters, so
  `.where("id", "in", ids)` with a huge array fails. Send one array parameter
  instead: `.where((eb) => eb("id", "=", eb.fn.any(eb.val(ids))))` emits
  `"id" = any($1)`. (Batch bulk inserts by row count for the same reason.)
- Text that will be compared to a `bigint`/`integer` column must be range-checked
  first; an out-of-range literal raises an error instead of matching nothing.
- Casting `numeric` to an integer type rounds (ties away from zero); `Math.trunc`
  or `trunc()` first when you mean truncation toward zero (`floor` rounds
  negatives down: `floor(-1.7)` is `-2`).
- Sort numeric parts of a code numerically, not as text (`'100' < '99'` as text).
