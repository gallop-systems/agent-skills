## Concurrency and Transactions

PostgreSQL's default isolation is READ COMMITTED: every statement sees the rows
committed before *it* started, and a `SELECT` takes no lock that stops another
transaction from changing what you just read. So any code shaped "read, decide
in TypeScript, then write" is a race unless something serializes it. This is the
single most common bug class in reviewed Kysely code. Pick one of the tools below
for every read-then-write; "it is inside a transaction" is not one of them.

### 1. Check-then-insert: let a unique constraint decide

```typescript
// WRONG - two requests both see "no row" and both insert (or one 500s on 23505)
const existing = await db.selectFrom("user").select("id")
  .where("email", "=", email).executeTakeFirst();
if (!existing) await db.insertInto("user").values({ email }).execute();

// RIGHT - unique index + ON CONFLICT; the database arbitrates
const row = await db.insertInto("user").values({ email })
  .onConflict((oc) => oc.column("email").doNothing())
  .returning("id")
  .executeTakeFirst();          // undefined => someone else inserted it first
```

A row that must be unique needs a unique index (partial if it is "one *active*
row per X": `.where(...)` on `createIndex`). If the identity can be matched by more
than one key (an external id *or* an email), check every key before inserting, or
the insert trips the other key's unique index.

On upsert, `doUpdateSet` overwrites with whatever you send. When the incoming
source can be missing a value, keep the stored one instead of clearing it:
`phone: (eb) => eb.fn.coalesce(eb.ref("excluded.phone"), eb.ref("user.phone"))`.

### 2. Guard the write itself, not just the earlier read

Put the eligibility predicate in the `UPDATE`'s `WHERE` and check how many rows
changed. The row is re-evaluated under its row lock, so a concurrent change is seen.

```typescript
// WRONG - status was 'pending' when we selected it; maybe not any more
await db.updateTable("invoice").set({ status: "sent" }).where("id", "=", id).execute();

// RIGHT - conditional update; 0 rows means we lost the race
const res = await db.updateTable("invoice").set({ status: "sent", sent_at: new Date() })
  .where("id", "=", id).where("status", "=", "pending")
  .executeTakeFirst();
if (res.numUpdatedRows === 0n) throw new ConflictError();
```

The same applies to "never overwrite a final value": write
`ended_on: (eb) => eb.fn.coalesce("ended_on", eb.val(today))`, or filter
`.where("ended_on", "is", null)`, rather than setting it unconditionally.

### 3. When the decision spans rows: lock, then re-read

Invariants such as "at least one admin remains", "total allocated ≤ budget" or
"no overlapping booking" cannot be expressed as one conditional update. Lock a
row that every competing writer must also lock (usually the parent), then read
the state you decide on **after** the lock, inside the same transaction:

```typescript
await db.transaction().execute(async (trx) => {
  await trx.selectFrom("org").select("id").where("id", "=", orgId).forUpdate().execute();
  // read AFTER the lock - a snapshot taken before it is stale
  const admins = await trx.selectFrom("membership").select("user_id")
    .where("org_id", "=", orgId).where("role", "=", "admin")
    .where("deactivated_at", "is", null)
    .execute();
  if (admins.length <= 1) throw new ConflictError();
  await trx.updateTable("membership").set({ role: "member" })
    .where("org_id", "=", orgId).where("user_id", "=", userId).execute();
});
```

Rules that make the lock actually work:

- **Every write path takes the same lock**: create, update, delete, imports,
  background jobs, and any insert of a child row that references the locked
  resource. A lock that one path skips serializes nothing.
- **When there is no natural row to lock**, use a transaction-scoped advisory
  lock on a stable bigint key, again in every path. It is released at
  commit/rollback:
  ```typescript
  await trx.selectNoFrom((eb) => eb.fn("pg_advisory_xact_lock", [eb.val(key)]).as("locked")).execute();
  ```
- **With a join, lock only the intended table**: `.forUpdate()` alone emits
  `FOR UPDATE`, which locks matching rows of *every* joined table. Pass the
  table: `.forUpdate("order")` emits `for update of "order"`.
- **Lock several rows in a stable order** (`.orderBy("id")` on the locking
  select, or sort ids before locking one by one); two batches locking the same
  rows in different orders deadlock.
- **No slow external calls while holding locks** (HTTP, file downloads, LLM
  calls). Fetch first, then open the transaction, lock, re-check, and write.
- Keyset paging (`where id > lastSeenId order by id`), not `offset`, for lists
  that change between page requests; rows shift under an offset.

### 4. One transaction for all writes of one operation

If a parent and its children, or a record and its audit row, must exist together,
write them on the same `trx`. A helper that writes must take the executor as a
parameter instead of importing the global `db`, or it silently runs outside the
caller's transaction:

```typescript
// RIGHT - callers pass db or trx
async function createDraft(executor: Kysely<DB>, input: DraftInput) { ... }
await db.transaction().execute(async (trx) => {
  const draft = await createDraft(trx, input);
  await createDraftLines(trx, draft.id, input.lines);   // rolls back with the draft
});
```

### 5. A caught database error poisons the transaction

After any statement fails inside a PostgreSQL transaction, every later statement
fails with `current transaction is aborted, commands ignored until end of
transaction block` (25P02) until rollback. Catching the error in TypeScript and
carrying on does not help. To try something that may fail and continue, wrap it
in a savepoint, and savepoints exist only on a **controlled** transaction:

```typescript
// db.transaction().execute(trx => ...) gives a Transaction: it has NO .savepoint(),
// and trx.transaction() throws "calling the transaction method for a Transaction is not supported".
const trx = await db.startTransaction().execute();        // ControlledTransaction
try {
  const sp = await trx.savepoint("try_optional").execute();
  try {
    await sp.insertInto("tag").values(tag).execute();
    await sp.releaseSavepoint("try_optional").execute();
  } catch {
    await sp.rollbackToSavepoint("try_optional").execute(); // trx usable again
  }
  await trx.commit().execute();
} catch (e) {
  await trx.rollback().execute();
  throw e;
}
```

Prefer avoiding the error instead (an `onConflict`, a `where not exists`, or
checking that an optional function or extension exists before calling it). Also,
when you do catch, catch narrowly: fall back on an expected error code only, and
rethrow timeouts and other database errors instead of returning an empty result.
Do not type the handle as `any`; that is how a missing `.savepoint()` reaches
production.
