## Query Patterns

### Basic SELECT

```typescript
// Select all columns
const users = await db.selectFrom("user").selectAll().execute();

// Select specific columns with aliases
const users = await db
  .selectFrom("user")
  .select(["id", "email", "first_name as firstName"])
  .execute();

// Single row (returns T | undefined)
const user = await db.selectFrom("user").selectAll()
  .where("id", "=", userId).executeTakeFirst();

// Single row that must exist (throws if not found)
const user = await db.selectFrom("user").selectAll()
  .where("id", "=", userId).executeTakeFirstOrThrow();
```

### WHERE Clauses

```typescript
// Equality, comparison, IN, LIKE
.where("status", "=", "active")
.where("price", ">", 100)
.where("role", "in", ["admin", "manager"])
.where("name", "like", "%search%")
.where("deleted_at", "is", null)

// BETWEEN - use eb.between(), NOT the "between" operator (see Pitfall #8)
.where((eb) => eb.between("age", 18, 65))

// Multiple conditions (chained = AND)
.where("is_active", "=", true)
.where("role", "=", "admin")

// OR conditions
.where((eb) => eb.or([
  eb("role", "=", "admin"),
  eb("role", "=", "manager"),
]))

// Complex AND/OR
.where((eb) => eb.and([
  eb("is_active", "=", true),
  eb.or([
    eb("price", "<", 50),
    eb("stock", ">", 100),
  ]),
]))
```

### JOINs

```typescript
// Inner join
.innerJoin("order", "order.user_id", "user.id")

// Left join
.leftJoin("category", "category.id", "product.category_id")

// Self-join with alias
.selectFrom("category as c")
.leftJoin("category as parent", "parent.id", "c.parent_id")

// Multiple joins
.innerJoin("order", "order.id", "order_item.order_id")
.innerJoin("product", "product.id", "order_item.product_id")
.innerJoin("user", "user.id", "order.user_id")
```

### Complex JOINs (Callback Format)

Use the callback format when you need:
- Multiple join conditions (composite keys)
- Mixed column-to-column and column-to-literal comparisons
- OR conditions within joins
- Subquery joins (derived tables)

**Join Builder Methods:**
- `onRef(col1, op, col2)` - Column-to-column comparison
- `on(col, op, value)` - Column-to-literal comparison
- `on((eb) => ...)` - Complex expressions with OR logic

```typescript
// Multi-condition join (composite key + filter)
.leftJoin("invoice as i", (join) =>
  join
    .onRef("sp.service_provider_id", "=", "i.service_provider_id")
    .onRef("sp.year", "=", "i.year")
    .onRef("sp.month", "=", "i.month")
    .on("i.status", "!=", "invalidated")
)

// Join with OR conditions
.leftJoin("order as o", (join) =>
  join
    .onRef("o.user_id", "=", "u.id")
    .on((eb) =>
      eb.or([
        eb("o.status", "=", "completed"),
        eb("o.status", "=", "shipped"),
      ])
    )
)

// Subquery join (derived table) - two callbacks
.leftJoin(
  (eb) =>
    eb
      .selectFrom("order")
      .select((eb) => [
        "user_id",
        eb.fn.count("id").as("order_count"),
        eb.fn.max("created_at").as("last_order_at"),
      ])
      .groupBy("user_id")
      .as("order_stats"),  // MUST have alias!
  (join) => join.onRef("order_stats.user_id", "=", "u.id")
)

// Cross join (always-true condition) - for joining aggregated CTEs
.leftJoin("summary_cte", (join) =>
  join.on(sql`true`, "=", sql`true`)
)
```

### Aggregations

```typescript
.select((eb) => [
  "status",
  eb.fn.count("id").as("count"),
  eb.fn.sum("total_amount").as("totalAmount"),
  eb.fn.avg("total_amount").as("avgAmount"),
])
.groupBy("status")
.having((eb) => eb.fn.count("id"), ">", 5)
```

#### FILTER (WHERE ...) on Aggregates

PostgreSQL's `FILTER (WHERE ...)` clause is available on **all** aggregate function builders via `.filterWhere()`:

```typescript
.select((eb) => [
  eb.fn.count("id").filterWhere("status", "=", "active").as("active_count"),
  eb.fn.countAll().filterWhere("role", "!=", "banned").as("non_banned"),
  eb.fn.sum("amount").filterWhere("type", "=", "credit").as("total_credits"),
])

// Also works as the first argument to .having()
.having(
  (eb) => eb.fn.countAll().filterWhere("status", "!=", "signed"),
  "=",
  0
)
```

### ORDER BY

```typescript
// Simple ordering
.orderBy("created_at", "desc")
.orderBy("name", "asc")

// NULLS FIRST / NULLS LAST - use order builder callback
.orderBy("category_id", (ob) => ob.asc().nullsLast())
.orderBy("priority", (ob) => ob.desc().nullsFirst())

// Multiple columns - chain orderBy calls (array syntax is deprecated)
.orderBy("category_id", "asc")
.orderBy("price", "desc")
.orderBy("name", "asc")
```

### CTEs (Common Table Expressions)

Use CTEs for complex queries with multiple aggregation levels:

```typescript
const result = await db
  .with("order_totals", (db) =>
    db.selectFrom("order")
      .innerJoin("user", "user.id", "order.user_id")
      .select((eb) => [
        "user.id as userId",
        "user.email",
        eb.fn.sum("order.total_amount").as("totalSpent"),
        eb.fn.count("order.id").as("orderCount"),
      ])
      .groupBy(["user.id", "user.email"])
  )
  .selectFrom("order_totals")
  .selectAll()
  .orderBy("totalSpent", "desc")
  .execute();
```

### JSON Aggregation (PostgreSQL)

```typescript
import { jsonBuildObject } from "kysely/helpers/postgres";
// Note: jsonAgg is accessed via eb.fn.jsonAgg(), not imported

.with("tasks", (db) =>
  db.selectFrom("task")
    .leftJoin("user", "user.id", "task.assignee_id")
    .select((eb) => [
      "task.job_id",
      eb.fn.jsonAgg(
        jsonBuildObject({
          id: eb.ref("task.id"),
          status: eb.ref("task.status"),
          assignee: jsonBuildObject({
            id: eb.ref("user.id"),
            name: eb.fn<string>("concat", [
              eb.ref("user.first_name"),
              eb.cast(eb.val(" "), "text"),
              eb.ref("user.last_name"),
            ]),
          }),
        })
      )
      .filterWhere("task.id", "is not", null) // Filter nulls from left join
      .as("tasks"),
    ])
    .groupBy("task.job_id")
)
```

