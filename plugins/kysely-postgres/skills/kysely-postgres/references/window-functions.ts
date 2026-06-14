/**
 * Window Functions
 * Ranking, value, and aggregate functions over OVER() windows.
 *
 * Two builders cover almost everything:
 *   - eb.fn.agg<T>("NAME", [args]).over(...)  for named window functions
 *     (ROW_NUMBER, RANK, LAG, ...) that have no dedicated helper
 *   - eb.fn.sum/count/avg/min/max(col).over(...)  for windowed aggregates
 *
 * The OVER() body is built with a callback: (ob) => ob.partitionBy(...).orderBy(...)
 * Call .over() with no callback for an empty OVER ().
 *
 * The one thing the builder CANNOT express is a frame clause
 * (ROWS/RANGE/GROUPS BETWEEN) — see WINDOW FRAMES below.
 */
import { db } from "./db";
import { sql } from "kysely";

// ============================================
// RANKING FUNCTIONS
// ============================================

// ROW_NUMBER / RANK / DENSE_RANK — use eb.fn.agg (no dedicated helper)
// Rank products by price within each category.
const rankedProducts = await db
  .selectFrom("product")
  .select((eb) => [
    "id",
    "name",
    "category_id",
    eb.fn
      .agg<number>("ROW_NUMBER")
      .over((ob) => ob.partitionBy("category_id").orderBy("price", "desc"))
      .as("row_num"),
    eb.fn
      .agg<number>("RANK")
      .over((ob) => ob.partitionBy("category_id").orderBy("price", "desc"))
      .as("price_rank"),
    eb.fn
      .agg<number>("DENSE_RANK")
      .over((ob) => ob.partitionBy("category_id").orderBy("price", "desc"))
      .as("dense_rank"),
  ])
  .execute();
// SQL: ROW_NUMBER() over(partition by "category_id" order by "price" desc) as "row_num"

// NTILE / PERCENT_RANK / CUME_DIST — NTILE takes an argument (use sql.lit)
const productBuckets = await db
  .selectFrom("product")
  .select((eb) => [
    "id",
    eb.fn
      .agg<number>("NTILE", [sql.lit(4)])
      .over((ob) => ob.orderBy("price", "desc"))
      .as("price_quartile"),
    eb.fn
      .agg<number>("PERCENT_RANK")
      .over((ob) => ob.orderBy("price", "desc"))
      .as("pct_rank"),
  ])
  .execute();
// SQL: NTILE(4) over(order by "price" desc) as "price_quartile"

// ============================================
// VALUE FUNCTIONS (LAG / LEAD / FIRST_VALUE / NTH_VALUE)
// ============================================

// LAG / LEAD — args: (column, offset?, default?). Wrap literals in sql.lit().
// Type the result yourself; nullable unless you supply a default.
const orderTrends = await db
  .selectFrom("order")
  .select((eb) => [
    "id",
    "created_at",
    "total_amount",
    eb.fn
      .agg<number | null>("LAG", ["total_amount", sql.lit(1)])
      .over((ob) => ob.partitionBy("user_id").orderBy("created_at"))
      .as("prev_amount"),
    eb.fn
      .agg<number | null>("LEAD", ["total_amount", sql.lit(1)])
      .over((ob) => ob.partitionBy("user_id").orderBy("created_at"))
      .as("next_amount"),
    // With a default value (no nulls): LAG(total_amount, 1, 0)
    eb.fn
      .agg<number>("LAG", ["total_amount", sql.lit(1), sql.lit(0)])
      .over((ob) => ob.partitionBy("user_id").orderBy("created_at"))
      .as("prev_amount_or_zero"),
  ])
  .execute();
// SQL: LAG("total_amount", 1, 0) over(partition by "user_id" order by "created_at") as "prev_amount_or_zero"

// FIRST_VALUE / NTH_VALUE
const categoryExtremes = await db
  .selectFrom("product")
  .select((eb) => [
    "id",
    "category_id",
    eb.fn
      .agg<number>("FIRST_VALUE", ["price"])
      .over((ob) => ob.partitionBy("category_id").orderBy("price", "desc"))
      .as("highest_in_category"),
    eb.fn
      .agg<number | null>("NTH_VALUE", ["price", sql.lit(2)])
      .over((ob) => ob.partitionBy("category_id").orderBy("price", "desc"))
      .as("second_highest"),
  ])
  .execute();

// ============================================
// AGGREGATE WINDOWS (sum/count/avg/min/max .over())
// ============================================

// Empty OVER () — aggregate over the whole result set, no collapsing of rows
const withGrandTotal = await db
  .selectFrom("order")
  .select((eb) => [
    "id",
    "total_amount",
    eb.fn.sum<number>("total_amount").over().as("grand_total"),
  ])
  .execute();
// SQL: sum("total_amount") over() as "grand_total"

// Running total — ORDER BY without a frame defaults to
// "RANGE UNBOUNDED PRECEDING -> CURRENT ROW" (cumulative)
const runningTotals = await db
  .selectFrom("order")
  .select((eb) => [
    "id",
    "created_at",
    "total_amount",
    eb.fn
      .sum<number>("total_amount")
      .over((ob) => ob.orderBy("created_at"))
      .as("running_total"),
  ])
  .execute();
// SQL: sum("total_amount") over(order by "created_at") as "running_total"

// Partition total + percent-of-partition (mix a window into a raw expression)
const sharePerCategory = await db
  .selectFrom("product")
  .select((eb) => [
    "id",
    "category_id",
    "price",
    eb.fn
      .sum<number>("price")
      .over((ob) => ob.partitionBy("category_id"))
      .as("category_total"),
    sql<number>`${eb.ref("price")} * 100.0 / ${eb.fn
      .sum("price")
      .over((ob) => ob.partitionBy("category_id"))}`.as("pct_of_category"),
  ])
  .execute();

// ============================================
// FILTER + DISTINCT IN WINDOWS (PostgreSQL)
// ============================================

// .filterWhere() composes with .over() — conditional windowed aggregation
const activeCounts = await db
  .selectFrom("order")
  .select((eb) => [
    "id",
    "user_id",
    eb.fn
      .countAll<number>()
      .filterWhere("status", "=", "completed")
      .over((ob) => ob.partitionBy("user_id"))
      .as("completed_orders_for_user"),
  ])
  .execute();
// SQL: count(*) filter(where "status" = $1) over(partition by "user_id")

// COUNT(DISTINCT ...) OVER (...)
const distinctStatuses = await db
  .selectFrom("order")
  .select((eb) => [
    "id",
    "user_id",
    eb.fn
      .count<number>("status")
      .distinct()
      .over((ob) => ob.partitionBy("user_id"))
      .as("distinct_statuses_for_user"),
  ])
  .execute();
// SQL: count(distinct "status") over(partition by "user_id")

// ============================================
// WINDOW FRAMES (ROWS/RANGE BETWEEN) — RAW SQL REQUIRED
// ============================================

// Kysely's OverBuilder exposes ONLY partitionBy + orderBy. There is no frame
// node in its AST at all (confirmed through 0.28, 0.29, and main), and
// .over() rejects a raw sql argument. Frame support is the open feature
// request kysely-org/kysely#505. So a frame clause must be written as raw SQL.
//
// You do NOT lose all type safety: interpolate eb.ref() for columns (validated)
// and sql.lit() for bounds, and type the result with sql<T>. Only the function
// name and the frame keywords are raw text.

// Moving average over the last 3 rows
const movingAverage = await db
  .selectFrom("order")
  .select((eb) => [
    "id",
    "created_at",
    "total_amount",
    sql<number>`avg(${eb.ref("total_amount")}) over (
      order by ${eb.ref("created_at")}
      rows between 2 preceding and current row
    )`.as("moving_avg_3"),
  ])
  .execute();
// SQL: avg("total_amount") over ( order by "created_at" rows between 2 preceding and current row )

// Cumulative sum with an explicit frame
const cumulative = await db
  .selectFrom("order")
  .select((eb) => [
    "id",
    sql<number>`sum(${eb.ref("total_amount")}) over (
      partition by ${eb.ref("user_id")}
      order by ${eb.ref("created_at")}
      rows between unbounded preceding and current row
    )`.as("cumulative_sum"),
  ])
  .execute();

// ============================================
// COMMON PATTERNS
// ============================================

// Top-N per group: rank in a CTE, then filter in the outer query.
// (You can't filter on a window alias in the same SELECT's WHERE — windows are
// computed after WHERE — so the CTE/subquery wrapper is required.)
const top3ProductsPerCategory = await db
  .with("ranked", (db) =>
    db
      .selectFrom("product")
      .select((eb) => [
        "id",
        "name",
        "category_id",
        "price",
        eb.fn
          .agg<number>("ROW_NUMBER")
          .over((ob) => ob.partitionBy("category_id").orderBy("price", "desc"))
          .as("rn"),
      ])
  )
  .selectFrom("ranked")
  .selectAll()
  .where("rn", "<=", 3)
  .execute();

// Percent of total (empty OVER () as the denominator)
const pctOfTotal = await db
  .selectFrom("product")
  .select((eb) => [
    "id",
    "price",
    sql<number>`round(${eb.ref("price")} * 100.0 / ${eb.fn
      .sum("price")
      .over()}, 2)`.as("pct_of_total"),
  ])
  .execute();

// ============================================
// KEY PATTERNS SUMMARY
// ============================================

/*
1. Named window functions: eb.fn.agg<T>("ROW_NUMBER").over((ob) => ...)
   - ROW_NUMBER, RANK, DENSE_RANK, NTILE, PERCENT_RANK, CUME_DIST
   - LAG, LEAD, FIRST_VALUE, LAST_VALUE, NTH_VALUE
   - Function arguments go in the array; wrap literals in sql.lit().

2. Windowed aggregates: eb.fn.sum/count/avg/min/max(col).over((ob) => ...)
   - .over() with no callback => OVER () over the whole result set.
   - .filterWhere(...) and .distinct() compose with .over().

3. OVER body: (ob) => ob.partitionBy(col | [cols]).orderBy(col, "desc")

4. Frames (ROWS/RANGE BETWEEN) are NOT supported by the builder (issue #505).
   Write the window as raw sql, keeping eb.ref() for columns and sql<T> for the
   result type. Only the function name + frame keywords are raw.

5. Filtering on a window result (e.g. row_number = 1) needs a CTE/subquery:
   windows are computed after WHERE, so wrap and filter in the outer query.
*/
