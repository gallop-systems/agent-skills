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

## Type Generation

Use `kysely-codegen` to generate types from your database:

```bash
npx kysely-codegen --url "postgresql://..." --out-file src/db/db.d.ts
```

Generated types use:
- `Generated<T>` for auto-increment columns (optional on insert)
- `ColumnType<Select, Insert, Update>` for different operation types
- `Timestamp` for timestamptz columns

