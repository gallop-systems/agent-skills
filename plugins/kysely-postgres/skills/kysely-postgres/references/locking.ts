/**
 * Row Locking (SELECT ... FOR ...)
 * Pessimistic locks for read-modify-write and job-queue patterns.
 *
 * Lock strength (weakest -> strongest):
 *   .forKeyShare()      -> FOR KEY SHARE
 *   .forShare()         -> FOR SHARE
 *   .forNoKeyUpdate()   -> FOR NO KEY UPDATE
 *   .forUpdate()        -> FOR UPDATE
 *
 * Wait behavior (chain after a lock):
 *   .skipLocked()       -> SKIP LOCKED   (ignore already-locked rows)
 *   .noWait()           -> NOWAIT        (error instead of blocking)
 */
import { db } from "./db";

// ============================================
// BASIC LOCKS
// ============================================

// FOR UPDATE — lock the selected rows until the transaction ends.
// Run inside a transaction; the lock is released on commit/rollback.
const lockedOrder = await db
  .selectFrom("order")
  .selectAll()
  .where("id", "=", 1)
  .forUpdate()
  .executeTakeFirst();
// SQL: select * from "order" where "id" = $1 for update

// FOR SHARE — allow concurrent reads-with-lock, block writers.
const sharedRow = await db
  .selectFrom("product")
  .selectAll()
  .where("id", "=", 1)
  .forShare()
  .executeTakeFirst();

// ============================================
// JOB QUEUE: FOR UPDATE SKIP LOCKED
// ============================================

// The canonical worker pattern: each worker grabs the next available job and
// SKIP LOCKED steps over rows other workers already hold — no blocking, no
// double-processing. Pair with a RETURNING update or do the work in the same tx.
const nextJobs = await db
  .selectFrom("job")
  .selectAll()
  .where("status", "=", "pending")
  .orderBy("created_at")
  .limit(10)
  .forUpdate()
  .skipLocked()
  .execute();
// SQL: ... for update skip locked

// NOWAIT — fail fast instead of waiting for a contended lock
const grabOrFail = await db
  .selectFrom("order")
  .selectAll()
  .where("id", "=", 1)
  .forUpdate()
  .noWait()
  .executeTakeFirst();
// SQL: ... for update nowait

// ============================================
// WEAKER UPDATE LOCKS
// ============================================

// FOR NO KEY UPDATE — like FOR UPDATE but doesn't block FK reference inserts.
// FOR KEY SHARE — weakest; blocks only key-changing updates/deletes.
const noKeyLock = await db
  .selectFrom("user")
  .selectAll()
  .where("id", "=", 1)
  .forNoKeyUpdate()
  .executeTakeFirst();

// ============================================
// KEY PATTERNS SUMMARY
// ============================================

/*
1. Always lock inside a transaction — locks release at commit/rollback.

2. Job queue: .forUpdate().skipLocked() with .limit() + ORDER BY.
   Workers never block each other and never grab the same row.

3. .noWait() throws on contention; .skipLocked() silently skips — pick per use.

4. Lock strength: forKeyShare < forShare < forNoKeyUpdate < forUpdate.
   Prefer the weakest lock that still prevents your race.
*/
