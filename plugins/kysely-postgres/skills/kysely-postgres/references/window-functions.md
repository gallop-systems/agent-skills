## Window Functions

Two builders cover almost everything. See [window-functions.ts](references/window-functions.ts) for the full set.

```typescript
// Named window functions (no dedicated helper): eb.fn.agg<T>("NAME", [args])
.select((eb) => [
  eb.fn.agg<number>("ROW_NUMBER")
    .over((ob) => ob.partitionBy("category_id").orderBy("price", "desc"))
    .as("rank"),
  // LAG/LEAD args go in the array; wrap literals in sql.lit()
  eb.fn.agg<number | null>("LAG", ["total_amount", sql.lit(1)])
    .over((ob) => ob.partitionBy("user_id").orderBy("created_at"))
    .as("prev_amount"),
])

// Windowed aggregates: .over() on sum/count/avg/min/max
.select((eb) => [
  eb.fn.sum<number>("total_amount").over((ob) => ob.orderBy("created_at")).as("running_total"),
  eb.fn.avg<number>("price").over().as("grand_avg"),               // empty OVER ()
  // .filterWhere() and .distinct() compose with .over()
  eb.fn.countAll<number>().filterWhere("status", "=", "completed")
    .over((ob) => ob.partitionBy("user_id")).as("completed_for_user"),
])
```

**Filtering on a window result** (e.g. `row_number = 1`) needs a CTE/subquery — windows are computed after `WHERE`, so rank in a CTE then filter the outer query.

**Window frames (`ROWS`/`RANGE BETWEEN`) require raw SQL.** Kysely's `OverBuilder` exposes only `partitionBy`/`orderBy` — there is no frame node in its AST at all (true through 0.28, 0.29, and `main`), and `.over()` rejects a raw `sql` argument. Frame support is the open feature request [kysely-org/kysely#505](https://github.com/kysely-org/kysely/issues/505). Write the frame as raw SQL but keep column refs typed via `eb.ref()`:

```typescript
// Only the function name + frame keywords are raw; columns stay validated.
sql<number>`avg(${eb.ref("total_amount")}) over (
  order by ${eb.ref("created_at")} rows between 2 preceding and current row
)`.as("moving_avg_3")
```

