/**
 * Mutation Patterns
 * INSERT, UPDATE, DELETE, UPSERT
 */
import { db } from "./db";
import { sql } from "kysely";

// ============================================
// INSERT
// ============================================

// Basic insert with RETURNING
const newCategory = await db
  .insertInto("category")
  .values({ name: "New Category", sort_order: 99 })
  .returning(["id", "name"])
  .executeTakeFirst();

// Insert multiple rows
const newCategories = await db
  .insertInto("category")
  .values([
    { name: "Category A", sort_order: 100 },
    { name: "Category B", sort_order: 101 },
  ])
  .returning(["id", "name"])
  .execute();

// ============================================
// UPSERT (ON CONFLICT)
// ============================================

// Insert or update if conflict
const upsertedProduct = await db
  .insertInto("product")
  .values({
    name: "Upsert Product",
    sku: "UPSERT-001",
    price: "99.99",
    stock_quantity: 10,
  })
  .onConflict((oc) =>
    oc.column("sku").doUpdateSet((eb) => ({
      // Update these columns on conflict - type-safe!
      stock_quantity: eb("product.stock_quantity", "+", eb.ref("excluded.stock_quantity")),
      // Prefer typed builders over raw sql here too: eb.fn.coalesce(...) over both
      // tables validates names against the schema (excluded is a real virtual table)
      name: eb.fn.coalesce(eb.ref("product.name"), eb.ref("excluded.name")),
    }))
  )
  .returning(["id", "sku", "stock_quantity"])
  .executeTakeFirst();

// GOTCHA: when you DO need raw sql in a SET / doUpdateSet value (e.g. now()),
// do NOT parameterize it with a codegen ColumnType marker like the generated
// `Timestamp` (= ColumnType<Date, ...>). It breaks compilation:
//   updated_at: sql<Timestamp>`now()`   // ❌ TS2345: RawBuilder<Timestamp> not
//                                        //    assignable; "isSelectQueryBuilder" missing
// The SET target is the flattened Updateable value type (e.g. string | Date | undefined),
// and RawBuilder<ColumnType<...>> falls outside that plain-value branch. Use a plain
// value type or leave it bare instead:
//   updated_at: sql<Date>`now()`        // ✅ Date is a plain value type
//   updated_at: sql`now()`              // ✅ also assigns cleanly
// (The "always type your sql literals" rule is aimed at SELECT, where the type flows
// into the result. In write contexts, ColumnType markers are the wrong parameter.)

// OnConflict variations:
// - oc.column("col") - single column constraint
// - oc.columns(["col1", "col2"]) - composite constraint
// - oc.constraint("constraint_name") - named constraint
// - oc.doNothing() - ignore conflicts
// - oc.doUpdateSet({...}) - update on conflict

// Upsert with doNothing
await db
  .insertInto("user")
  .values({ email: "exists@example.com", first_name: "Test", last_name: "User" })
  .onConflict((oc) => oc.column("email").doNothing())
  .execute();

// ============================================
// UPDATE
// ============================================

// Basic update
const updatedCategory = await db
  .updateTable("category")
  .set({ sort_order: 999 })
  .where("name", "=", "New Category")
  .returning(["id", "name", "sort_order"])
  .executeTakeFirst();

// Update with expression (increment)
const updatedStock = await db
  .updateTable("product")
  .set((eb) => ({
    stock_quantity: eb("stock_quantity", "+", 5),
  }))
  .where("sku", "=", "UPSERT-001")
  .returning(["id", "sku", "stock_quantity"])
  .executeTakeFirst();

// Update multiple columns with expressions
await db
  .updateTable("product")
  .set((eb) => ({
    stock_quantity: eb("stock_quantity", "-", 1),
    price: eb("price", "*", eb.lit(1.1)), // 10% increase
  }))
  .where("id", "=", 1)
  .execute();

// ============================================
// DELETE
// ============================================

// Delete with RETURNING
const deleted = await db
  .deleteFrom("category")
  .where("name", "like", "Category%")
  .returning(["id", "name"])
  .execute();

// Delete with subquery
await db
  .deleteFrom("order_item")
  .where(
    "order_id",
    "in",
    db.selectFrom("order").select("id").where("status", "=", "cancelled")
  )
  .execute();

// ============================================
// INSERT FROM SELECT
// ============================================

// Insert rows from another query
const auditLogs = await db
  .insertInto("inventory_log")
  .columns(["product_id", "change_quantity", "reason"])
  .expression(
    db
      .selectFrom("product")
      .select([
        "id as product_id",
        sql`0`.as("change_quantity"),
        sql`'Audit check'`.as("reason"),
      ])
      .where("is_active", "=", true)
      .limit(10)
  )
  .returning(["id", "product_id", "reason"])
  .execute();

// ============================================
// UNION
// ============================================

// Combine results from multiple queries
const contacts = await db
  .selectFrom("user")
  .select(["email as contact", sql`'email'`.as("type")])
  .where("role", "=", "admin")
  .union(
    db
      .selectFrom("user")
      .select(["email as contact", sql`'email'`.as("type")])
      .where("role", "=", "manager")
  )
  .execute();

// unionAll - includes duplicates
// intersect - rows in both queries
// except - rows in first but not second

// ============================================
// KEY PATTERNS SUMMARY
// ============================================

/*
1. INSERT:
   .insertInto("table")
   .values({...}) or .values([...])
   .returning([...])
   .execute() or .executeTakeFirst()

2. UPSERT (ON CONFLICT) - type-safe with eb callback:
   .onConflict((oc) => oc.column("col").doUpdateSet((eb) => ({
     col: eb("table.col", "+", eb.ref("excluded.col")),
   })))
   - eb.ref("excluded.col") for inserted values
   - eb("table.col", ...) for existing values (type-safe!)

3. UPDATE:
   .updateTable("table")
   .set({...}) or .set((eb) => ({...}))
   .where(...)
   - Use eb(col, op, value) for expressions

4. DELETE:
   .deleteFrom("table")
   .where(...)
   .returning([...]) - optional

5. INSERT FROM SELECT:
   .insertInto("table")
   .columns([...])
   .expression(db.selectFrom(...))

6. RETURNING:
   - Available on INSERT, UPDATE, DELETE
   - Returns affected rows
   - Use with executeTakeFirst() for single row
*/
