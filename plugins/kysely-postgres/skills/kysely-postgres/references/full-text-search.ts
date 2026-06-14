/**
 * Full-Text Search (PostgreSQL)
 * tsvector / tsquery matching with the @@ operator.
 *
 * Kysely has no dedicated FTS helpers, but @@ IS in its operator allowlist, so
 * you build the document (to_tsvector / a tsvector column) and the query
 * (to_tsquery family) with sql`` fragments and let @@ stay a typed operator.
 * Keep columns type-checked via sql.ref(); only the FTS functions are raw.
 *
 * tsquery builders:
 *   to_tsquery        - operator syntax: 'cat & dog', 'cat | dog', 'cat & !dog'
 *   plainto_tsquery   - plain words, ANDed together (user-friendly)
 *   websearch_to_tsquery - Google-style: quotes for phrases, - to exclude
 */
import { db } from "./db";
import { sql } from "kysely";

// ============================================
// MATCH ON A COMPUTED tsvector
// ============================================

// to_tsvector(...) @@ to_tsquery(...). @@ stays a real operator, so the LHS and
// RHS are the only raw parts; the column ref is validated by sql.ref().
const matches = await db
  .selectFrom("document")
  .selectAll()
  .where(
    sql`to_tsvector('english', ${sql.ref("body")})`,
    "@@",
    sql`to_tsquery('english', ${sql.lit("cat & dog")})`
  )
  .execute();
// SQL: where to_tsvector('english', "body") @@ to_tsquery('english', 'cat & dog')

// plainto_tsquery — turn free-text user input into an ANDed query safely
const userSearch = async (term: string) =>
  db
    .selectFrom("document")
    .selectAll()
    .where(
      sql`to_tsvector('english', ${sql.ref("body")})`,
      "@@",
      sql`plainto_tsquery('english', ${term})`
    )
    .execute();

// websearch_to_tsquery — Google-style syntax ("phrase", -exclude, OR)
const webSearch = async (term: string) =>
  db
    .selectFrom("document")
    .selectAll()
    .where(
      sql`to_tsvector('english', ${sql.ref("body")})`,
      "@@",
      sql`websearch_to_tsquery('english', ${term})`
    )
    .execute();

// ============================================
// MATCH ON A STORED tsvector COLUMN (preferred)
// ============================================

// Production setups store a tsvector column (often a GENERATED column with a
// GIN index) instead of computing to_tsvector at query time. Then @@ works
// directly against the column name — fully typed on the left.
const fastMatches = await db
  .selectFrom("document")
  .selectAll()
  .where("search_vector", "@@", sql`to_tsquery('english', ${sql.lit("cat")})`)
  .execute();
// SQL: where "search_vector" @@ to_tsquery('english', 'cat')

// ============================================
// RELEVANCE RANKING (ts_rank)
// ============================================

// ts_rank has no helper — use sql<number> and order by the alias.
const ranked = await db
  .selectFrom("document")
  .select((eb) => [
    "id",
    "title",
    sql<number>`ts_rank(${eb.ref(
      "search_vector"
    )}, websearch_to_tsquery('english', ${"cat dog"}))`.as("rank"),
  ])
  .where(
    "search_vector",
    "@@",
    sql`websearch_to_tsquery('english', ${"cat dog"})`
  )
  .orderBy("rank", "desc")
  .limit(20)
  .execute();

// ============================================
// KEY PATTERNS SUMMARY
// ============================================

/*
1. @@ is a real Kysely operator — keep it as the operator and put the FTS
   functions on either side as sql`` fragments. Don't wrap the whole predicate.

2. Validate columns with sql.ref(); a stored tsvector column can be the typed
   LHS directly (where("search_vector", "@@", ...)).

3. Query builders by input source:
   - to_tsquery: you control operator syntax (& | !).
   - plainto_tsquery: untrusted plain words, ANDed.
   - websearch_to_tsquery: Google-style user input.

4. Rank with ts_rank/ts_rank_cd via sql<number>, then orderBy the alias.
   For performance, store a tsvector column with a GIN index rather than
   computing to_tsvector() per query.
*/
