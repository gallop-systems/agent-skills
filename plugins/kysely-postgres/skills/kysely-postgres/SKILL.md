---
name: kysely-postgres
description: Write effective, type-safe Kysely queries for PostgreSQL. This skill should be used when working in Node.js/TypeScript backends with Kysely installed, covering query patterns, migrations, type generation, and common pitfalls to avoid.
---

# Kysely for PostgreSQL

Kysely is a type-safe TypeScript SQL query builder. This skill provides patterns for writing effective queries, managing migrations, and avoiding common pitfalls.

## When to Use This Skill

Use this skill when:
- Working in a Node.js/TypeScript project with Kysely installed
- Writing database queries for PostgreSQL
- Creating or modifying database migrations
- Debugging type inference issues in Kysely queries

## Reference Files

This skill is split into topic guides — read the [Core Principles](#core-principles) below, then open the guide matching what you're doing:

- [expression-builder.md](references/expression-builder.md) — the ExpressionBuilder (`eb`) foundation, `eb.val` vs `eb.lit`, standalone `eb`, conditional expression arrays, string concatenation
- [query-patterns.md](references/query-patterns.md) — SELECT, WHERE clauses, JOINs (incl. callback format), aggregations, ORDER BY, CTEs, JSON aggregation, where LIMIT goes (cap last; count and list from one base query), deterministic ordering
- [json-jsonb-arrays.md](references/json-jsonb-arrays.md) — JSONB columns, array columns, querying arrays/JSONB, JSONPath, `$if`, relations (jsonArrayFrom/jsonObjectFrom), reusable helpers, splitting build/execute, subqueries, INSERT/UPDATE
- [window-functions.md](references/window-functions.md) — ROW_NUMBER/RANK, LAG/LEAD, windowed aggregates, frames
- [set-lateral-locking.md](references/set-lateral-locking.md) — set operations (UNION/INTERSECT/EXCEPT), LATERAL joins, row locking (FOR UPDATE / SKIP LOCKED)
- [concurrency-and-transactions.md](references/concurrency-and-transactions.md) — read-then-write races: unique constraint + `onConflict`, conditional updates, lock-then-re-read, the same lock on every write path, advisory locks, `forUpdate("table")` with joins, lock order, one transaction for all writes, savepoints (only on `startTransaction()`)
- [full-text-and-grouping.md](references/full-text-and-grouping.md) — full-text search (tsvector/tsquery), advanced grouping (ROLLUP/CUBE/GROUPING SETS)
- [migrations-and-codegen.md](references/migrations-and-codegen.md) — migrations (config, commands, file structure, column types, gotchas, ordering), migration safety on live data (one transaction per batch, `NOT VALID` + `VALIDATE`, `CONCURRENTLY` and invalid indexes, non-destructive `down`), and type generation
- [common-pitfalls.md](references/common-pitfalls.md) — raw `sql`, forgetting `.execute()`, `whereRef`, typed function returns, FK indexing, typed `sql` literals, DATE timezones, the `between` operator, string args as column refs, identifier normalization, CHECK vs NULL/NaN, date/time boundaries, LIKE wildcards, large ID lists and numeric inputs
- [helpers-and-extending.md](references/helpers-and-extending.md) — PostgreSQL helpers summary, `mergeAction`, custom helper functions, custom expression classes
- [deep-types.md](references/deep-types.md) — fixing the "excessively deep types" error with `$assertType`
- [seeding-pattern.md](references/seeding-pattern.md) — idempotent preview/dev seeding: factories shared by tests + seeds, monotonic-counter uniqueness, order-independence, scenes built in target state, the validity harness, preview login

Runnable, copy-pasteable query examples live alongside as `.ts` files:

- [select-where.ts](references/select-where.ts) - Basic SELECT patterns, WHERE clauses, AND/OR, BETWEEN, ANY
- [joins.ts](references/joins.ts) - Simple joins, callback joins, subquery joins, cross joins, lateral joins
- [aggregations.ts](references/aggregations.ts) - COUNT, SUM, AVG, GROUP BY, HAVING, ROLLUP/CUBE/GROUPING SETS
- [window-functions.ts](references/window-functions.ts) - ROW_NUMBER/RANK, LAG/LEAD, windowed aggregates, frames
- [orderby-pagination.ts](references/orderby-pagination.ts) - ORDER BY, NULLS handling, DISTINCT, pagination
- [ctes.ts](references/ctes.ts) - Common Table Expressions, multiple CTEs, recursive CTEs, MATERIALIZED
- [set-operations.ts](references/set-operations.ts) - UNION, INTERSECT, EXCEPT (and *All variants)
- [json-arrays.ts](references/json-arrays.ts) - JSONB handling, array columns, jsonBuildObject, jsonAgg
- [relations.ts](references/relations.ts) - jsonArrayFrom, jsonObjectFrom for nested data
- [full-text-search.ts](references/full-text-search.ts) - tsvector/tsquery matching with @@, ranking
- [locking.ts](references/locking.ts) - FOR UPDATE/SHARE, SKIP LOCKED, NOWAIT, job-queue pattern
- [mutations.ts](references/mutations.ts) - INSERT, UPDATE, DELETE, UPSERT, INSERT FROM SELECT
- [expressions.ts](references/expressions.ts) - CASE, $if, subqueries, eb.val/lit/not, standalone eb, dynamic refs

## Core Principles

1. **Always use Kysely's query builder — never reach for raw `sql`**: Almost anything expressible in SQL is expressible type-safely through Kysely's methods and the ExpressionBuilder (`eb`); raw `sql`` throws away the type safety this stack depends on. Treat it as a true last resort — only when Kysely genuinely cannot express the query (and type the template literal when you must). Being unsure how to do something is the cue to check the reference guides above, **not** to drop to raw SQL.
2. **Use the ExpressionBuilder (eb)**: The `eb` parameter in callbacks is the foundation of type-safe query building
3. **Let TypeScript guide you**: If it compiles, it's likely correct SQL
4. **Document schema in the database, and read it before you touch a table**: Keep table/column/index/constraint notes as Postgres COMMENTs (not just migration source), surface them in the generated `db.d.ts`, and update them in the same migration that changes how something works. Consult that JSDoc to gather context before querying or altering a table — see [migrations-and-codegen.md](references/migrations-and-codegen.md#schema-comments--document-in-the-db-not-just-in-migration-source).

## Traps Code Review Keeps Catching

These are the bugs reviewers most often find in Kysely code that compiles and passes tests. Check each one before you finish a query or migration:

- **Read-then-write is a race.** A `SELECT` takes no lock under READ COMMITTED. Use a unique constraint + `onConflict`, put the guard in the `UPDATE`'s `WHERE` and check `numUpdatedRows`, or lock the parent row (`forUpdate("table")`) and re-read after the lock. Every write path must take the same lock. → [concurrency-and-transactions.md](references/concurrency-and-transactions.md)
- **Related writes share one `trx`**; helpers take the executor as a parameter. A caught error aborts the transaction, and savepoints exist only on `db.startTransaction()`. → [concurrency-and-transactions.md](references/concurrency-and-transactions.md#5-a-caught-database-error-poisons-the-transaction)
- **Cap last.** Filter, exclude ineligible rows and aggregate before `limit`; build count and list from one base query; look up exact matches before a limited fuzzy search; `in []` is a syntax error. → [query-patterns.md](references/query-patterns.md#limit-counts-and-filters-cap-last)
- **`DESC` puts NULLs first**: add `nullsLast()`, a unique tie-breaker, and order *inside* `jsonAgg`. → [query-patterns.md](references/query-patterns.md#deterministic-ordering)
- **Normalize identifiers once** (trim + lowercase on write, unique index on `lower(...)`, same expression on lookup and join). → [common-pitfalls.md](references/common-pitfalls.md#10-normalize-identifiers-once-and-match-the-same-way-everywhere)
- **Date ranges:** exclusive upper bound at the next day; "today" in the business time zone, not the session's. → [common-pitfalls.md](references/common-pitfalls.md#12-date-and-time-boundaries)
- **CHECK passes on NULL and NaN**; **LIKE's `_` is a wildcard**. → [common-pitfalls.md](references/common-pitfalls.md#11-check-constraints-pass-on-null-and-nan)
- **Migrations on live tables:** `NOT VALID` then `VALIDATE` in a later deploy, non-destructive `down()`, repoint foreign keys before deleting or merging rows. → [migrations-and-codegen.md](references/migrations-and-codegen.md#migration-safety-on-tables-that-already-have-data)

## Contributing Back

This skill grows by capturing what it missed. If you just worked through something in this domain that this skill did not cover — an error you had to figure out, a behavior that contradicts what is documented above, a workflow knot — ask the user: **"Want me to contribute this back to the kysely-postgres skill?"**

If yes, run `/contribute-skill`. If that command is not available, do the equivalent inline: distill the generic lesson (placeholders only — no project names, IDs, domains, or secrets), then branch or fork [gallop-systems/agent-skills](https://github.com/gallop-systems/agent-skills) and open a PR editing this skill.
