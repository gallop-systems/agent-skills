/**
 * Set Operations (UNION / INTERSECT / EXCEPT)
 * Combine the rows of two compatible queries.
 *
 *   .union(q) / .unionAll(q)         -> UNION / UNION ALL
 *   .intersect(q) / .intersectAll(q) -> INTERSECT / INTERSECT ALL
 *   .except(q) / .exceptAll(q)       -> EXCEPT / EXCEPT ALL
 *
 * The plain forms remove duplicates; the *All forms keep them (and are cheaper).
 * Both sides must select the same number of columns with compatible types and
 * matching output names — align them with `as` aliases when they differ.
 */
import { db } from "./db";

// ============================================
// UNION — distinct rows from both queries
// ============================================

// Align column names with aliases so both branches produce the same shape.
const contacts = await db
  .selectFrom("user")
  .select(["id", "email as contact"])
  .union(db.selectFrom("supplier").select(["id", "contact_email as contact"]))
  .execute();
// SQL: select "id", "email" as "contact" from "user"
//      union select "id", "contact_email" as "contact" from "supplier"

// UNION ALL — keep duplicates (faster; no dedup pass)
const allEvents = await db
  .selectFrom("order")
  .select(["id", "created_at"])
  .unionAll(db.selectFrom("review").select(["id", "created_at"]))
  .execute();

// ============================================
// INTERSECT — rows present in BOTH queries
// ============================================

const usersWhoAreAlsoReviewers = await db
  .selectFrom("order")
  .select("user_id")
  .intersect(db.selectFrom("review").select("user_id"))
  .execute();

// INTERSECT ALL keeps duplicate matches
const repeated = await db
  .selectFrom("order")
  .select("user_id")
  .intersectAll(db.selectFrom("review").select("user_id"))
  .execute();

// ============================================
// EXCEPT — rows in the FIRST query but not the second
// ============================================

// Users who placed an order but never wrote a review.
const ordersWithoutReviews = await db
  .selectFrom("order")
  .select("user_id")
  .except(db.selectFrom("review").select("user_id"))
  .execute();

const ordersWithoutReviewsKeepDupes = await db
  .selectFrom("order")
  .select("user_id")
  .exceptAll(db.selectFrom("review").select("user_id"))
  .execute();

// ============================================
// ORDERING THE COMBINED RESULT
// ============================================

// orderBy/limit after a set op apply to the whole combined result.
const recentCombined = await db
  .selectFrom("order")
  .select(["id", "created_at"])
  .unionAll(db.selectFrom("review").select(["id", "created_at"]))
  .orderBy("created_at", "desc")
  .limit(20)
  .execute();

// ============================================
// KEY PATTERNS SUMMARY
// ============================================

/*
1. Both branches must select the same columns (count + compatible types) with
   matching output names — use `as` to line them up.

2. Plain forms dedupe; *All forms keep duplicates and skip the dedup pass.
   Reach for unionAll/intersectAll/exceptAll unless you actually need DISTINCT.

3. EXCEPT/INTERSECT are set-difference / set-intersection on whole rows.

4. orderBy/limit chained after the set op apply to the combined result, not the
   individual branches.
*/
