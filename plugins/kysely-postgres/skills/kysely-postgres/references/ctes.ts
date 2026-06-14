/**
 * CTE (Common Table Expression) Patterns
 * WITH clauses for complex multi-step queries
 */
import { db } from "./db";

// ============================================
// SIMPLE CTE
// ============================================

// Basic CTE - named subquery
const activeProducts = await db
  .with("active_products", (db) =>
    db
      .selectFrom("product")
      .select(["id", "name", "price"])
      .where("is_active", "=", true)
  )
  .selectFrom("active_products")
  .selectAll()
  .execute();

// ============================================
// CTE WITH AGGREGATION
// ============================================

// CTE for pre-aggregating data
const topSpenders = await db
  .with("order_totals", (db) =>
    db
      .selectFrom("order")
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

// ============================================
// MULTIPLE CTEs
// ============================================

// Chain CTEs for multi-step processing
const topRatedProducts = await db
  // First CTE: aggregate reviews
  .with("product_reviews", (db) =>
    db
      .selectFrom("review")
      .select((eb) => [
        "product_id",
        eb.fn.avg("rating").as("avgRating"),
        eb.fn.count("id").as("reviewCount"),
      ])
      .groupBy("product_id")
  )
  // Second CTE: join with products
  .with("top_products", (db) =>
    db
      .selectFrom("product")
      .leftJoin("product_reviews", "product_reviews.product_id", "product.id")
      .select([
        "product.name",
        "product.price",
        "product_reviews.avgRating",
        "product_reviews.reviewCount",
      ])
      .where("product.is_active", "=", true)
  )
  // Final query: select from last CTE
  .selectFrom("top_products")
  .selectAll()
  .orderBy("avgRating", (ob) => ob.desc().nullsLast())
  .execute();

// ============================================
// CTE USE CASES
// ============================================

// Use Case 1: Break down complex logic
const dashboardData = await db
  .with("monthly_orders", (db) =>
    db
      .selectFrom("order")
      .select((eb) => [
        eb.fn.count("id").as("orderCount"),
        eb.fn.sum("total_amount").as("revenue"),
      ])
      .where("status", "=", "completed")
  )
  .with("active_users", (db) =>
    db
      .selectFrom("user")
      .select((eb) => eb.fn.count("id").as("userCount"))
      .where("is_active", "=", true)
  )
  .selectFrom("monthly_orders")
  .innerJoin("active_users", (join) =>
    join.on((eb) => eb.lit(true)) // Cross join
  )
  .select([
    "monthly_orders.orderCount",
    "monthly_orders.revenue",
    "active_users.userCount",
  ])
  .executeTakeFirst();

// Use Case 2: Self-referencing/recursive (for hierarchies)
// Note: Recursive CTEs use withRecursive
const categoryHierarchy = await db
  .withRecursive("category_tree", (db) =>
    // Base case: root categories
    db
      .selectFrom("category")
      .select(["id", "name", "parent_id"])
      .where("parent_id", "is", null)
      .unionAll(
        // Recursive case: children
        db
          .selectFrom("category as c")
          .innerJoin("category_tree as ct", "ct.id", "c.parent_id")
          .select(["c.id", "c.name", "c.parent_id"])
      )
  )
  .selectFrom("category_tree")
  .selectAll()
  .execute();

// ============================================
// MATERIALIZED / NOT MATERIALIZED (PostgreSQL)
// ============================================

// PostgreSQL can inline a CTE into the outer query (so the planner optimizes
// across the boundary) or materialize it once into a temp result. Force either
// with a name-builder callback as the first arg to .with():
//   (cte) => cte("name").materialized()      -> WITH "name" AS MATERIALIZED (...)
//   (cte) => cte("name").notMaterialized()   -> WITH "name" AS NOT MATERIALIZED (...)

// MATERIALIZED: compute the CTE once and reuse it (good when it's expensive and
// referenced multiple times, or to deliberately create an optimization fence).
const expensiveOnce = await db
  .with(
    (cte) => cte("active_products").materialized(),
    (db) =>
      db
        .selectFrom("product")
        .select(["id", "name", "price"])
        .where("is_active", "=", true)
  )
  .selectFrom("active_products")
  .selectAll()
  .execute();
// SQL: with "active_products" as materialized (select ...) select * from ...

// NOT MATERIALIZED: let the planner inline it (often lets index conditions from
// the outer query push down into the CTE).
const inlined = await db
  .with(
    (cte) => cte("recent_orders").notMaterialized(),
    (db) =>
      db.selectFrom("order").select(["id", "user_id"]).where("status", "=", "pending")
  )
  .selectFrom("recent_orders")
  .selectAll()
  .execute();

// ============================================
// KEY PATTERNS SUMMARY
// ============================================

/*
1. Basic CTE syntax:
   db.with("name", (db) => db.selectFrom(...))
     .selectFrom("name")
     .selectAll()

2. Multiple CTEs - chain .with() calls:
   db.with("cte1", ...)
     .with("cte2", ...)  // Can reference cte1
     .selectFrom("cte2")

3. CTEs can reference earlier CTEs:
   - cte2 can use cte1 in its FROM
   - Order matters!

4. Recursive CTEs:
   - Use .withRecursive()
   - Base case UNION ALL recursive case
   - Recursive case joins to the CTE itself

5. MATERIALIZED / NOT MATERIALIZED (PostgreSQL):
   - First arg becomes a callback: (cte) => cte("name").materialized()
   - materialized(): compute once (expensive + reused, or optimization fence)
   - notMaterialized(): let the planner inline it (push predicates down)

6. When to use CTEs:
   - Complex multi-step aggregations
   - Reusing a subquery multiple times
   - Breaking down complex logic
   - Recursive/hierarchical data
   - Improving query readability
*/
