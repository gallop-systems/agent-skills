## Migrations

### Configuration (kysely.config.ts)

```typescript
import { PostgresDialect } from "kysely";
import { defineConfig } from "kysely-ctl";
import pg from "pg";

export default defineConfig({
  dialect: new PostgresDialect({
    pool: new pg.Pool({
      connectionString: process.env.DATABASE_URL,
    }),
  }),
  migrations: {
    migrationFolder: "src/db/migrations",
  },
  seeds: {
    seedFolder: "src/db/seeds",
  },
});
```

### Migration Commands

```bash
npx kysely migrate:make migration-name  # Create migration
npx kysely migrate:latest               # Run all pending migrations
npx kysely migrate:down                 # Rollback last migration
npx kysely seed make seed-name          # Create seed
npx kysely seed run                     # Run all seeds
```

Seeds that feed a preview/dev box have their own conventions (idempotency,
order-independence, factories shared with tests, a validity harness) — see
[seeding-pattern.md](references/seeding-pattern.md).

### Migration File Structure

```typescript
import type { Kysely } from "kysely";
import { sql } from "kysely";

// Always use Kysely<any> - migrations should be frozen in time
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("user")
    .addColumn("id", "bigint", (col) => col.primaryKey().generatedAlwaysAsIdentity())
    .addColumn("email", "text", (col) => col.notNull().unique())
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  // IMPORTANT: Always index foreign key columns!
  await db.schema.createIndex("idx_order_user_id").on("order").column("user_id").execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("user").execute();
}
```

### Recommended Column Types

```typescript
// Primary keys: Use identity columns (SQL standard, prevents accidental ID conflicts)
.addColumn("id", "bigint", (col) => col.primaryKey().generatedAlwaysAsIdentity())
// NOT serial/bigserial - those allow manual ID inserts that can cause conflicts

// Timestamps: Always use timestamptz (stores UTC, converts to client timezone)
.addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
// NOT timestamp - loses timezone information

// Money: Use numeric with precision (exact decimal, no floating point errors)
.addColumn("price", "numeric(10, 2)", (col) => col.notNull())
// NOT float/real/double precision - those have rounding errors

// Strings: Use text (no length limit, same performance as varchar)
.addColumn("name", "text", (col) => col.notNull())
// varchar(n) only if you need a hard length constraint

// JSON: Use jsonb (binary, indexable, faster queries)
.addColumn("metadata", "jsonb")
// NOT json - stored as text, no indexing, slower

// Foreign keys: Create indexes manually (PostgreSQL doesn't auto-index FKs)
await db.schema.createIndex("idx_order_user_id").on("order").column("user_id").execute();
```

### Data Type Gotchas

```typescript
// CORRECT - Space after comma in numeric types
.addColumn("price", "numeric(10, 2)")

// WRONG - Will fail with "invalid column data type"
.addColumn("price", "numeric(10,2)")

// For complex types, use sql template
.addColumn("price", sql`numeric(10, 2)`)
```

### Migration Ordering Is Append-Only — Out-of-Order Timestamps Break Prod Deploys

Kysely's migrator enforces a **strict append-only ledger**: it refuses to run any
unexecuted migration whose timestamp sorts *before* the last-executed one
(throwing `Corrupted migrations: previously executed migration ... is missing`).
This bites when two branches each add a migration, and the one that merges *second*
carries the *earlier* timestamp:

```
branch A merges first  → 1700000200000_drop_thing      (runs in prod)
branch B merges second → 1700000100000_add_table       (timestamp is EARLIER)
                       → 1700000100001_add_column
```

Prod has already recorded `...200000_drop_thing` as executed. On the next deploy
the `migrate` job sees two pending migrations that sort *before* it, throws
"Corrupted migrations", and **exits non-zero**. If migrations run as a pre-deploy
job (common on PaaS like DigitalOcean App Platform), the failed job fails the whole
deploy and the platform **auto-rolls-back to the previous image** — so prod silently
stays on stale code and every subsequent deploy fails the same way. A self-reinforcing
loop that looks like a deploy/token problem but is really a migration-ledger problem.

**Prevent it:** before merging a long-lived branch, check whether `main` has merged
any migration with a *later* timestamp than yours. If so, regenerate your migration's
timestamp so it sorts last (`migrate:make` again, or rename the file) **before it
merges** — only safe while the migration has not yet run in any shared DB. Never
re-stamp a migration that prod has already executed; that forces it to re-run.

**Fix it once prod is wedged:** reconcile the ledger so the executed set is a clean
*prefix* again, then let the normal strict migrate job run. Do **not** reach for
`allowUnorderedMigrations: true` — it works (kysely-ctl spreads the `migrations`
config into the `Migrator`), but it permanently weakens the ordering guard to paper
over one bad state. Instead, surgically remove the prematurely-recorded row from the
migration ledger table (default `kysely_migration`):

```sql
-- prod ledger has the later-timestamp migration recorded, blocking the two earlier ones
DELETE FROM kysely_migration WHERE name = '1700000200000_drop_thing';
```

Now `add_table → add_column → drop_thing` are all pending in true timestamp order, and
the next deploy's strict migrate job applies them cleanly. This only works when the
removed migration is **idempotent to re-run** (e.g. a `dropTable`/`dropColumn` written
with `ifExists`, so re-applying it after the others is a safe no-op). Verify the
ledger is a contiguous prefix after the DELETE, and prefer letting the deploy's own
migrate job re-apply rather than running migrations from a laptop against prod.

## Schema Comments — Document in the DB, Not Just in Migration Source

Design notes written as `//` comments in a migration file are invisible the moment
the migration runs: they don't reach a live database and they don't reach the
generated types. **Put the documentation in the database itself** as Postgres
COMMENTs so it survives, stays queryable (`\d+`, `obj_description`, any GUI), and —
via codegen below — lands in the generated `db.d.ts` as JSDoc.

Comment every object that carries intent, not just tables and columns:

```typescript
await sql`COMMENT ON TABLE ${sql.ref("invoice")} IS ${sql.lit(
  "A billed invoice. status is DERIVED from payments, never stored.",
)}`.execute(db);
await sql`COMMENT ON COLUMN ${sql.ref("invoice.void_reason")} IS ${sql.lit(
  "Set only when status='void'; null otherwise.",
)}`.execute(db);
await sql`COMMENT ON INDEX ${sql.ref("uq_invoice_current_number")} IS ${sql.lit(
  "One live number per org — partial unique WHERE void_at IS NULL.",
)}`.execute(db);
await sql`COMMENT ON CONSTRAINT ${sql.ref("invoice_status_check")} ON ${sql.ref("invoice")} IS ${sql.lit(
  "status must be one of draft/sent/paid/void.",
)}`.execute(db);
```

Use `sql.ref()` for identifiers and `sql.lit()` for the text (it escapes the
literal; `COMMENT` does not accept bound parameters). To reverse, set the comment
to `NULL`. Centralizing all comments in one data-driven migration (maps of
table/column/index/constraint → text, applied in `up`, nulled in `down`) keeps them
in one place and makes the `down` trivial.

**Keep comments in sync with behavior.** When a migration changes *how something
works* — a column's meaning, what a partial index enforces, a new CHECK — update
its comment in that same migration. A stale comment is worse than none.

**Gather context from these comments.** Before querying or changing a table, read
its JSDoc in the generated `db.d.ts` (see below) — the table/column/index/constraint
notes are the schema's own explanation of intent, invariants, and "derived, not
stored" rules. Prefer them over re-deriving intent from the raw column list.

## Type Generation

Use `kysely-codegen` to generate types from your database:

```bash
npx kysely-codegen --url "postgresql://..." --out-file src/db/db.d.ts
```

Generated types use:
- `Generated<T>` for auto-increment columns (optional on insert)
- `ColumnType<Select, Insert, Update>` for different operation types
- `Timestamp` for timestamptz columns

### Surfacing schema comments in the generated types

`kysely-codegen` emits **column** comments as JSDoc automatically, but drops
**table**, **index**, and **constraint** comments (kysely #1368 / kysely-codegen
#316, unmerged as of 0.20.0 — indexes and constraints also have no symbol of their
own in the output). Recover them with a post-codegen step: a small script reads
`obj_description` for tables/indexes/constraints and injects each table's comment
plus `Indexes:` / `Constraints:` sections as JSDoc above its `export interface`.
Chain it into the codegen command:

```jsonc
"db:codegen": "kysely-codegen --url $DATABASE_URL --out-file src/db/db.d.ts --dialect postgres --date-parser string && node scripts/inject-table-comments.mjs $DATABASE_URL src/db/db.d.ts"
```

The result is a `db.d.ts` where each table interface is prefaced by its full design
note — the documentation surface an agent should consult first. (Ship the
`inject-table-comments.mjs` script and this wired-up `db:codegen` in your project
template so every scaffolded repo gets it out of the box.)

