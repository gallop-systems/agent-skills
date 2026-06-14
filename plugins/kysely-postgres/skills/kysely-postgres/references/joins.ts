/**
 * JOIN Patterns
 * Simple joins, multi-table joins, and complex callback joins
 */
import { db } from "./db";
import { sql } from "kysely";

// ============================================
// BASIC JOINS
// ============================================

// Inner join - simple format
const ordersWithUsers = await db
  .selectFrom("order")
  .innerJoin("user", "user.id", "order.user_id")
  .select([
    "order.id as orderId",
    "order.status",
    "user.email",
    "user.first_name",
  ])
  .execute();

// Left join - includes rows without matches
const productsWithCategories = await db
  .selectFrom("product")
  .leftJoin("category", "category.id", "product.category_id")
  .select([
    "product.name as productName",
    "category.name as categoryName", // null if no category
  ])
  .execute();

// Multiple joins - chain them
const orderDetails = await db
  .selectFrom("order_item")
  .innerJoin("order", "order.id", "order_item.order_id")
  .innerJoin("product", "product.id", "order_item.product_id")
  .innerJoin("user", "user.id", "order.user_id")
  .select([
    "user.email",
    "product.name as productName",
    "order_item.quantity",
    "order_item.unit_price",
  ])
  .execute();

// Self-join with aliases
const categoriesWithParent = await db
  .selectFrom("category as c")
  .leftJoin("category as parent", "parent.id", "c.parent_id")
  .select([
    "c.name as categoryName",
    "parent.name as parentCategoryName",
  ])
  .execute();

// ============================================
// COMPLEX JOINS (Callback Format)
// ============================================

// When to use callback format:
// 1. Multiple join conditions (composite keys)
// 2. Mixed column-to-column AND column-to-literal
// 3. OR conditions in joins
// 4. Subquery joins (derived tables)

// Multi-condition join: onRef + on
// onRef = column-to-column, on = column-to-literal
const activeProductItems = await db
  .selectFrom("order_item as oi")
  .innerJoin("product as p", (join) =>
    join
      .onRef("p.id", "=", "oi.product_id")
      .on("p.is_active", "=", true) // Filter in join, not WHERE
  )
  .select([
    "oi.id as orderItemId",
    "p.name as productName",
    "oi.quantity",
  ])
  .execute();

// Join with OR conditions
const usersWithCompletedOrShipped = await db
  .selectFrom("user as u")
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
  .select([
    "u.email",
    "o.id as orderId",
    "o.status",
  ])
  .execute();

// ============================================
// SUBQUERY JOINS (Derived Tables)
// ============================================

// Two-callback format: first builds subquery, second defines join
const usersWithOrderStats = await db
  .selectFrom("user as u")
  .leftJoin(
    // First callback: build the subquery
    (eb) =>
      eb
        .selectFrom("order")
        .select((eb) => [
          "user_id",
          eb.fn.count("id").as("order_count"),
          eb.fn.sum("total_amount").as("total_spent"),
        ])
        .groupBy("user_id")
        .as("order_stats"), // MUST have alias!
    // Second callback: define join condition
    (join) => join.onRef("order_stats.user_id", "=", "u.id")
  )
  .select([
    "u.email",
    "u.first_name",
    "order_stats.order_count",
    "order_stats.total_spent",
  ])
  .execute();

// Subquery join with MAX aggregation
const productsWithLatestReview = await db
  .selectFrom("product as p")
  .leftJoin(
    (eb) =>
      eb
        .selectFrom("review")
        .select((eb) => [
          "product_id",
          eb.fn.max("created_at").as("latest_review_at"),
          eb.fn.count("id").as("review_count"),
        ])
        .groupBy("product_id")
        .as("review_stats"),
    (join) => join.onRef("review_stats.product_id", "=", "p.id")
  )
  .select([
    "p.name",
    "p.price",
    "review_stats.latest_review_at",
    "review_stats.review_count",
  ])
  .orderBy("review_stats.review_count", (ob) => ob.desc().nullsLast())
  .execute();

// ============================================
// CROSS JOIN
// ============================================

// Cross join using always-true condition
// Use case: Join CTE aggregation to main query
const usersWithSummary = await db
  .with("summary", (db) =>
    db
      .selectFrom("order")
      .select((eb) => [
        eb.fn.count("id").as("total_orders"),
        eb.fn.sum("total_amount").as("total_revenue"),
      ])
  )
  .selectFrom("user as u")
  .leftJoin("summary", (join) =>
    join.on(sql`true`, "=", sql`true`)
  )
  .select([
    "u.email",
    "summary.total_orders",
    "summary.total_revenue",
  ])
  .where("u.role", "=", "admin")
  .execute();

// ============================================
// LATERAL JOINS (PostgreSQL)
// ============================================

// A LATERAL subquery can reference columns from earlier tables in the FROM
// clause via whereRef — the subquery runs once per outer row. Use the
// *Lateral methods + join.onTrue() (the join condition lives inside the
// subquery, so the ON is just "true").

// Top-N-per-group with a per-row LIMIT — the classic LATERAL use case.
// Get each user's 3 most recent orders.
const usersWithRecentOrders = await db
  .selectFrom("user as u")
  .innerJoinLateral(
    (eb) =>
      eb
        .selectFrom("order as o")
        .select(["o.id", "o.total_amount", "o.created_at"])
        .whereRef("o.user_id", "=", "u.id") // references the outer row
        .orderBy("o.created_at", "desc")
        .limit(3)
        .as("recent"),
    (join) => join.onTrue()
  )
  .select(["u.email", "recent.id", "recent.total_amount", "recent.created_at"])
  .execute();
// SQL: from "user" as "u" inner join lateral (... where "o"."user_id" = "u"."id"
//      order by "o"."created_at" desc limit $1) as "recent" on true

// leftJoinLateral keeps outer rows even when the subquery returns nothing.
const usersWithMaybeOrder = await db
  .selectFrom("user as u")
  .leftJoinLateral(
    (eb) =>
      eb
        .selectFrom("order as o")
        .select(["o.id", "o.total_amount"])
        .whereRef("o.user_id", "=", "u.id")
        .orderBy("o.created_at", "desc")
        .limit(1)
        .as("latest"),
    (join) => join.onTrue()
  )
  .select(["u.email", "latest.id", "latest.total_amount"]) // null if no orders
  .execute();
// crossJoinLateral also exists (no ON clause at all).

// ============================================
// KEY PATTERNS SUMMARY
// ============================================

/*
1. Simple joins: .innerJoin("table", "a.col", "b.col")
   - Use when joining on single column equality

2. Callback joins: .innerJoin("table", (join) => join.onRef(...).on(...))
   - onRef(col1, op, col2): column-to-column
   - on(col, op, value): column-to-literal
   - on((eb) => eb.or([...])): OR conditions

3. Subquery joins: Two callbacks
   - First: (eb) => eb.selectFrom(...).as("alias")
   - Second: (join) => join.onRef(...)
   - ALWAYS include .as("alias") on subquery!

4. Cross joins: join.on(sql`true`, "=", sql`true`)
   - For joining unrelated data (like CTE summaries)

5. Lateral joins: .innerJoinLateral((eb) => eb...whereRef(outer).as("x"),
   (join) => join.onTrue())
   - Subquery can reference outer rows; runs per row.
   - Best tool for top-N-per-group with a per-row LIMIT.
*/
