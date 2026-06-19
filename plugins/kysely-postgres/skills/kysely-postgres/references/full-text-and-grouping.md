## Full-Text Search (PostgreSQL)

`@@` is a real Kysely operator — keep it as the operator and put the FTS functions on each side as `sql` fragments. See [full-text-search.ts](references/full-text-search.ts).

```typescript
db.selectFrom("document").selectAll()
  .where(
    sql`to_tsvector('english', ${sql.ref("body")})`,
    "@@",
    sql`websearch_to_tsquery('english', ${userInput})`,
  )
  .execute();
// A stored tsvector column can be the typed LHS directly:
// .where("search_vector", "@@", sql`plainto_tsquery('english', ${userInput})`)
```

## Advanced Grouping (ROLLUP / CUBE / GROUPING SETS)

No builder exists — pass the grouping spec to `.groupBy()` as a `sql` fragment; the SELECT list stays typed. See [aggregations.ts](references/aggregations.ts).

```typescript
.groupBy(sql`rollup("status")`)                              // hierarchical subtotals
.groupBy(sql`cube("order_id", "product_id")`)               // all combinations
.groupBy(sql`grouping sets (("status"), ("user_id"), ())`)  // explicit sets
```

