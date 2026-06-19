## Set Operations (UNION / INTERSECT / EXCEPT)

Combine two compatible queries. Plain forms dedupe; `*All` forms keep duplicates (and are cheaper). See [set-operations.ts](references/set-operations.ts).

```typescript
db.selectFrom("order").select("user_id")
  .except(db.selectFrom("review").select("user_id"))   // orders, never reviewed
  .execute();
// .union/.unionAll, .intersect/.intersectAll, .except/.exceptAll
// Both branches must select matching columns/names — align with `as` aliases.
```

## LATERAL Joins (PostgreSQL)

A `LATERAL` subquery can reference earlier tables via `whereRef` and runs per outer row — the best tool for **top-N-per-group with a per-row LIMIT**. Use `*Lateral` + `join.onTrue()`. See [joins.ts](references/joins.ts).

```typescript
// Each user's 3 most recent orders
db.selectFrom("user as u")
  .innerJoinLateral(
    (eb) => eb.selectFrom("order as o")
      .select(["o.id", "o.total_amount", "o.created_at"])
      .whereRef("o.user_id", "=", "u.id")
      .orderBy("o.created_at", "desc").limit(3).as("recent"),
    (join) => join.onTrue()
  )
  .select(["u.email", "recent.id", "recent.total_amount"])
  .execute();
// leftJoinLateral / crossJoinLateral also exist.
```

## Row Locking (FOR UPDATE / SKIP LOCKED)

Pessimistic locks for read-modify-write and job queues (run inside a transaction). See [locking.ts](references/locking.ts).

```typescript
// Job-queue worker: grab the next pending jobs, skipping rows other workers hold
db.selectFrom("job").selectAll()
  .where("status", "=", "pending")
  .orderBy("created_at").limit(10)
  .forUpdate().skipLocked()
  .execute();
// Lock strength: forKeyShare < forShare < forNoKeyUpdate < forUpdate
// Wait behavior: .skipLocked() (skip) or .noWait() (error instead of blocking)
```

